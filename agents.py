
from typing import Dict, List
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph import StateGraph, START, END
from models import AgentState
from constants import PERSONAS, MODEL, GEMINI_KEY, TEMP, MEMORY_DIR, RUNS_DIR, TURNS
import constants
from utils import load_knowledge, retrieve_relevant_chunks, load_memory, merge_recommendations
from langchain_google_genai import ChatGoogleGenerativeAI
import json
import os

llm = ChatGoogleGenerativeAI(model=MODEL, google_api_key=GEMINI_KEY, temperature=TEMP)

# Agent Node Factory
def create_agent_node(persona: str):
    knowledge = load_knowledge(persona)
    company = PERSONAS[persona]["company"]
    role = PERSONAS[persona]["role"]
    description = PERSONAS[persona]["description"]
    
    def agent_node(state: AgentState):
        try:
            print(f"Recommend node {persona} starting...")
            task = state.task
            user_profile = state.user_profile or "No specific user profile provided; provide general advice."
            relevant_chunks = retrieve_relevant_chunks(persona, task, constants.CORPUS_DIR, constants.INDEX_DIR)
            memory = load_memory(persona, MEMORY_DIR)
            system_prompt = f"""
You are {persona} from {company}, acting in your {role}: {description}. You are serving as a moderator and advisor to C-suite level executives. They seek your help for strategies after board meetings, client meetings, or personal doubts.

Your goal is to provide tailored recommendations based on your point of view and expertise.

Base your response on:
- Knowledge: {knowledge}
- Relevant writings: {relevant_chunks}
- Recent memory: {memory}
- User Profile: {user_profile}

Output Format:
1. **Summary**: A brief overview of the recommended strategy
2. **Key Recommendations**: 3-5 bullet points with specific, actionable steps
3. **Rationale**: Explain why this strategy fits
4. **Next Steps**: Any follow-up actions or considerations
"""
            
            if state.current_turn > 0:
                human_content = f"Refine your previous recommendation for: '{task}'\nPrevious: {state.recommendations.get(persona, '')}"
            else:
                human_content = f"Provide a recommendation for: '{task}'"
                
            prompt = ChatPromptTemplate.from_messages([
                SystemMessage(content=system_prompt),
                HumanMessage(content=human_content)
            ])
            response = llm.invoke(prompt.format_messages())
            recommendation = response.content
            print(f"Recommend {persona} success.")
            return {"recommendations": {persona: recommendation}}
        except Exception as e:
            print(f"Error in recommend_{persona}: {e}")
            return {"recommendations": {persona: f"Fallback recommendation for {persona}"}}
    
    return agent_node

# Update Memory Node
def update_memory_node(state: AgentState):
    for persona in state.agents:
        memory_file = os.path.join(MEMORY_DIR, f"{persona}_memory.txt")
        recommendation = state.recommendations.get(persona, "")
        with open(memory_file, "a") as f:
            f.write(f"Recommendation for '{state.task}': {recommendation}\n")
    return state

# Run Meeting with LangGraph
def run_meeting(task: str, user_profile: str = "", turns: int = TURNS, agents: List[str] = None) -> Dict:
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
    
    graph.add_node("increment", lambda state: {"current_turn": state.current_turn + 1})
    graph.add_edge("after_recommend", "increment")
    
    def decide_to_continue(state: AgentState):
        return "continue" if state.current_turn < state.turns else "end"
    
    graph.add_conditional_edges(
        "increment",
        decide_to_continue,
        {"continue": "start_recommend", "end": "update_memory"}
    )
    
    graph.add_edge("update_memory", END)
    
    app_graph = graph.compile()
    
    initial_state = AgentState(
        messages=[],
        recommendations={},
        task=task,
        user_profile=user_profile,
        current_turn=0,
        agents=agents,
        turns=turns
    )
    final_state = app_graph.invoke(initial_state.dict())
    
    run_id = str(len(os.listdir(RUNS_DIR)) + 1) if os.path.exists(RUNS_DIR) else "1"
    run_path = os.path.join(RUNS_DIR, f"run_{run_id}.json")
    with open(run_path, "w") as f:
        json.dump({
            "task": task,
            "user_profile": user_profile,
            "recommendations": final_state["recommendations"]
        }, f)
    
    return {"run_id": run_id, "recommendations": final_state["recommendations"]}
