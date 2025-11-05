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


def evaluate_accuracy(
    question: str, 
    agents: List[str], 
    conversation_history: List[Dict[str, str]]
) -> Tuple[float, bool]:
    """
    Evaluate overall accuracy of the question based on:
    1. Semantic similarity to agent knowledge bases (60%)
    2. Coverage of key information slots (40%)
    
    Returns: (accuracy_score, is_ready_for_meeting)
    """
    semantic_score = calculate_semantic_accuracy(question, agents, conversation_history)
    slot_coverage = calculate_slot_coverage(conversation_history)
    
    # Weighted combination
    overall_accuracy = (semantic_score * SEMANTIC_WEIGHT) + (slot_coverage * SLOT_COVERAGE_WEIGHT)
    
    # Check if ready for meeting
    is_ready = overall_accuracy >= ACCURACY_THRESHOLD
    
    print(f"Accuracy Evaluation:")
    print(f"  Semantic Score: {semantic_score:.2f}")
    print(f"  Slot Coverage: {slot_coverage:.2f}")
    print(f"  Overall Accuracy: {overall_accuracy:.2f}")
    print(f"  Ready: {is_ready}")
    
    return overall_accuracy, is_ready


def generate_counter_question(
    question: str,
    agents: List[str],
    conversation_history: List[Dict[str, str]],
    user_profile: str,
    current_accuracy: float
) -> str:
    """
    Generate a counter-question to gather missing information.
    Uses Gemini to create contextual follow-up questions.
    """
    ensure_genai_configured()
    
    # Build conversation context
    conversation_context = "\n".join([
        f"{turn.get('role', 'unknown').upper()}: {turn.get('content', '')}"
        for turn in conversation_history
    ])
    
    # Identify which slots are missing
    user_messages = " ".join([
        turn.get("content", "") 
        for turn in conversation_history 
        if turn.get("role") == "user"
    ]).lower()
    
    missing_slots = []
    slot_keywords = {
        "context": ["background", "context", "currently", "situation"],
        "goals": ["goal", "objective", "want to", "trying to"],
        "constraints": ["constraint", "limitation", "cannot", "must not"],
        "timeline": ["timeline", "deadline", "by when", "timeframe"],
        "stakeholders": ["team", "stakeholder", "customer", "user"],
    }
    
    for slot, keywords in slot_keywords.items():
        if not any(keyword in user_messages for keyword in keywords):
            missing_slots.append(slot)
    
    # Create system prompt for counter-question generation
    system_prompt = f"""You are an executive assistant helping to gather information before a strategic advisory meeting.

The user wants to consult with: {', '.join(agents)}

Current question: {question}

User profile:
{user_profile}

Conversation so far:
{conversation_context}

Current accuracy: {current_accuracy * 100:.0f}%
Missing information areas: {', '.join(missing_slots) if missing_slots else 'None - focus on depth'}

Your task: Ask ONE focused counter-question to gather the most critical missing information.

Guidelines:
- Be conversational and professional
- Focus on strategic context, not technical details
- Ask about the most important missing piece
- Keep it concise (1-2 sentences max)
- Make it specific to their situation
- Don't ask multiple questions at once

Generate the counter-question:"""
    
    try:
        model = genai.GenerativeModel("gemini-2.0-flash-exp")
        response = model.generate_content(
            system_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.7,
                max_output_tokens=200,
            )
        )
        
        counter_question = response.text.strip()
        
        # Remove any quotes that might wrap the question
        counter_question = counter_question.strip('"').strip("'")
        
        return counter_question
        
    except Exception as e:
        print(f"Error generating counter-question: {e}")
        # Fallback counter-question
        if "context" in missing_slots:
            return "Could you provide more background on your current situation?"
        elif "goals" in missing_slots:
            return "What specific outcomes are you hoping to achieve?"
        elif "timeline" in missing_slots:
            return "What's your timeframe for making progress on this?"
        else:
            return "Could you elaborate on any specific challenges you're facing?"
