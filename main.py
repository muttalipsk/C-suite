import os
import json
import uvicorn
from fastapi import FastAPI, UploadFile, File, Form, Body 
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
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

# Mount static files for avatars
if os.path.exists("attached_assets"):
    app.mount("/attached_assets", StaticFiles(directory="attached_assets"), name="attached_assets")
else:
    print("WARNING: attached_assets directory not found!")

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
    meeting_type = input_data.meeting_type or "chat"  # NEW: Get meeting type
    print(f"Selected agents: {agents}, User ID: {user_id}, Meeting Type: {meeting_type}")
    result = run_meeting(task, user_profile, turns, agents, user_id, meeting_type)
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

    company = PERSONAS[agent]["company"]
    role = PERSONAS[agent]["role"]
    description = PERSONAS[agent]["description"]
    
    # NEW: Retrieve from ChromaDB knowledge base using RAG
    from agents import retrieve_from_knowledge_base
    knowledge_chunks = retrieve_from_knowledge_base(agent, task + " " + input.message, n_results=5)
    
    memory = load_memory_from_vectordb(agent, limit=5)

    # Build knowledge context
    knowledge_context = ""
    if knowledge_chunks:
        knowledge_context = f"**Your domain knowledge and expertise:**\n{knowledge_chunks}\n\n"

    system_prompt = f"""
You are {agent} from {company}, acting in your {role}: {description}. You are serving as a moderator and advisor to C-suite level executives. Respond in a natural, conversational manner, providing balanced, insightful advice based on your expertise.

Remain unbiased, helpful, and focused on the context. Build on your previous recommendation and the conversation history.

Base your response on:
- Original query: {task}
- User Profile: {user_profile}
- Your previous recommendation: {recommendation}
{knowledge_context}- Recent memory: {memory}
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

@app.post("/agent/upload-knowledge")
async def upload_agent_knowledge(
    agent: str = Form(...),
    files: List[UploadFile] = File(...)
):
    """
    Upload knowledge documents for AI leaders (Sam Altman, Jensen Huang, etc.).
    Creates dedicated ChromaDB collection: knowledge_{agent}
    Processes PDFs/TXT files, chunks them, embeds with Gemini, stores for RAG.
    """
    try:
        if agent not in PERSONAS:
            return JSONResponse(
                status_code=400,
                content={"error": f"Invalid agent. Must be one of: {', '.join(PERSONAS)}"}
            )
        
        # Ensure Gemini is configured
        ensure_genai_configured()
        
        # Import ChromaDB utilities
        from chromadb import PersistentClient
        from constants import CHROMA_DIR
        
        # Create collection for this agent's knowledge
        chroma_client = PersistentClient(path=CHROMA_DIR)
        knowledge_collection = chroma_client.get_or_create_collection(
            name=f"knowledge_{agent}"
        )
        
        total_chunks = 0
        processed_files = []
        
        # Process each uploaded file
        for file in files:
            if not file.filename:
                continue
                
            content_bytes = await file.read()
            file_text = ""
            
            # Extract text based on file type
            if file.filename.endswith(".pdf"):
                reader = PdfReader(io.BytesIO(content_bytes))
                for page in reader.pages:
                    file_text += page.extract_text() + "\n"
            elif file.filename.endswith((".txt", ".md")):
                file_text = content_bytes.decode("utf-8")
            else:
                continue  # Skip unsupported formats
            
            if not file_text.strip():
                continue
            
            # Chunk the document (simple chunking: every 500 words)
            words = file_text.split()
            chunk_size = 500
            chunks = []
            
            for i in range(0, len(words), chunk_size):
                chunk = " ".join(words[i:i + chunk_size])
                if chunk.strip():
                    chunks.append(chunk)
            
            # Generate embeddings and store in ChromaDB
            embedding_model = genai.GenerativeModel("models/embedding-001")
            
            for idx, chunk in enumerate(chunks):
                # Generate embedding
                embedding_result = genai.embed_content(
                    model="models/embedding-001",
                    content=chunk,
                    task_type="retrieval_document"
                )
                
                # Store in ChromaDB
                knowledge_collection.add(
                    documents=[chunk],
                    embeddings=[embedding_result['embedding']],
                    metadatas=[{
                        "file_name": file.filename,
                        "chunk_index": idx,
                        "agent": agent
                    }],
                    ids=[f"{agent}_{file.filename}_{idx}"]
                )
                total_chunks += 1
            
            processed_files.append({
                "filename": file.filename,
                "chunks": len(chunks)
            })
        
        return {
            "success": True,
            "agent": agent,
            "files_processed": len(processed_files),
            "total_chunks": total_chunks,
            "files": processed_files,
            "collection": f"knowledge_{agent}"
        }
        
    except Exception as e:
        print(f"Error uploading agent knowledge: {e}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "success": False}
        )


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
    Chat with a digital twin using LangGraph workflow.

    LangGraph Workflow:
    1. Retrieve → Triple vector DB retrieval (Style, Business Context, Decisions)
    2. Personalize → Apply communication style
    3. Decision → Proposal → Critique → Moderator pattern
    4. Route → Escalate if low confidence, Generate if sufficient

    Robust fallback handling at every stage - NEVER crashes!
    """
    try:
        from twin_langgraph import run_twin_conversation

        profile = json.loads(profile_data)
        twin_profile = {
            **profile,
            "toneStyle": tone_style,
            "emojiPreference": emoji_preference
        }

        print(f"[LangGraph Twin {twin_id}] Processing query: '{message}'")

        # Run LangGraph workflow
        result = run_twin_conversation(twin_id, twin_profile, message)

        print(f"[LangGraph Twin {twin_id}] Workflow complete - Confidence: {result['confidence']['overall']}%")

        return {
            "response": result["response"],
            "escalated": result["escalated"],
            "confidence": result["confidence"],
            "metadata": {
                "proposal": result.get("proposal", ""),
                "critique": result.get("critique", "")
            }
        }

    except Exception as e:
        print(f"Error in LangGraph twin chat: {e}")
        # CRITICAL: Return fallback response instead of error
        return JSONResponse(
            status_code=200,
            content={
                "response": f"I apologize, but I encountered an error. To provide accurate responses, please connect your email and business data sources.\n\nError: {str(e)}",
                "escalated": True,
                "confidence": {
                    "style": 0,
                    "context": 0,
                    "decision": 0,
                    "overall": 0
                },
                "metadata": {
                    "error": str(e)
                }
            }
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


@app.post("/email/analyze")
async def analyze_emails(data: dict = Body(...)):
    """
    Analyze emails to extract communication style and decision patterns.
    Supports both connected email accounts and uploaded email data.

    Args:
        emails: List of email objects with subject, body, from, to, date
        user_profile: User profile for context

    Returns:
        Analysis with confidence scores and extracted patterns
    """
    try:
        from email_analyzer import EmailAnalyzer

        emails = data.get("emails", [])
        user_profile = data.get("user_profile", {})

        if not emails:
            return JSONResponse(
                status_code=200,
                content={
                    "success": False,
                    "confidence": 0,
                    "fallback_required": True,
                    "message": "No emails provided for analysis"
                }
            )

        analyzer = EmailAnalyzer()
        analysis_result = analyzer.analyze_email_batch(emails, user_profile)

        # CRITICAL: Handle case where no data is returned (prevent crash)
        if not analysis_result or analysis_result.get("confidence", 0) == 0:
            return JSONResponse(
                status_code=200,
                content={
                    "success": True,
                    "confidence": 0,
                    "fallback_required": True,
                    "tone": "Professional",
                    "formality_level": 5,
                    "decision_style": "Balanced",
                    "message": "Insufficient email data - using professional defaults"
                }
            )

        return analysis_result

    except Exception as e:
        print(f"Error analyzing emails: {e}")
        # CRITICAL: Return fallback instead of error (prevent frontend crash)
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "confidence": 0,
                "fallback_required": True,
                "tone": "Professional",
                "formality_level": 5,
                "decision_style": "Balanced",
                "error": str(e),
                "message": "Analysis failed - using professional defaults"
            }
        )


@app.post("/email/extract-decisions")
async def extract_decisions(data: dict = Body(...)):
    """
    Extract strategic decisions from email history.

    Args:
        emails: List of email objects

    Returns:
        List of extracted decisions with rationale and context
    """
    try:
        from email_analyzer import EmailAnalyzer

        emails = data.get("emails", [])

        if not emails:
            return JSONResponse(
                status_code=200,
                content={
                    "success": True,
                    "decisions": [],
                    "message": "No emails provided"
                }
            )

        analyzer = EmailAnalyzer()
        decisions = analyzer.extract_decisions(emails)

        return {
            "success": True,
            "decisions": decisions,
            "count": len(decisions)
        }

    except Exception as e:
        print(f"Error extracting decisions: {e}")
        # CRITICAL: Return empty array instead of error (prevent crash)
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "decisions": [],
                "error": str(e),
                "message": "Decision extraction failed"
            }
        )


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)