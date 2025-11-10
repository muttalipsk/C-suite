import os
import json
import time
import uvicorn
from fastapi import FastAPI, UploadFile, File, Form, Body 
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pypdf import PdfReader
import io
from typing import List
from constants import MODEL as model, GEMINI_KEY as gemini_key, TEMP, CORPUS_DIR, INDEX_DIR, MEMORY_DIR, RUNS_DIR, CHATS_DIR, PERSONAS, TURNS
from fastapi.responses import JSONResponse
from models import ChatInput, MeetingInput, QuestionRefinementInput, PreMeetingEvaluationInput, ChatFollowupEvaluationInput, ChatFollowupCounterQuestionInput, ScrapeWebsiteInput, GenerateMCQInput, CreateDigitalTwinInput, GenerateMetadataInput
from utils import build_or_update_index, retrieve_relevant_chunks, load_knowledge, load_memory_from_vectordb
from agents import run_meeting
import google.generativeai as genai
from chat_vectordb import store_chat_message, get_chat_history, get_agent_stats, ensure_genai_configured
from twin_manager import create_twin_vectors, query_twin_content, query_twin_style, UPLOADS_DIR
from pre_meeting import evaluate_readiness_with_ai, generate_counter_question
from persona_interview import router as persona_interview_router
from chat_followup import evaluate_chat_question, generate_chat_counter_question
from web_scraper import scrape_company_website, extract_company_insights
from digital_twin_mcq import generate_mcq_questions

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

# Include routers
app.include_router(persona_interview_router)

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

# Import shared agent metadata helper
from agent_metadata import get_agent_metadata

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

@app.post("/pre-meeting/generate-question")
async def pre_meeting_generate_question(input_data: PreMeetingEvaluationInput = Body(...)):
    """
    Generate a counter-question WITHOUT evaluation (used for initial question only).
    Always generates a question - doesn't check readiness.
    """
    session_id = input_data.session_id
    question = input_data.question
    agents = input_data.agents
    user_profile = input_data.user_profile
    conversation_history = input_data.conversation_history
    
    # Validate agents (accept both PERSONAS and twin_ prefixed digital twins)
    for agent in agents:
        if agent not in PERSONAS and not agent.startswith("twin_"):
            return JSONResponse(status_code=400, content={"error": f"Invalid agent: {agent}"})
    
    meeting_type = input_data.meeting_type  # Get meeting type from request
    
    try:
        # Always generate a counter-question for the first interaction
        counter_question = generate_counter_question(
            question=question,
            agents=agents,
            conversation_history=conversation_history,
            user_profile=user_profile,
            meeting_type=meeting_type  # Pass meeting type to customize questions
        )
        
        return {
            "counter_question": counter_question
        }
        
    except Exception as e:
        print(f"Pre-meeting question generation error: {e}")
        return JSONResponse(
            status_code=500, 
            content={"error": f"Question generation failed: {str(e)}"}
        )

@app.post("/pre-meeting/evaluate")
async def pre_meeting_evaluate(input_data: PreMeetingEvaluationInput = Body(...)):
    """
    Evaluate readiness using AI decision-making and generate counter-questions.
    AI decides when enough information is gathered, not based on percentage.
    """
    session_id = input_data.session_id
    question = input_data.question
    agents = input_data.agents
    user_profile = input_data.user_profile
    conversation_history = input_data.conversation_history
    
    # Validate agents (accept both PERSONAS and twin_ prefixed digital twins)
    for agent in agents:
        if agent not in PERSONAS and not agent.startswith("twin_"):
            return JSONResponse(status_code=400, content={"error": f"Invalid agent: {agent}"})
    
    meeting_type = input_data.meeting_type  # Get meeting type from request
    
    try:
        # Use AI to decide if ready for meeting
        is_ready = evaluate_readiness_with_ai(
            question=question,
            agents=agents,
            conversation_history=conversation_history,
            user_profile=user_profile,
            meeting_type=meeting_type
        )
        
        # Generate counter-question if not ready
        counter_question = None
        if not is_ready:
            counter_question = generate_counter_question(
                question=question,
                agents=agents,
                conversation_history=conversation_history,
                user_profile=user_profile,
                meeting_type=meeting_type  # Pass meeting type to customize questions
            )
        
        return {
            "counter_question": counter_question,
            "is_ready": is_ready
        }
        
    except Exception as e:
        print(f"Pre-meeting evaluation error: {e}")
        return JSONResponse(
            status_code=500, 
            content={"error": f"Evaluation failed: {str(e)}"}
        )

