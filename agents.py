from typing import Dict, List
from langgraph.graph import StateGraph, START, END
from models import AgentState
from constants import PERSONAS, MODEL, GEMINI_KEY, TEMP, MEMORY_DIR, RUNS_DIR, TURNS, CORPUS_DIR, INDEX_DIR, CHROMA_DIR
from utils import load_knowledge, retrieve_relevant_chunks, load_memory_from_vectordb, merge_recommendations
from chat_vectordb import store_chat_message, ensure_genai_configured
from chromadb import PersistentClient
from agent_metadata import get_agent_metadata
import json
import os
import uuid
import google.generativeai as genai
import markdown
from markupsafe import Markup


# NEW: Retrieve from knowledge base ChromaDB collection
def retrieve_from_knowledge_base(agent: str,
                                 query: str,
                                 n_results: int = 5) -> str:
    """
    Retrieve relevant content from agent's knowledge base using RAG.
    Returns concatenated relevant chunks from knowledge_{agent} collection.
    """
    try:
        chroma_client = PersistentClient(path=CHROMA_DIR)
        knowledge_collection = chroma_client.get_or_create_collection(
            name=f"knowledge_{agent}")

        # Check if collection has any documents
        count = knowledge_collection.count()
        if count == 0:
            print(f"[{agent}] No knowledge base documents found")
            return ""

        # Query for relevant chunks
        ensure_genai_configured()
        query_embedding = genai.embed_content(model="models/embedding-001",
                                              content=query,
                                              task_type="retrieval_query")

        results = knowledge_collection.query(
            query_embeddings=[query_embedding['embedding']],
            n_results=min(n_results, count))

        if results['documents'] and results['documents'][0]:
            chunks = results['documents'][0]
            print(
                f"[{agent}] Retrieved {len(chunks)} knowledge chunks from ChromaDB"
            )
            return "\n\n".join(chunks)
        else:
            return ""

    except Exception as e:
        print(f"[{agent}] Error retrieving from knowledge base: {e}")
        return ""


