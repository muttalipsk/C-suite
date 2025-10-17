import os
import json
import uvicorn
from fastapi import FastAPI, UploadFile, File, Form, Request, Body 
from langchain.prompts import ChatPromptTemplate
from langchain.schema import SystemMessage, HumanMessage
from pypdf import PdfReader
import io
from langchain_google_genai import ChatGoogleGenerativeAI
from constants import MODEL as model, GEMINI_KEY as gemini_key, TEMP, CORPUS_DIR, INDEX_DIR, MEMORY_DIR, RUNS_DIR, CHATS_DIR, PERSONAS,TURNS
from fastapi.responses import HTMLResponse, JSONResponse
# from fastapi.staticfiles import StaticFiles
# from fastapi.templating import Jinja2Templates
from constants import GEMINI_KEY, CORPUS_DIR, INDEX_DIR, MEMORY_DIR, RUNS_DIR, CHATS_DIR, PERSONAS,TURNS
from models import ChatInput, MeetingInput
from utils import build_or_update_index, retrieve_relevant_chunks, load_knowledge, load_memory
from agents import run_meeting
import google.generativeai as genai

genai.configure(api_key=GEMINI_KEY)

# Create directories
os.makedirs(CORPUS_DIR, exist_ok=True)
os.makedirs(INDEX_DIR, exist_ok=True)
os.makedirs(MEMORY_DIR, exist_ok=True)
os.makedirs(RUNS_DIR, exist_ok=True)
os.makedirs(CHATS_DIR, exist_ok=True)

# FastAPI App
app = FastAPI()
# app.mount("/static", StaticFiles(directory="static"), name="static")
# templates = Jinja2Templates(directory="templates")

# Routes/Endpoints
@app.get("/", response_class=JSONResponse)
async def root():
    return {"message": "Backend API is running! Frontend at http://localhost:3000"}

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

# @app.post("/meeting")
# async def meeting(
#     task: str = Form(...), 
#     user_profile: str = Form(""),
#     turns: int = Form(TURNS), 
#     agents: list[str] = Form(default=[])
# ):
#     if not agents:
#         agents = list(PERSONAS.keys())
    
#     print(f"Selected agents: {agents}")
#     result = run_meeting(task, user_profile, turns, agents)
#     return result

@app.post("/meeting")
async def meeting(input_data: MeetingInput = Body(...)):
    task = input_data.task
    user_profile = input_data.user_profile
    turns = input_data.turns
    agents = input_data.agents or list(PERSONAS.keys())  # Default to all
    print(f"Selected agents: {agents}")
    result = run_meeting(task, user_profile, turns, agents)
    return result

@app.post("/chat")
async def chat_endpoint(input: ChatInput):
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
    
    chat_path = os.path.join(CHATS_DIR, f"{input.run_id}_{agent}.json")
    history = []
    if os.path.exists(chat_path):
        with open(chat_path, "r") as f:
            history = json.load(f)
    
    # Load agent details
    knowledge = load_knowledge(agent)
    company = PERSONAS[agent]["company"]
    role = PERSONAS[agent]["role"]
    description = PERSONAS[agent]["description"]
    relevant_chunks = retrieve_relevant_chunks(agent, task + " " + input.message, CORPUS_DIR, INDEX_DIR)
    memory = load_memory(agent, MEMORY_DIR)
    
    # Build prompt for chat (same as original)
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
    
    prompt = ChatPromptTemplate.from_messages([
        SystemMessage(content=system_prompt),
        HumanMessage(content=human_content)
    ])
    llm = ChatGoogleGenerativeAI(model=model, google_api_key=gemini_key, temperature=TEMP)

    try:
        response = llm.invoke(prompt.format_messages())
        agent_response = response.content
    except Exception as e:
        print(f"Error in chat with {agent}: {e}")
        agent_response = "Sorry, I encountered an issue. Please try again."
    
    # Append to history
    history.append({"user": input.message, "agent": agent_response})
    with open(chat_path, "w") as f:
        json.dump(history, f)
    
    return {"response": agent_response}

@app.get("/get_chat")
async def get_chat(run_id: str, agent: str):
    if agent not in PERSONAS:
        return JSONResponse(status_code=400, content={"error": "Invalid agent"})
    
    chat_path = os.path.join(CHATS_DIR, f"{run_id}_{agent}.json")
    if os.path.exists(chat_path):
        with open(chat_path, "r") as f:
            history = json.load(f)
        return {"history": history}
    return {"history": []}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)