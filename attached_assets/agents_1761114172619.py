from typing import Dict, List
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph import StateGraph, START, END
from models import AgentState
from constants import PERSONAS, MODEL, GEMINI_KEY, TEMP, MEMORY_DIR, RUNS_DIR,TURNS
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
            task = state["task"]
            user_profile = state["user_profile"] or "No specific user profile provided; provide general advice."
            relevant_chunks = retrieve_relevant_chunks(persona, task, CORPUS_DIR=constants.CORPUS_DIR, INDEX_DIR=constants.INDEX_DIR)
            memory = load_memory(persona, MEMORY_DIR)
            system_prompt = f"""
You are {persona} from {company}, acting in your {role}: {description}. You are also serving as a moderator and advisor to C-suite level executives. They seek your help for strategies after board meetings, client meetings, or personal doubts. Users may share details from meetings, emails, or chats, and you will respond with the best of your knowledge in an unbiased manner, providing balanced, insightful recommendations.

Your goal is to provide tailored recommendations based on your point of view and expertise. Think as if you are in the user's place: What should your strategy be if you were facing this situation? Draw from your experiences to offer practical, unbiased advice that helps the user navigate challenges and opportunities.

---
Key Instructions:
- Always base your recommendation or strategy directly on the user's query ('{task}'), their role, goals, and any other details in the User Profile (e.g., company, meetings shared, doubts).
- Remain unbiased: Present pros, cons, and balanced perspectives without favoritism.
- Think step-by-step: 1) Analyze the query, profile, and any shared context (e.g., meetings or emails). 2) Draw relevant insights from your knowledge, writings, and memory. 3) Formulate a strategy as if you were in the user's role, aligning with your expertise.
- Handle uncertainties: If information is missing (e.g., no profile details), make reasonable assumptions based on common C-suite scenarios and note them.
- Avoid pitfalls: No generic advice; ensure personalization. Stay focused on strategic help—do not digress into unrelated topics.
- For post-meeting advice: If the query involves a board/client meeting, address key outcomes, risks, and next steps impartially.

---
Base your response on:
- Knowledge: {knowledge}
- Relevant writings: {relevant_chunks}
- Recent memory: {memory}
- User Profile: {user_profile}

---
Output Format (structure your response exactly like this for clarity and actionability):
1. **Summary**: A brief, unbiased overview of the recommended strategy, tailored to the user's query, role, and context.
2. **Key Recommendations**: 3-5 bullet points with specific, actionable steps, thinking as if you were in the user's place.
3. **Rationale and Balance**: Explain why this strategy fits, including pros/cons, drawing from your expertise and unbiased view.
4. **Next Steps or Considerations**: Any follow-up actions, potential risks, or questions to clarify doubts.
"""
            
            if state["current_turn"] > 0:
                human_content = f"""
Refine your previous recommendation for the query '{task}' through self-reflection:
- Step-by-step: 1) Review what worked and didn't in the previous version. 2) Improve personalization to the user's role, profile, and any shared meeting/doubt context. 3) Enhance alignment with your expertise while maintaining an unbiased moderator perspective.
- Previous recommendation: {state['recommendations'].get(persona, '')}
- Output in the same structured format.
"""
            else:
                human_content = f"Provide a recommendation for the query: '{task}', based on the user's role and profile. In your point of view, what should your strategy be if you are in the user's place."
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
            return {"recommendations": {persona: f"Fallback recommendation for {persona}: Focus on {role} strategy in AI business, tailored to user profile."}}
    
    return agent_node

# Update Memory Node
def update_memory_node(state: AgentState):
    for persona in state["agents"]:
        memory_file = os.path.join(MEMORY_DIR, f"{persona}_memory.txt")
        recommendation = state["recommendations"].get(persona, "")
        with open(memory_file, "a") as f:
            f.write(f"Recommendation for '{state['task']}': {recommendation}\n")
    return state

# Run Meeting with LangGraph
def run_meeting(task: str, user_profile: str = "", turns: int = TURNS, agents: List[str] = list(PERSONAS.keys())) -> Dict:
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
    
    # Add start node for fanout
    graph.add_node("start_recommend", lambda s: s)
    graph.add_edge(START, "start_recommend")
    
    # Fanout to all recommend nodes
    for r_node in recommend_nodes:
        graph.add_edge("start_recommend", r_node)
    
    # Join after all recommends
    graph.add_node("after_recommend", lambda s: s)
    for r_node in recommend_nodes:
        graph.add_edge(r_node, "after_recommend")
    
    # Increment turn
    graph.add_node("increment", lambda state: {"current_turn": state["current_turn"] + 1})
    graph.add_edge("after_recommend", "increment")
    
    # Conditional for continuing
    def decide_to_continue(state: AgentState):
        if state["current_turn"] < state["turns"]:
            return "continue"
        else:
            return "end"
    
    graph.add_conditional_edges(
        "increment",
        decide_to_continue,
        {"continue": "start_recommend", "end": "update_memory"}
    )
    
    graph.add_edge("update_memory", END)
    
    # Compile graph
    app_graph = graph.compile()
    
    initial_state = {
        "messages": [],
        "recommendations": {},
        "task": task,
        "user_profile": user_profile,
        "current_turn": 0,
        "agents": agents,
        "turns": turns
    }
    final_state = app_graph.invoke(initial_state)
    
    # Save run
    run_id = str(len(os.listdir(RUNS_DIR)) + 1)
    run_path = os.path.join(RUNS_DIR, f"run_{run_id}.json")
    with open(run_path, "w") as f:
        json.dump({
            "task": task,
            "user_profile": user_profile,
            "recommendations": final_state["recommendations"]
        }, f)
    
    return {"run_id": run_id, "recommendations": final_state["recommendations"]}