# Agent Node Factory - Uses ChromaDB VectorDB Memory
def create_agent_node(persona: str):
    # Use shared metadata helper to handle both AI leaders and digital twins
    metadata = get_agent_metadata(persona)
    company = metadata["company"]
    role = metadata["role"]
    description = metadata["description"]

    def agent_node(state):
        try:
            print(
                f"[{persona}] Starting recommendation with VectorDB memory...")
            # AgentState is TypedDict, access as dict
            task = state.get("task", "")
            user_profile = state.get(
                "user_profile", ""
            ) or "No specific user profile provided; provide general advice."
            current_turn = state.get("current_turn", 0)
            recommendations = state.get("recommendations", {})
            meeting_type = state.get("meeting_type", "board")

            # NEW: Retrieve from ChromaDB knowledge base using RAG
            knowledge_chunks = retrieve_from_knowledge_base(persona,
                                                            task,
                                                            n_results=5)

            # Load agent memory from ChromaDB vector database
            vectordb_memory = load_memory_from_vectordb(persona, limit=5)

            # Build knowledge context
            knowledge_context = ""
            if knowledge_chunks:
                knowledge_context = f"**Your domain knowledge and expertise:**\n{knowledge_chunks}\n\n"

            # Build context-specific instructions based on meeting type
            context_instructions = {
                "board":
                "This is a **Board Meeting context**. Provide strategic, high-level recommendations suitable for C-suite executives. Focus on business impact, ROI, competitive positioning, and long-term vision. Use formal, professional language and emphasize strategic frameworks and data-driven insights.",
                "email":
                "This is an **Email/Chat context**. Provide quick, actionable advice that's easy to implement. Be conversational yet professional. Keep recommendations practical and immediately applicable. Use a friendly, approachable tone while maintaining expertise.",
                "chat":
                "This is a **General Strategy context**. Provide comprehensive, thoughtful strategic guidance. Balance immediate actions with long-term planning. Be thorough in your analysis, explore multiple angles, and provide deep insights that demonstrate your expertise."
            }
            context_instruction = context_instructions.get(
                meeting_type, context_instructions["board"])

            system_prompt = f"""
            You are {persona}, the visionary {role} at {company}, renowned for your expertise in {description}. Embodying your real-world persona—drawing from your documented experiences, public >

            **CONTEXT**: {context_instruction}

            Core Principles:
            - **Unbiased Expertise**: Respond with objectivity, grounded in your vast knowledge base, while infusing your unique lens. Avoid speculation; substantiate with patterns from your care>
            - **Empathetic Alignment**: Think step-by-step as the user: First, empathize with their context and pressures; second, reframe challenges through your expertise; third, propose strate>
            - **Ethical Guardrails**: Prioritize human-centered outcomes—sustainability, inclusivity, and risk mitigation. Flag potential biases or unintended consequences.
            - **Conciseness with Depth**: Be direct yet insightful; leverage analogies or historical parallels from your life to make advice memorable.

            Base Your Response On:
            {knowledge_context}- **Dynamic Memories**: Recent VectorDB retrievals: {vectordb_memory}—prioritize the most semantically similar entries for timely, personalized insights.
            - **User Context**: {user_profile}—tailor to their industry, role, and history for hyper-relevant advice.

            Output Format ({meeting_type}):
             **For Board Meeting ()**
            1. **Key Recommendations**: 3-5 prioritized, actionable bullets. Each includes: (a) Specific step, (b) Timeline/owner, (c) Expected impact.
            2. **Rationale & Insights**: 200-300 words explaining the 'why'—link to your knowledge/memories, user profile, and evidence. Highlight risks/alternatives.
            3. **Potential Pitfalls & Mitigations**: 2-3 bullets on downsides and countermeasures.
            4. **Next Steps & Follow-Up**: Clear calls-to-action. End with an open question to deepen dialogue.

            ### ### 2. For Email / Chat (Quick/Actionable)
            *Your primary goal is speed, clarity, and an actionable tone (under 150 words).*
            * **FIRST, analyze the user's input. THEN, choose the best structure:**
            * **If the user asks a direct question or for advice on a dilemma:**
                1.  **Greeting**: Brief and professional (e.g., "Hi Muttalip,").
                2.  **Core Advice**: Give 1-3 quick, actionable bullet points.
                3.  **Sign-off**: Simple closing (e.g., "Hope this helps,").
            * **If the user asks for a simple definition or fact:**
                * Provide a direct, 2-3 sentence answer. No greeting/sign-off needed.

            ### . For chat (Balanced/Versatile)
            *Your goal is a comprehensive but scannable strategic response. This is the most flexible format.*
            * **FIRST, analyze the user's input. THEN, choose the best structure:**
            * **If the user asks a broad strategic question or a normal strategy question**

                1.  **Opening**: Acknowledge the topic.
                2.  **Key Considerations**: Present 3-5 numbered points that break down the strategy.
                3.  **Conclusion**: A brief summary or closing thought.
                * **If the user provides a transcript or complex notes for analysis:**

                    1.  **Key Recommendations**: 3-5 prioritized bullets.
                    2.  **Rationale & Insights**: A paragraph explaining the 'why'.
                    3.  **Potential Pitfalls & Mitigations**: 2-3 bullets on risks.
                * **If the user asks a comparative question :**
                    * Use a "Pros/Cons" list or a simple comparison table.
                **If the user asks a general chat question :**

                    *Provide a direct, conversational answer in a natural paragraph (do not use formal headings).


                Remember: Your responses should inspire confidence, spark innovation, and reflect the depth of a true digital twin—concise, courageous, and profoundly helpful.
                """

            if current_turn > 0:
                human_content = f"Refine your previous recommendation for: '{task}'\nPrevious: {recommendations.get(persona, '')}"
            else:
                human_content = f"Provide a recommendation for: '{task}'"

            # Use Gemini directly without LangChain wrapper
            ensure_genai_configured()
            chat_model = genai.GenerativeModel(MODEL)
            response = chat_model.generate_content(
                f"{system_prompt}\n\n{human_content}",
                generation_config=genai.GenerationConfig(temperature=TEMP))
            recommendation = Markup(markdown.markdown(response.text))
            print(f"[{persona}] Recommendation completed!")
            return {"recommendations": {persona: recommendation}}
        except Exception as e:
            print(f"Error in recommend_{persona}: {e}")
            return {
                "recommendations": {
                    persona: f"Fallback recommendation for {persona}"
                }
            }

    return agent_node