@app.post("/chat/evaluate-followup")
async def chat_evaluate_followup(input_data: ChatFollowupEvaluationInput = Body(...)):
    """
    Evaluate if a chat question needs counter-questions for clarification.
    Uses full context: user profile, meeting type, chat history, agent recommendations.
    """
    try:
        needs_clarification = evaluate_chat_question(
            question=input_data.question,
            agent=input_data.agent,
            user_profile=input_data.user_profile,
            meeting_type=input_data.meeting_type,
            chat_history=input_data.chat_history,
            agent_recommendations=input_data.agent_recommendations
        )
        
        return {
            "needs_counter_questions": needs_clarification
        }
        
    except Exception as e:
        print(f"Chat followup evaluation error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Evaluation failed: {str(e)}"}
        )

@app.post("/chat/counter-question")
async def chat_generate_counter_question(input_data: ChatFollowupCounterQuestionInput = Body(...)):
    """
    Generate 1-2 targeted counter-questions for chat followup.
    Uses full context: user profile, meeting type, chat history, agent recommendations.
    Returns a list of counter-questions (1-2 items).
    """
    try:
        counter_questions = generate_chat_counter_question(
            question=input_data.question,
            agent=input_data.agent,
            user_profile=input_data.user_profile,
            meeting_type=input_data.meeting_type,
            chat_history=input_data.chat_history,
            agent_recommendations=input_data.agent_recommendations,
            previous_counter_questions=input_data.previous_counter_questions
        )
        
        return {
            "counter_questions": counter_questions
        }
        
    except Exception as e:
        print(f"Chat counter-question generation error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Counter-question generation failed: {str(e)}"}
        )

@app.get("/persona-interview/questions")
async def get_persona_questions():
    """Get all 20 persona interview questions"""
    return {
        "questions": PERSONA_QUESTIONS,
        "total_count": len(PERSONA_QUESTIONS)
    }

@app.post("/persona-interview/next-question")
async def get_persona_next_question(current_index: int = Body(..., embed=True)):
    """Get the next question in the persona interview sequence"""
    try:
        next_q = get_next_question(current_index)
        if next_q is None:
            return {
                "completed": True,
                "message": "All questions answered!"
            }
        return next_q
    except Exception as e:
        print(f"Error getting next question: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to get next question: {str(e)}"}
        )

@app.post("/persona-interview/analyze-emails")
async def analyze_persona_emails(email_texts: List[str] = Body(...)):
    """Analyze email samples to extract writing style"""
    try:
        style_analysis = analyze_email_writing_style(email_texts)
        return style_analysis
    except Exception as e:
        print(f"Error analyzing emails: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to analyze emails: {str(e)}"}
        )

@app.post("/persona-interview/generate-summary")
async def generate_interview_summary(
    answers: dict = Body(...),
    email_style: dict = Body(default=None)
):
    """Generate persona summary from interview answers and email analysis"""
    try:
        summary = generate_persona_summary(answers, email_style)
        return {
            "summary": summary,
            "success": True
        }
    except Exception as e:
        print(f"Error generating summary: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to generate summary: {str(e)}"}
        )

