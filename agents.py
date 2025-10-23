
from typing import Dict, List
from langgraph.graph import StateGraph, START, END
from models import AgentState
from constants import PERSONAS, MODEL, GEMINI_KEY, TEMP, MEMORY_DIR, RUNS_DIR, TURNS, CORPUS_DIR, INDEX_DIR
from utils import load_knowledge, retrieve_relevant_chunks, load_memory_from_vectordb, merge_recommendations
from chat_vectordb import store_chat_message
import json
import os
import uuid
import google.generativeai as genai

# Agent Node Factory - Uses ChromaDB VectorDB Memory
def create_agent_node(persona: str):
    company = PERSONAS[persona]["company"]
    role = PERSONAS[persona]["role"]
    description = PERSONAS[persona]["description"]
    
    def agent_node(state: AgentState):
        try:
            print(f"[{persona}] Starting recommendation with VectorDB memory...")
            task = state["task"]
            user_profile = state["user_profile"] or "No specific user profile provided; provide general advice."
            
            # Retrieve relevant chunks from knowledge base
            relevant_chunks = retrieve_relevant_chunks(persona, task, CORPUS_DIR, INDEX_DIR)
            
            # Load agent memory from ChromaDB vector database
            vectordb_memory = load_memory_from_vectordb(persona, limit=5)
            
            system_prompt = f"""
You are {persona} from {company}, acting in your {role}: {description}. You are serving as a moderator and advisor to C-suite level executives. They seek your help for strategies after board meetings, client meetings, or personal doubts.

Your goal is to provide tailored recommendations based on your point of view and expertise. Think as if you are in the user's place.

Base your response on:
- Relevant writings: {relevant_chunks}
- Your recent memories from VectorDB: {vectordb_memory}
- User Profile: {user_profile}

Output Format:
1. **Summary**: A brief overview of the recommended strategy
2. **Key Recommendations**: 3-5 bullet points with specific, actionable steps
3. **Rationale**: Explain why this strategy fits
4. **Next Steps**: Any follow-up actions or considerations
"""
            
            if state["current_turn"] > 0:
                human_content = f"Refine your previous recommendation for: '{task}'\nPrevious: {state['recommendations'].get(persona, '')}"
            else:
                human_content = f"Provide a recommendation for: '{task}'"
            
            # Use Gemini directly without LangChain wrapper
            chat_model = genai.GenerativeModel(MODEL)
            response = chat_model.generate_content(
                f"{system_prompt}\n\n{human_content}",
                generation_config=genai.GenerationConfig(temperature=TEMP)
            )
            recommendation = response.text
            print(f"[{persona}] Recommendation completed!")
            return {"recommendations": {persona: recommendation}}
        except Exception as e:
            print(f"Error in recommend_{persona}: {e}")
            return {"recommendations": {persona: f"Fallback recommendation for {persona}"}}
    
    return agent_node

# Update Memory Node - Stores in ChromaDB VectorDB
def update_memory_node(state: AgentState):
    """Store agent recommendations in ChromaDB vector database"""
    try:
        run_id = state.get("run_id", str(uuid.uuid4()))
        user_id = state.get("user_id", "system")
        
        for persona in state["agents"]:
            recommendation = state["recommendations"].get(persona, "")
            if recommendation:
                # Store recommendation as memory in ChromaDB
                store_chat_message(
                    agent_name=persona,
                    run_id=run_id,
                    user_id=user_id,
                    message=f"Strategy for '{state['task']}': {recommendation[:500]}...",
                    sender="agent",
                    metadata={"type": "recommendation", "task": state["task"]}
                )
                print(f"[{persona}] Memory stored in VectorDB")
    except Exception as e:
        print(f"Error updating VectorDB memory: {e}")
    
    return state

# Run Meeting with LangGraph - Uses ChromaDB VectorDB Memory
def run_meeting(task: str, user_profile: str = "", turns: int = TURNS, agents: List[str] = None, user_id: str = "system") -> Dict:
    if not agents:
        agents = list(PERSONAS.keys())
    
    graph = StateGraph(AgentState)
    
    recommend_nodes = []
    for persona in agents:
        agent_node = create_agent_node(persona)
        recommend_node_name = f"recommend_{persona}"
        graph.add_node(recommend_node_name, agent_node)
        recommend_nodes.append(recommend_node_name)
    
    graph.add_node("update_memory", update_memory_node)
    graph.add_node("start_recommend", lambda s: s)
    graph.add_edge(START, "start_recommend")
    
    for r_node in recommend_nodes:
        graph.add_edge("start_recommend", r_node)
    
    graph.add_node("after_recommend", lambda s: s)
    for r_node in recommend_nodes:
        graph.add_edge(r_node, "after_recommend")
    
    graph.add_node("increment", lambda state: {"current_turn": state["current_turn"] + 1})
    graph.add_edge("after_recommend", "increment")
    
    def decide_to_continue(state: AgentState):
        return "continue" if state["current_turn"] < state["turns"] else "end"
    
    graph.add_conditional_edges(
        "increment",
        decide_to_continue,
        {"continue": "start_recommend", "end": "update_memory"}
    )
    
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
        "user_id": user_id
    }
    
    print(f"🚀 Starting meeting with {len(agents)} agents, {turns} turn(s)...")
    final_state = app_graph.invoke(initial_state)
    print(f"✅ Meeting completed! Run ID: {run_id}")
    # Save run to JSON file (for Node.js compatibility)
    os.makedirs(RUNS_DIR, exist_ok=True)
    run_path = os.path.join(RUNS_DIR, f"run_{run_id}.json")
    with open(run_path, "w") as f:
        json.dump({
            "task": task,
            "user_profile": user_profile,
            "turns": turns,
            "agents": agents,
            "recommendations": final_state["recommendations"]
        }, f, indent=2)
    
    return {"run_id": run_id, "recommendations": final_state["recommendations"]}
