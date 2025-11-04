
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Annotated
from langchain_core.messages import BaseMessage
from typing_extensions import TypedDict
import operator

class ChatInput(BaseModel):
    run_id: str
    agent: str
    message: str
    user_id: str

class MeetingInput(BaseModel):
    task: str
    user_profile: str = ""
    turns: int = 1
    agents: Optional[List[str]] = None
    user_id: str = "system"
    meeting_type: str = "board"  # board, email, chat (general)

class QuestionRefinementInput(BaseModel):
    question: str
    agents: List[str]  # Now accepts multiple agents
    run_id: Optional[str] = None

# Define a merge function for dictionaries
def merge_dicts(left: Dict[str, str], right: Dict[str, str]) -> Dict[str, str]:
    """Merge two dictionaries, with right taking precedence"""
    return {**left, **right}

class AgentState(TypedDict):
    messages: Annotated[List[BaseMessage], operator.add]
    recommendations: Annotated[Dict[str, str], merge_dicts]
    task: str
    user_profile: str
    current_turn: int
    agents: List[str]
    turns: int
    meeting_type: str
