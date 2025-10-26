
import os
import json
import uvicorn
from fastapi import FastAPI, UploadFile, File, Form, Body 
from fastapi.middleware.cors import CORSMiddleware
from pypdf import PdfReader
import io
from typing import List
from constants import MODEL as model, GEMINI_KEY as gemini_key, TEMP, CORPUS_DIR, INDEX_DIR, MEMORY_DIR, RUNS_DIR, CHATS_DIR, PERSONAS, TURNS
from fastapi.responses import JSONResponse
from models import ChatInput, MeetingInput
from utils import build_or_update_index, retrieve_relevant_chunks, load_knowledge, load_memory_from_vectordb
from agents import run_meeting
import google.generativeai as genai
from chat_vectordb import store_chat_message, get_chat_history, get_agent_stats, ensure_genai_configured
from twin_manager import create_twin_vectors, query_twin_content, query_twin_style, UPLOADS_DIR

# Create directories
os.makedirs(CORPUS_DIR, exist_ok=True)
os.makedirs(INDEX_DIR, exist_ok=True)
os.makedirs(MEMORY_DIR, exist_ok=True)
os.makedirs(RUNS_DIR, exist_ok=True)
os.makedirs(CHATS_DIR, exist_ok=True)

# FastAPI App
app = FastAPI()

# Add CORS middleware to allow Node.js server to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Configure Gemini on startup with proper error handling"""
    try:
        if not gemini_key:
            print("WARNING: GEMINI_API_KEY is not set!")
        else:
            ensure_genai_configured()
            print("✓ Gemini API configured successfully")
    except Exception as e:
        print(f"ERROR configuring Gemini API: {e}")

# Routes/Endpoints
@app.get("/", response_class=JSONResponse)
async def root():
    return {"message": "Python AI Backend is running!", "status": "healthy"}

@app.post("/ingest")
async def ingest(persona: str = Form(...), file: UploadFile = File(...)):
    if persona not in PERSONAS:
        return JSONResponse(status_code=400, content={"error": "Invalid persona"})
    
    corpus_path = os.path.join(CORPUS_DIR, persona)
    os.makedirs(corpus_path, exist_ok=True)
    
    filename = file.filename
    content = await file.read()
    
    if filename.endswith(".pdf"):
        reader = PdfReader(io.BytesIO(content))
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
    else:
        text = content.decode("utf-8")
    
    chunk_path = os.path.join(corpus_path, filename + ".txt")
    with open(chunk_path, "w") as f:
        f.write(text)
    
    build_or_update_index(persona, CORPUS_DIR, INDEX_DIR)
    return {"status": "Index updated"}

@app.post("/meeting")
async def meeting(input_data: MeetingInput = Body(...)):
    task = input_data.task
    user_profile = input_data.user_profile
    turns = input_data.turns
    agents = input_data.agents or list(PERSONAS.keys())
    user_id = input_data.user_id or "system"
    print(f"Selected agents: {agents}, User ID: {user_id}")
    result = run_meeting(task, user_profile, turns, agents, user_id)
    return result

@app.post("/chat")
async def chat_endpoint(input: ChatInput):
    """
    Handle chat messages and store them in ChromaDB vector database.
    Each agent has its own collection in ChromaDB.
    """
    agent = input.agent
    if agent not in PERSONAS:
        return JSONResponse(status_code=400, content={"error": "Invalid agent"})
    
    run_path = os.path.join(RUNS_DIR, f"run_{input.run_id}.json")
    if not os.path.exists(run_path):
        return JSONResponse(status_code=404, content={"error": "Run not found"})
    
    with open(run_path, "r") as f:
        run = json.load(f)
    
    task = run["task"]
    user_profile = run["user_profile"]
    recommendation = run["recommendations"].get(agent, "")
    
    # Fetch chat history from ChromaDB (agent-specific)
    history_messages = get_chat_history(agent, input.run_id, limit=50)
    history = [{"user": msg.get("message") if msg.get("sender") == "user" else "", 
                "agent": msg.get("message") if msg.get("sender") == "agent" else ""} 
               for msg in history_messages]
    
    knowledge = load_knowledge(agent)
    company = PERSONAS[agent]["company"]
    role = PERSONAS[agent]["role"]
    description = PERSONAS[agent]["description"]
    relevant_chunks = retrieve_relevant_chunks(agent, task + " " + input.message, CORPUS_DIR, INDEX_DIR)
    memory = load_memory_from_vectordb(agent, limit=5)
    
    system_prompt = f"""
You are {agent} from {company}, acting in your {role}: {description}. You are serving as a moderator and advisor to C-suite level executives. Respond in a natural, conversational manner, providing balanced, insightful advice based on your expertise.

Remain unbiased, helpful, and focused on the context. Build on your previous recommendation and the conversation history.

Base your response on:
- Original query: {task}
- User Profile: {user_profile}
- Your previous recommendation: {recommendation}
- Knowledge: {knowledge}
- Relevant writings: {relevant_chunks}
- Recent memory: {memory}
- Conversation history: {json.dumps(history)}
"""
    
    human_content = f"User's follow-up message: {input.message}"
    
    # Use Gemini directly without LangChain
    try:
        ensure_genai_configured()
        chat_model = genai.GenerativeModel(model)
        response = chat_model.generate_content(
            f"{system_prompt}\n\n{human_content}",
            generation_config=genai.GenerationConfig(temperature=TEMP)
        )
        agent_response = response.text
    except Exception as e:
        print(f"Error in chat with {agent}: {e}")
        agent_response = "Sorry, I encountered an issue. Please try again."
    
    # Store user message in ChromaDB vector database
    store_chat_message(
        agent_name=agent,
        run_id=input.run_id,
        user_id=input.user_id,
        message=input.message,
        sender="user"
    )
    
    # Store agent response in ChromaDB vector database
    store_chat_message(
        agent_name=agent,
        run_id=input.run_id,
        user_id=input.user_id,
        message=agent_response,
        sender="agent"
    )
    
    return {"response": agent_response}

