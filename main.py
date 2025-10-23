
import os
import json
import uvicorn
from fastapi import FastAPI, UploadFile, File, Form, Body 
from fastapi.middleware.cors import CORSMiddleware
from pypdf import PdfReader
import io
from constants import MODEL as model, GEMINI_KEY as gemini_key, TEMP, CORPUS_DIR, INDEX_DIR, MEMORY_DIR, RUNS_DIR, CHATS_DIR, PERSONAS, TURNS
from fastapi.responses import JSONResponse
from models import ChatInput, MeetingInput
from utils import build_or_update_index, retrieve_relevant_chunks, load_knowledge, load_memory_from_vectordb
from agents import run_meeting
import google.generativeai as genai
from chat_vectordb import store_chat_message, get_chat_history, get_agent_stats, ensure_genai_configured

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

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
