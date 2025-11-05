"""
Pre-Meeting Counter-Questioning System
Evaluates question accuracy using vector DB and generates counter-questions
"""

import google.generativeai as genai
from typing import List, Dict, Tuple
from utils import retrieve_relevant_chunks
from constants import TEMP, INDEX_DIR, CORPUS_DIR, PERSONAS
from chat_vectordb import ensure_genai_configured

# Accuracy threshold to consider question ready for meeting
ACCURACY_THRESHOLD = 0.80

# Weights for accuracy calculation
SEMANTIC_WEIGHT = 0.6  # Weight for semantic similarity to knowledge base
SLOT_COVERAGE_WEIGHT = 0.4  # Weight for key information slots filled

def calculate_semantic_accuracy(question: str, agents: List[str], conversation_history: List[Dict[str, str]]) -> float:
    """
    Calculate semantic accuracy by checking if the question has relevant context
    in the agents' knowledge bases using vector DB retrieval.
    
    Returns: float between 0 and 1
    """
    # Combine initial question with conversation context
    full_context = question
    for turn in conversation_history:
        if turn.get("role") == "user":
            full_context += " " + turn.get("content", "")
    
    total_relevance = 0.0
    agent_count = len(agents)
    
    if agent_count == 0:
        return 0.0
    
    for agent in agents:
        if agent not in PERSONAS:
            continue
            
        try:
            # Retrieve relevant chunks from agent's knowledge base
            # Using top 3 chunks to evaluate relevance
            relevant_chunks = retrieve_relevant_chunks(
                agent, 
                full_context, 
                CORPUS_DIR,
                INDEX_DIR, 
                top_k=3
            )
            
            # If we found relevant chunks, this agent has context
            if relevant_chunks and len(relevant_chunks) > 0:
                # Simple relevance score: 1.0 if we found chunks, scaled by number found
                chunk_score = min(len(relevant_chunks) / 3.0, 1.0)
                total_relevance += chunk_score
            
        except Exception as e:
            print(f"Error retrieving chunks for {agent}: {e}")
            continue
    
    # Average relevance across all agents
    semantic_score = total_relevance / agent_count
    return min(semantic_score, 1.0)


def calculate_slot_coverage(conversation_history: List[Dict[str, str]]) -> float:
    """
    Calculate how many key information slots have been filled through conversation.
    Key slots: context, goals, constraints, timeline, stakeholders
    
    Returns: float between 0 and 1
    """
    # Extract all user messages from conversation
    user_messages = " ".join([
        turn.get("content", "") 
        for turn in conversation_history 
        if turn.get("role") == "user"
    ]).lower()
    
    # Define key information slots to check
    slot_keywords = {
        "context": ["background", "context", "currently", "situation", "working on"],
        "goals": ["goal", "objective", "want to", "trying to", "aim to", "achieve"],
        "constraints": ["constraint", "limitation", "cannot", "must not", "restricted"],
        "timeline": ["timeline", "deadline", "by when", "timeframe", "schedule"],
        "stakeholders": ["team", "stakeholder", "customer", "user", "client"],
    }
    
    filled_slots = 0
    total_slots = len(slot_keywords)
    
    for slot, keywords in slot_keywords.items():
        # Check if any keyword for this slot appears in user messages
        if any(keyword in user_messages for keyword in keywords):
            filled_slots += 1
    
    return filled_slots / total_slots


def evaluate_readiness_with_ai(
    question: str, 
    agents: List[str], 
    conversation_history: List[Dict[str, str]],
    user_profile: str
) -> bool:
    """
    Use AI to decide if enough information has been gathered to proceed with the meeting.
    Returns: is_ready_for_meeting (boolean)
    """
    ensure_genai_configured()
    
    # Build conversation context
    conversation_context = "\n".join([
        f"{turn.get('role', 'unknown').upper()}: {turn.get('content', '')}"
        for turn in conversation_history
    ])
    
    # Create evaluation prompt
    evaluation_prompt = f"""You are evaluating whether enough information has been gathered for a strategic advisory meeting.

Initial Question: {question}

Selected Advisors: {', '.join(agents)}

User Profile:
{user_profile}

Conversation History:
{conversation_context}

Your task: Determine if we have enough context to run a productive strategic advisory meeting.

Consider:
1. Do we understand the user's current situation/context?
2. Are their goals and desired outcomes clear?
3. Have any key constraints or limitations been mentioned?
4. Is there enough detail for advisors to provide specific, actionable recommendations?

Respond with ONLY ONE WORD:
- "READY" if enough information has been gathered
- "CONTINUE" if more context is needed

Decision:"""
    
    try:
        model = genai.GenerativeModel("gemini-2.0-flash-exp")
        response = model.generate_content(
            evaluation_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.3,  # Lower temperature for more consistent decisions
                max_output_tokens=10,
            )
        )
        
        decision = response.text.strip().upper()
        is_ready = "READY" in decision
        
        print(f"AI Readiness Evaluation:")
        print(f"  Decision: {decision}")
        print(f"  Ready for meeting: {is_ready}")
        
        return is_ready
        
    except Exception as e:
        print(f"Error evaluating readiness: {e}")
        # Fallback: require at least 2 conversation turns
        return len(conversation_history) >= 4  # 2 user + 2 assistant messages


