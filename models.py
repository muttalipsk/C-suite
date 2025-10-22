
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from langchain_core.messages import BaseMessage

class ChatInput(BaseModel):
    run_id: str
    agent: str
    message: str

class MeetingInput(BaseModel):
    task: str
    user_profile: str = ""
    turns: int = 1
    agents: Optional[List[str]] = None

class AgentState(BaseModel):
    messages: List[BaseMessage] = []
    recommendations: Dict[str, str] = {}
    task: str
    user_profile: str
    current_turn: int
    agents: List[str]
    turns: int
    
    class Config:
        arbitrary_types_allowed = True