@app.post("/generate-metadata")
async def generate_metadata(input_data: GenerateMetadataInput = Body(...)):
    """
    Generate digital twin metadata (description and knowledge) using Gemini AI.
    Used during twin creation to auto-generate company, role, description, knowledge.
    """
    try:
        ensure_genai_configured()
        model = genai.GenerativeModel("gemini-2.0-flash-exp")
        
        response = model.generate_content(
            input_data.prompt,
            generation_config=genai.GenerationConfig(
                temperature=input_data.temperature,
                response_mime_type="application/json"
            )
        )
        
        # Parse JSON response
        metadata = json.loads(response.text)
        
        print(f"✅ Generated twin metadata: {metadata}")
        return metadata
        
    except Exception as e:
        print(f"Error generating metadata: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to generate metadata: {str(e)}"}
        )

@app.post("/meeting")
async def meeting(input_data: MeetingInput = Body(...)):
    task = input_data.task
    user_profile = input_data.user_profile
    turns = input_data.turns
    agents = input_data.agents or list(PERSONAS.keys())
    user_id = input_data.user_id or "system"
    meeting_type = input_data.meeting_type or "board"
    print(f"Selected agents: {agents}, User ID: {user_id}, Meeting Type: {meeting_type}")
    result = run_meeting(task, user_profile, turns, agents, user_id, meeting_type)
    return result

@app.post("/refine-question")
async def refine_question(input_data: QuestionRefinementInput = Body(...)):
    """
    Analyze user's question and suggest 2 improved versions if needed.
    Uses ALL selected agents' knowledge bases from ChromaDB to provide context-aware suggestions.
    """
    question = input_data.question
    agents = input_data.agents
    
    # Validate all agents (accept both PERSONAS and twin_ prefixed digital twins)
    for agent in agents:
        if agent not in PERSONAS and not agent.startswith("twin_"):
            return JSONResponse(status_code=400, content={"error": f"Invalid agent: {agent}"})
    
    try:
        # Retrieve relevant knowledge from ALL agents' ChromaDB collections
        from agents import retrieve_from_knowledge_base
        
        all_knowledge = []
        agents_context = []
        
        for agent in agents:
            knowledge_chunks = retrieve_from_knowledge_base(agent, question, n_results=2)
            
            # Get agent metadata (handles both PERSONAS and digital twins)
            metadata = get_agent_metadata(agent)
            company = metadata["company"]
            role = metadata["role"]
            description = metadata["description"]
            knowledge = metadata.get("knowledge", description)  # Fallback to description if no knowledge
            
            if knowledge_chunks:
                agent_info = f"**{agent}** ({role} at {company}):\n{knowledge_chunks[:500]}"
                all_knowledge.append(agent_info)
            
            agents_context.append(f"- {agent}: {role} at {company}, expert in {knowledge}")
        
        knowledge_context = ""
        if all_knowledge:
            knowledge_context = f"\n\nRelevant knowledge from your selected experts:\n" + "\n\n".join(all_knowledge[:1000])
        
        agents_list = "\n".join(agents_context)
        
        # Prompt for analyzing and refining the question based on ALL agents
        analysis_prompt = f"""You are an AI assistant helping a user prepare questions for a strategic boardroom meeting with these experts:

{agents_list}

The user is about to ask this question to ALL of these experts: "{question}"
{knowledge_context}

Analyze this question and determine:
1. Is the question clear and specific enough to leverage the collective expertise of these {len(agents)} experts?
2. Could it be rephrased to better tap into their unique knowledge domains?
3. Would additional context help them provide complementary, high-value insights?

If the question is already excellent (clear, specific, well-framed for this expert panel), respond with:
{{"needs_refinement": false, "suggestions": []}}

If the question could be improved, suggest 2 better versions that:
- Are more specific and actionable
- Align with the collective expertise of {', '.join(agents)}
- Would help each expert provide valuable strategic insights from their unique perspective
- Keep the user's original intent
- Encourage complementary responses from the different experts

Respond ONLY with valid JSON in this exact format:
{{"needs_refinement": true, "suggestions": ["refined question 1", "refined question 2"]}}

OR

{{"needs_refinement": false, "suggestions": []}}"""

        # Use Gemini to analyze
        ensure_genai_configured()
        model = genai.GenerativeModel("gemini-2.0-flash-exp")
        response = model.generate_content(
            analysis_prompt,
            generation_config=genai.GenerationConfig(
                temperature=0.3,
                response_mime_type="application/json"
            )
        )
        
        # Parse JSON response
        result = json.loads(response.text)
        
        print(f"📝 Question refinement for {len(agents)} agents ({', '.join(agents)}): {result}")
        return result
        
    except Exception as e:
        print(f"Error in question refinement: {e}")
        # Return no refinement on error
        return {"needs_refinement": False, "suggestions": []}