@app.get("/get_chat")
async def get_chat(run_id: str, agent: str):
    """
    Retrieve chat history from ChromaDB vector database for a specific agent.
    Each agent maintains its own separate chat history collection.
    """
    if agent not in PERSONAS:
        return JSONResponse(status_code=400, content={"error": "Invalid agent"})
    
    # Fetch from ChromaDB (agent-specific collection)
    history_messages = get_chat_history(agent, run_id, limit=100)
    
    # Format for frontend compatibility
    history = []
    for msg in history_messages:
        if msg.get("sender") == "user":
            history.append({"user": msg.get("message"), "agent": ""})
        else:
            if history and not history[-1].get("agent"):
                history[-1]["agent"] = msg.get("message")
            else:
                history.append({"user": "", "agent": msg.get("message")})
    
    return {"history": history}

@app.get("/agent_stats/{agent}")
async def agent_stats(agent: str):
    """
    Get statistics about an agent's chat history in ChromaDB.
    """
    if agent not in PERSONAS:
        return JSONResponse(status_code=400, content={"error": "Invalid agent"})
    
    stats = get_agent_stats(agent)
    return stats

# ===== DIGITAL TWIN ENDPOINTS =====

@app.post("/twin/create")
async def create_twin(
    twin_id: str = Form(...),
    sample_messages: str = Form(...),  # JSON array string
    profile_data: str = Form(...),  # JSON object string
    files: List[UploadFile] = File(default=[])
):
    """
    Create a digital twin with file uploads and semantic chunking.
    Stores data in dual vector databases (Content + Style).
    """
    try:
        # Parse JSON strings
        sample_msgs = json.loads(sample_messages)
        profile = json.loads(profile_data)
        
        # Save uploaded files
        uploaded_paths = []
        for file in files:
            if file.filename:
                file_path = os.path.join(UPLOADS_DIR, f"{twin_id}_{file.filename}")
                content = await file.read()
                
                # Handle PDF and text files
                if file.filename.endswith(".pdf"):
                    reader = PdfReader(io.BytesIO(content))
                    text = ""
                    for page in reader.pages:
                        text += page.extract_text() + "\n"
                    # Save as text file
                    file_path = file_path.replace(".pdf", ".txt")
                    with open(file_path, "w", encoding="utf-8") as f:
                        f.write(text)
                else:
                    with open(file_path, "wb") as f:
                        f.write(content)
                
                uploaded_paths.append(file_path)
        
        # Create vector embeddings
        stats = create_twin_vectors(
            twin_id=twin_id,
            sample_messages=sample_msgs,
            uploaded_files=uploaded_paths,
            profile_data=profile
        )
        
        return {
            "success": True,
            "twin_id": twin_id,
            "stats": stats,
            "files_saved": len(uploaded_paths)
        }
        
    except Exception as e:
        print(f"Error creating twin: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "success": False}
        )