def evaluate_accuracy(
    question: str, 
    agents: List[str], 
    conversation_history: List[Dict[str, str]]
) -> Tuple[float, bool]:
    """
    DEPRECATED: Legacy function for backward compatibility.
    Now returns dummy accuracy score since we use AI decision-making.
    
    Returns: (dummy_accuracy, is_ready_for_meeting)
    """
    # Return a dummy accuracy value since we don't use it anymore
    return 0.5, False


def generate_counter_question(
    question: str,
    agents: List[str],
    conversation_history: List[Dict[str, str]],
    user_profile: str,
    _dummy_accuracy: float = 0.0  # Kept for backward compatibility but not used
) -> str:
    """
    Generate a conversational counter-question to gather missing information.
    Uses Gemini to create natural follow-up questions like ChatGPT.
    """
    ensure_genai_configured()
    
    # Build conversation context
    conversation_context = "\n".join([
        f"{turn.get('role', 'unknown').upper()}: {turn.get('content', '')}"
        for turn in conversation_history
    ])
    
    # Identify which information areas might need more detail
    user_messages = " ".join([
        turn.get("content", "") 
        for turn in conversation_history 
        if turn.get("role") == "user"
    ]).lower()
    
    # Check what areas have been covered
    information_coverage = {
        "context": any(keyword in user_messages for keyword in ["background", "context", "currently", "situation", "working on"]),
        "goals": any(keyword in user_messages for keyword in ["goal", "objective", "want to", "trying to", "aim to", "achieve"]),
        "constraints": any(keyword in user_messages for keyword in ["constraint", "limitation", "cannot", "must not", "restricted", "budget"]),
        "timeline": any(keyword in user_messages for keyword in ["timeline", "deadline", "by when", "timeframe", "schedule", "month", "year"]),
        "stakeholders": any(keyword in user_messages for keyword in ["team", "stakeholder", "customer", "user", "client", "officer"]),
    }
    
    # Create system prompt for natural counter-question generation
    system_prompt = f"""You are a helpful assistant preparing for a strategic advisory meeting with {', '.join(agents)}.

Your goal is to ask ONE natural, conversational follow-up question to better understand the user's needs.

Initial Question: {question}

User Profile:
{user_profile}

Conversation History:
{conversation_context}

Information Coverage:
{chr(10).join(f'- {area.title()}: {"✓ Mentioned" if covered else "✗ Not discussed"}' for area, covered in information_coverage.items())}

Guidelines:
- Ask like ChatGPT would - natural and conversational
- Focus on ONE specific aspect that needs clarification
- Make it relevant to getting better recommendations from {', '.join(agents)}
- Keep it concise (1-2 sentences)
- Don't mention "accuracy" or percentages
- Be empathetic and professional

Generate a natural follow-up question:"""
    
    try:
        model = genai.GenerativeModel("gemini-2.0-flash-exp")
        response = model.generate_content(
            system_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.8,  # Higher for more natural variation
                max_output_tokens=150,
            )
        )
        
        counter_question = response.text.strip()
        
        # Remove any quotes that might wrap the question
        counter_question = counter_question.strip('"').strip("'")
        
        return counter_question
        
    except Exception as e:
        print(f"Error generating counter-question: {e}")
        # Fallback to natural questions
        if not information_coverage["context"]:
            return "Could you tell me a bit more about your current situation and what you're working on?"
        elif not information_coverage["goals"]:
            return "What specific outcomes are you hoping to achieve with this?"
        elif not information_coverage["timeline"]:
            return "What's your timeframe for making progress on this initiative?"
        else:
            return "Is there anything specific you'd like the advisors to focus on?"