@app.post("/chat")
async def chat_endpoint(input: ChatInput):
    """
    Handle chat messages and store them in ChromaDB vector database.
    Each agent has its own collection in ChromaDB.
    """
    agent = input.agent
    if agent not in PERSONAS and not agent.startswith("twin_"):
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

    # Get agent metadata (handles both PERSONAS and digital twins)
    metadata = get_agent_metadata(agent)
    company = metadata["company"]
    role = metadata["role"]
    description = metadata["description"]
    knowledge = metadata.get("knowledge", description)  # Fallback to description if no knowledge
    
    # NEW: Retrieve from ChromaDB knowledge base using RAG
    from agents import retrieve_from_knowledge_base
    knowledge_chunks = retrieve_from_knowledge_base(agent, task + " " + input.message, n_results=5)
    
    memory = load_memory_from_vectordb(agent, limit=5)

    # Build knowledge context
    knowledge_context = ""
    if knowledge_chunks:
        knowledge_context = f"**Your domain knowledge and expertise:**\n{knowledge_chunks}\n\n"

    system_prompt = f"""
You are {agent} from {company}, acting in your {role}: {description}.

**Your expertise:** {knowledge}

You are serving as a moderator and advisor to C-suite level executives. Respond in a natural, conversational manner, providing balanced, insightful advice based on your expertise.

Remain unbiased, helpful, and focused on the context. Build on your previous recommendation and the conversation history.

Base your response on:
- Original query: {task}
- User Profile: {user_profile}
- Your previous recommendation: {recommendation}
{knowledge_context}- Recent memory: {memory}
- Conversation history: {json.dumps(history)}
"""

    # Build human content with enriched context if available
    human_content = f"User's follow-up message: {input.message}"
    
    # Handle enriched context from counter-question clarifications
    if input.enriched_context and input.enriched_context.get("clarifications"):
        clarifications = input.enriched_context["clarifications"]
        clarification_text = "\n\n**Clarifications provided by user:**\n"
        for i, clarification in enumerate(clarifications, 1):
            clarification_text += f"{i}. Q: {clarification['question']}\n   A: {clarification['answer']}\n"
        
        human_content = f"""Original question: {input.message}

{clarification_text}

Based on these clarifications, please provide a comprehensive response."""

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
    # Include clarifications if present so future turns have full context
    message_to_store = input.message
    if input.enriched_context and input.enriched_context.get("clarifications"):
        clarifications = input.enriched_context["clarifications"]
        clarification_text = "\n\n[Clarifications provided:\n"
        for i, clarification in enumerate(clarifications, 1):
            clarification_text += f"{i}. Q: {clarification['question']}\n   A: {clarification['answer']}\n"
        clarification_text += "]"
        message_to_store = input.message + clarification_text
    
    store_chat_message(
        agent_name=agent,
        run_id=input.run_id,
        user_id=input.user_id,
        message=message_to_store,
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
    if agent not in PERSONAS and not agent.startswith("twin_"):
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
    if agent not in PERSONAS and not agent.startswith("twin_"):
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
        if agent not in PERSONAS and not agent.startswith("twin_"):
            return JSONResponse(
                status_code=400,
                content={"error": f"Invalid agent. Must be one of: {', '.join(PERSONAS)} or a digital twin (twin_*)"}
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


@app.post("/digital-twin/scrape-website")
async def scrape_website(input_data: ScrapeWebsiteInput = Body(...)):
    """
    Scrape company website to gather information for MCQ generation.
    
    Args:
        company_url: Company website URL from user profile
        user_id: User ID for logging
    
    Returns:
        Scraped company data (about, team, culture, values, etc.)
    """
    try:
        company_url = input_data.company_url
        
        if not company_url or company_url.strip() == "":
            return JSONResponse(
                status_code=200,
                content={
                    "success": False,
                    "error": "No company URL provided",
                    "company_data": {
                        "company_info": "",
                        "about": "",
                        "team": "",
                        "culture": "",
                        "values": "",
                        "all_text": ""
                    }
                }
            )
        
        # Scrape the website
        scraped_data = scrape_company_website(company_url)
        
        if scraped_data.get("error") and not scraped_data.get("all_text"):
            return JSONResponse(
                status_code=200,
                content={
                    "success": False,
                    "error": scraped_data["error"],
                    "company_data": scraped_data
                }
            )
        
        # Extract insights for AI consumption
        insights = extract_company_insights(scraped_data)
        
        return {
            "success": True,
            "company_data": scraped_data,
            "insights": insights
        }
        
    except Exception as e:
        print(f"Error scraping website: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(e),
                "company_data": {
                    "company_info": "",
                    "about": "",
                    "team": "",
                    "culture": "",
                    "values": "",
                    "all_text": ""
                }
            }
        )


@app.post("/digital-twin/generate-mcq")
async def generate_mcq(input_data: GenerateMCQInput = Body(...)):
    """
    Generate 50 MCQ questions (10 per category) using Gemini AI.
    Questions are personalized based on user profile and company website data.
    
    Args:
        user_id: User ID for logging
        user_profile: User profile information
        company_data: Scraped company website data
    
    Returns:
        List of 50 MCQ questions with 4 answer choices each
    """
    try:
        user_profile = input_data.user_profile
        company_data = input_data.company_data
        
        # Generate MCQ questions
        questions = generate_mcq_questions(user_profile, company_data)
        
        # Validate we got 50 questions
        if len(questions) != 50:
            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "error": f"Expected 50 questions, got {len(questions)}",
                    "questions": questions
                }
            )
        
        return {
            "success": True,
            "questions": questions,
            "total": len(questions)
        }
        
    except Exception as e:
        print(f"Error generating MCQ questions: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(e),
                "questions": []
            }
        )