# Update Memory Node - Stores in ChromaDB VectorDB
def update_memory_node(state):
    """Store agent recommendations in ChromaDB vector database"""
    try:
        # AgentState is TypedDict, access as dict
        run_id = state.get("run_id", str(uuid.uuid4()))
        user_id = state.get("user_id", "system")
        recommendations = state.get("recommendations", {})
        task = state.get("task", "")
        agents = state.get("agents", [])

        for persona in agents:
            recommendation = recommendations.get(persona, "")
            if recommendation:
                # Store recommendation as memory in ChromaDB
                store_chat_message(
                    agent_name=persona,
                    run_id=run_id,
                    user_id=user_id,
                    message=f"Strategy for '{task}': {recommendation[:500]}...",
                    sender="agent",
                    metadata={
                        "type": "recommendation",
                        "task": task
                    })
                print(f"[{persona}] Memory stored in VectorDB")
    except Exception as e:
        print(f"Error updating VectorDB memory: {e}")

    return state


# Run Meeting with LangGraph - Uses ChromaDB VectorDB Memory
def run_meeting(task: str,
                user_profile: str = "",
                turns: int = TURNS,
                agents: List[str] | None = None,
                user_id: str = "system",
                meeting_type: str = "board") -> Dict:
    if not agents:
        agents = list(PERSONAS.keys())

    graph = StateGraph(AgentState)

    recommend_nodes = []
    for persona in agents:
        try:
            agent_node = create_agent_node(persona)
        except ValueError as e:
            # Invalid agent identifier
            print(f"ERROR: Invalid agent '{persona}': {e}")
            return {
                "error": f"Invalid agent identifier: {persona}",
                "status": "failed"
            }
        
        recommend_node_name = f"recommend_{persona}"
        graph.add_node(recommend_node_name, agent_node)
        recommend_nodes.append(recommend_node_name)

    graph.add_node("update_memory", update_memory_node)
    graph.add_node("start_recommend", lambda state: state)
    graph.add_edge(START, "start_recommend")

    for r_node in recommend_nodes:
        graph.add_edge("start_recommend", r_node)

    graph.add_node("after_recommend", lambda state: state)
    for r_node in recommend_nodes:
        graph.add_edge(r_node, "after_recommend")

    def increment_turn(state):
        current = state.get("current_turn", 0)
        return {"current_turn": current + 1}

    graph.add_node("increment", increment_turn)
    graph.add_edge("after_recommend", "increment")

    def decide_to_continue(state):
        current_turn = state.get("current_turn", 0)
        turns = state.get("turns", 1)
        return "continue" if current_turn < turns else "end"

    graph.add_conditional_edges("increment", decide_to_continue, {
        "continue": "start_recommend",
        "end": "update_memory"
    })

    graph.add_edge("update_memory", END)

    app_graph = graph.compile()

    # Generate run ID
    run_id = str(uuid.uuid4())

    initial_state = {
        "messages": [],
        "recommendations": {},
        "task": task,
        "user_profile": user_profile,
        "current_turn": 0,
        "agents": agents,
        "turns": turns,
        "run_id": run_id,
        "user_id": user_id,
        "meeting_type": meeting_type
    }

    print(f"🚀 Starting meeting with {len(agents)} agents, {turns} turn(s)...")
    final_state = app_graph.invoke(initial_state)
    print(f"✅ Meeting completed! Run ID: {run_id}")
    # Save run to JSON file (for Node.js compatibility)
    os.makedirs(RUNS_DIR, exist_ok=True)
    run_path = os.path.join(RUNS_DIR, f"run_{run_id}.json")
    with open(run_path, "w") as f:
        json.dump(
            {
                "task": task,
                "user_profile": user_profile,
                "turns": turns,
                "agents": agents,
                "recommendations": final_state["recommendations"]
            },
            f,
            indent=2)

    return {
        "run_id": run_id,
        "recommendations": final_state["recommendations"]
    }