@app.post("/twin/chat")
async def twin_chat(
    twin_id: str = Form(...),
    message: str = Form(...),
    profile_data: str = Form(...),  # JSON object with twin config
    tone_style: str = Form(...),
    emoji_preference: str = Form(default="None")
):
    """
    Chat with a digital twin using RAG on Content and Style vector databases.
    
    Workflow (MANDATORY):
    1. Content RAG → Query vector DB for relevant content
    2. If empty → Profile fallback (check specific profile fields)
    3. If still empty → Escalate with general guidance
    4. Style RAG → ALWAYS run, must return examples
    5. LLM with Style + Data → Final Response
    """
    try:
        profile = json.loads(profile_data)
        
        # STEP 1: Content RAG - Query vector database
        print(f"[Twin {twin_id}] STEP 1: Content RAG query for: '{message}'")
        content_chunks = query_twin_content(twin_id, message, limit=3)
        content = "\n".join(content_chunks) if content_chunks else ""
        content_found = bool(content_chunks)
        
        print(f"[Twin {twin_id}] Content RAG result: {len(content_chunks)} chunks found")
        
        # STEP 2: Profile Fallback - If no content found, check profile
        if not content.strip():
            print(f"[Twin {twin_id}] STEP 2: Profile fallback triggered")
            query_lower = message.lower()
            
            # Try to extract relevant profile data based on query keywords
            if "goal" in query_lower or "q4" in query_lower:
                content = profile.get("q4_goal", "")
                if content:
                    print(f"[Twin {twin_id}] Profile fallback: Found Q4 goal")
            elif "strategy" in query_lower or "plan" in query_lower:
                content = profile.get("core_strategy", "")
                if content:
                    print(f"[Twin {twin_id}] Profile fallback: Found core strategy")
            elif "risk" in query_lower:
                content = profile.get("risk_tolerance", "")
                if content:
                    print(f"[Twin {twin_id}] Profile fallback: Found risk tolerance")
            elif "value" in query_lower or "culture" in query_lower:
                content = profile.get("core_values", "")
                if content:
                    print(f"[Twin {twin_id}] Profile fallback: Found core values")
            elif "company" in query_lower or "work" in query_lower:
                content = f"Company: {profile.get('company_name', '')}, Designation: {profile.get('designation', '')}"
                if content:
                    print(f"[Twin {twin_id}] Profile fallback: Found company info")
        
        # STEP 3: Escalate if still empty - Last resort
        escalated = False
        if not content.strip():
            print(f"[Twin {twin_id}] STEP 3: Escalation triggered - no data available")
            content = f"[ESCALATED: No specific data found in knowledge base or profile for this query. Providing general guidance based on my role and values.]"
            escalated = True
        
        # STEP 4: Style RAG - ALWAYS run, mandatory
        print(f"[Twin {twin_id}] STEP 4: Style RAG - retrieving communication examples")
        style_examples = query_twin_style(twin_id, limit=5)
        
        if not style_examples:
            # Style is mandatory - raise error if empty
            error_msg = f"[Twin {twin_id}] ERROR: No style examples found in vector DB. Twin needs sample messages to function properly."
            print(error_msg)
            return JSONResponse(
                status_code=500,
                content={"error": "Twin not properly configured - missing communication style examples"}
            )
        
        examples = "\n".join(style_examples)
        print(f"[Twin {twin_id}] Style RAG result: {len(style_examples)} examples found")
        
        # STEP 5: LLM with Style + Data
        twin_name = profile.get("twin_name", "Unknown")
        company = profile.get("company_name", "")
        designation = profile.get("designation", "")
        
        system_prompt = f"""
You are {twin_name}, {designation} at {company}.
Respond EXACTLY like them:
- Tone: {tone_style}
- Use emoji: {emoji_preference} (if appropriate)
- Risk approach: {profile.get('risk_tolerance', 'Balanced')}
- Core values: {profile.get('core_values', 'Integrity and excellence')}

Real communication examples:
{examples}

Data to use in response:
{content}

User asked: {message}
"""
        
        ensure_genai_configured()
        chat_model = genai.GenerativeModel(model)
        response = chat_model.generate_content(
            system_prompt,
            generation_config=genai.GenerationConfig(temperature=0.7)
        )
        
        twin_response = response.text
        
        if escalated:
            twin_response += "\n\n[Note: This response is based on general principles as no specific data was found]"
        
        return {
            "response": twin_response,
            "escalated": escalated,
            "content_found": bool(content_chunks)
        }
        
    except Exception as e:
        print(f"Error in twin chat: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )


@app.get("/twin/stats/{twin_id}")
async def twin_stats(twin_id: str):
    """Get statistics about a twin's vector database"""
    try:
        from twin_manager import get_twin_collections
        content_collection, style_collection = get_twin_collections(twin_id)
        
        content_count = content_collection.count()
        style_count = style_collection.count()
        
        return {
            "twin_id": twin_id,
            "content_chunks": content_count,
            "style_chunks": style_count,
            "total_chunks": content_count + style_count
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