@app.post("/digital-twin/create")
async def create_digital_twin(input_data: CreateDigitalTwinInput = Body(...)):
    """
    Create a digital twin from MCQ answers, optional email samples, and documents.
    
    Process:
    1. Analyze MCQ answers to extract persona characteristics
    2. Optional: Analyze email samples for writing style
    3. Create ChromaDB collections (content + style)
    4. Store twin in database
    5. Auto-add persona to constants
    
    Args:
        user_id: User ID
        mcq_answers: List of MCQ answers with question IDs and selected choices
        email_samples: Optional pasted email text
        documents: Optional uploaded document paths
    
    Returns:
        Created twin ID and success status
    """
    try:
        user_id = input_data.user_id
        mcq_answers = input_data.mcq_answers
        email_samples = input_data.email_samples
        documents = input_data.documents or []
        
        # Validate MCQ answers
        if not mcq_answers or len(mcq_answers) != 50:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "error": f"Expected 50 MCQ answers, got {len(mcq_answers) if mcq_answers else 0}"
                }
            )
        
        # Step 1: Process MCQ answers to extract persona characteristics
        ensure_genai_configured()
        model_instance = genai.GenerativeModel('gemini-2.0-flash-exp')
        
        # Prepare MCQ context
        mcq_context = "\n".join([
            f"Q{ans['question_id']}: {ans['question']} -> Answer: {ans['selected_choice']}"
            for ans in mcq_answers
        ])
        
        # Generate persona summary from MCQ
        persona_prompt = f"""Based on these 50 MCQ answers, create a comprehensive digital twin persona profile.

MCQ Responses:
{mcq_context}

Generate a JSON object with these fields:
{{
  "twin_name": "Full name for the digital twin (e.g., John Smith Digital Twin)",
  "core_values": "Comma-separated list of 3-5 core values",
  "decision_making_style": "Concise description of how they make decisions",
  "communication_style": "Concise description of communication preferences",
  "leadership_approach": "Concise description of leadership style",
  "expertise_areas": "Comma-separated list of key expertise areas",
  "risk_tolerance": "Conservative/Moderate/Aggressive",
  "tone_style": "Direct/Collaborative/Analytical/Strategic/Inspirational"
}}

Be specific and based on the MCQ responses. Return only valid JSON."""

        response = model_instance.generate_content(
            persona_prompt,
            generation_config={"temperature": 0.3, "max_output_tokens": 1000}
        )
        
        # Extract JSON
        response_text = response.text.strip()
        if "```json" in response_text:
            start_idx = response_text.find("```json") + 7
            end_idx = response_text.find("```", start_idx)
            response_text = response_text[start_idx:end_idx].strip()
        elif "```" in response_text:
            start_idx = response_text.find("```") + 3
            end_idx = response_text.find("```", start_idx)
            response_text = response_text[start_idx:end_idx].strip()
        
        persona_data = json.loads(response_text)
        
        # Step 2: Analyze email samples if provided
        email_style = {}
        if email_samples:
            try:
                from email_analyzer import EmailAnalyzer
                analyzer = EmailAnalyzer()
                
                # Parse email samples into structured format
                email_list = [{"body": email_samples, "subject": "Sample"}]
                email_style = analyzer.analyze_email_batch(email_list, {})
            except Exception as e:
                print(f"Email analysis failed: {e}")
                email_style = {
                    "tone": "Professional",
                    "formality_level": 5,
                    "emoji_usage": "Minimal"
                }
        
        # Step 3: Create ChromaDB collections
        twin_id = f"twin_{user_id}_{int(time.time() * 1000)}"  # Unique twin ID
        
        try:
            # Create twin vectors (content + style collections)
            profile_data = {
                "twin_name": persona_data.get("twin_name", "Digital Twin"),
                "core_values": persona_data.get("core_values", ""),
                "decision_making": persona_data.get("decision_making_style", ""),
                "communication": persona_data.get("communication_style", ""),
                "leadership": persona_data.get("leadership_approach", ""),
                "expertise": persona_data.get("expertise_areas", ""),
                "mcq_responses": mcq_context
            }
            
            # Create vectors in ChromaDB
            create_twin_vectors(
                twin_id=twin_id,
                sample_messages=[],  # No sample messages for MCQ-based twins
                uploaded_files=documents,
                profile_data=profile_data
            )
            
        except Exception as e:
            print(f"Error creating ChromaDB collections: {e}")
            return JSONResponse(
                status_code=500,
                content={"success": False, "error": f"Failed to create twin vectors: {str(e)}"}
            )
        
        # Step 4: Return success
        return {
            "success": True,
            "twin_id": twin_id,
            "twin_name": persona_data.get("twin_name", "Digital Twin"),
            "persona_data": persona_data,
            "message": "Digital twin created successfully"
        }
        
    except json.JSONDecodeError as e:
        print(f"JSON parsing error: {e}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": "Failed to parse AI response"}
        )
    except Exception as e:
        print(f"Error creating digital twin: {e}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
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