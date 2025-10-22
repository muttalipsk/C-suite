from typing import List, Dict, Annotated, TypedDict
from pydantic import BaseModel
from langgraph.graph.message import add_messages 
from utils import merge_recommendations

class AgentState(TypedDict):
    messages: Annotated[List, add_messages]
    recommendations: Annotated[Dict[str, str], merge_recommendations]  # Reference to utils.merge_recommendations
    task: str
    user_profile: str
    current_turn: int
    agents: List[str]
    turns: int

class ChatInput(BaseModel):
    run_id: str
    agent: str
    message: str

class ChatMessage(BaseModel):
    user: str
    agent: str 

# New: For /meeting endpoint (accepts JSON body)
class MeetingInput(BaseModel):
    task: str
    user_profile: str = ""  # Optional, defaults to empty
    turns: int = 1  # Optional, defaults to 1 (or import TURNS from constants if preferred)
    agents: List[str] = []  # Optional list; defaults to all personas in the endpoint