"""
Pre-Meeting Counter-Questioning System
Evaluates question accuracy using vector DB and generates counter-questions
"""

import google.generativeai as genai
from typing import List, Dict, Tuple
from utils import retrieve_relevant_chunks
from constants import TEMP, INDEX_DIR, CORPUS_DIR, PERSONAS
from chat_vectordb import ensure_genai_configured

# Note: Accuracy-based evaluation removed. Now using AI decision-making via evaluate_readiness_with_ai


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
    
    # Create evaluation prompt - BE DECISIVE, don't over-gather information
    evaluation_prompt = f"""You are evaluating whether enough information has been gathered for a strategic advisory meeting.

Initial Question: {question}

Selected Advisors: {', '.join(agents)}

User Profile:
{user_profile}

Conversation History:
{conversation_context}

IMPORTANT INSTRUCTIONS:
- Strategic advisors can work with MINIMAL information and still provide valuable insights
- If you have BASIC context about what the user wants, respond with "READY"
- Only respond with "CONTINUE" if the question is completely unclear or missing critical details
- After 1-2 conversation turns, you should almost ALWAYS be ready
- Don't require perfect information - basic understanding is enough

Your task: Determine if we have enough context to run a productive strategic advisory meeting.

Quick checklist:
1. Do we understand what the user is asking about? (Yes/No)
2. Is there ANY context about their situation? (Yes/No)

If BOTH are "Yes" → Respond "READY"
If either is "No" → Respond "CONTINUE"

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
        # Fallback: After 2 conversation turns (1 question + 1 answer), proceed
        return len(conversation_history) >= 2  # 1 user + 1 assistant message is enough




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

Your goal is to ask ONE brief, natural follow-up question ONLY if something CRITICAL is missing.

Initial Question: {question}

User Profile:
{user_profile}

Conversation History:
{conversation_context}

Information Coverage:
{chr(10).join(f'- {area.title()}: {"✓ Mentioned" if covered else "✗ Not discussed"}' for area, covered in information_coverage.items())}

CRITICAL INSTRUCTIONS:
- Only ask about the MOST IMPORTANT missing piece of information
- Don't try to gather every detail - advisors can work with minimal context
- Ask like ChatGPT would - brief, natural, conversational
- Keep it to ONE short question (1 sentence max)
- Don't mention "accuracy" or percentages
- Focus on what's absolutely essential to understand the user's need

Generate ONE brief follow-up question:"""
    
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
