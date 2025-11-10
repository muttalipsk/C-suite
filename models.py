
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
    enriched_context: Optional[Dict[str, Any]] = None

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

class PreMeetingEvaluationInput(BaseModel):
    session_id: str
    question: str
    agents: List[str]
    user_profile: str
    conversation_history: List[Dict[str, str]]
    meeting_type: str = "board"  # board, email, chat (general)

class ChatFollowupEvaluationInput(BaseModel):
    question: str
    agent: str
    user_profile: str
    meeting_type: str
    chat_history: List[Dict[str, str]]
    agent_recommendations: Optional[str] = None

class ChatFollowupCounterQuestionInput(BaseModel):
    question: str
    agent: str
    user_profile: str
    meeting_type: str
    chat_history: List[Dict[str, str]]
    agent_recommendations: Optional[str] = None
    previous_counter_questions: List[str] = []

class ScrapeWebsiteInput(BaseModel):
    company_url: str
    user_id: str

class GenerateMCQInput(BaseModel):
    user_id: str
    user_profile: Dict[str, Any]
    company_data: Dict[str, str]

class CreateDigitalTwinInput(BaseModel):
    user_id: str
    user_name: str  # Actual user name from profile
    mcq_answers: List[Dict[str, Any]]
    email_samples: Optional[str] = None
    documents: Optional[List[str]] = None

class GenerateMetadataInput(BaseModel):
    prompt: str
    temperature: float = 0.3

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
