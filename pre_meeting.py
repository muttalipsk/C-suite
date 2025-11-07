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
    user_profile: str,
    meeting_type: str = "board"
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
    
    # Context type descriptions
    context_descriptions = {
        "board": "a formal Board Meeting where executives need comprehensive strategic recommendations",
        "email": "an Email/Chat format requiring quick, actionable insights",
        "chat": "a General Strategy discussion for high-level guidance"
    }
    context_desc = context_descriptions.get(meeting_type, context_descriptions["board"])
    
    # Create evaluation prompt - gather comprehensive information over 3-4 questions
    evaluation_prompt = f"""You are evaluating whether enough information has been gathered for a strategic advisory meeting.

Context Type: {context_desc}

Initial Question: {question}

Selected Advisors: {', '.join(agents)}

User Profile:
{user_profile}

Conversation History:
{conversation_context}

IMPORTANT INSTRUCTIONS:
- Aim to gather comprehensive information through 3-4 thoughtful questions
- Strategic advisors need sufficient context to provide high-quality, tailored recommendations
- Only respond "READY" when you have a well-rounded understanding of the user's situation
- Consider asking about: context, goals, constraints, timeline, stakeholders, current challenges
- Meeting type is "{meeting_type}" - adjust depth of inquiry accordingly

Your task: Determine if we have enough context to run a productive strategic advisory meeting.

Comprehensive checklist - All should be addressed:
1. Context: Do we understand their current situation and what they're working on?
2. Goals: Are their desired outcomes and objectives clear?
3. Constraints: Have any limitations, budget, or resource constraints been mentioned?
4. Timeline: Do we know their timeframe or urgency?
5. Stakeholders: Do we understand who's involved or impacted?

Evaluation criteria:
- If 0-2 areas covered → "CONTINUE" (need more information)
- If 3 areas covered → "CONTINUE" (one more question to round out)
- If 4-5 areas covered → "READY" (sufficient information gathered)

Respond with ONLY ONE WORD:
- "READY" if enough comprehensive information has been gathered (4-5 areas)
- "CONTINUE" if more context is needed (0-3 areas)

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
        
        # Normalize decision: strip whitespace and punctuation, convert to uppercase
        import string
        decision = response.text.strip().upper()
        decision_normalized = decision.strip(string.punctuation + string.whitespace)
        
        # Strict comparison to avoid false positives (e.g., "CONTINUE - not ready yet")
        is_ready = decision_normalized == "READY"
        
        print(f"AI Readiness Evaluation:")
        print(f"  Decision: {decision}")
        print(f"  Ready for meeting: {is_ready}")
        
        return is_ready
        
    except Exception as e:
        print(f"Error evaluating readiness: {e}")
        # Fallback: After 6 conversation turns (3 questions + 3 answers), proceed
        return len(conversation_history) >= 6  # At least 3 Q&A pairs




def generate_counter_question(
    question: str,
    agents: List[str],
    conversation_history: List[Dict[str, str]],
    user_profile: str,
    meeting_type: str = "board",
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
    
    # Context type descriptions for tailored questions
    context_guidance = {
        "board": "Ask questions that help advisors provide comprehensive strategic recommendations for C-suite decision-making.",
        "email": "Ask concise questions to gather quick insights for email/chat format responses.",
        "chat": "Ask questions that help advisors provide high-level strategic guidance."
    }
    guidance = context_guidance.get(meeting_type, context_guidance["board"])
    
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

Meeting Type: {meeting_type.upper()} - {guidance}

Your goal is to ask ONE thoughtful, natural follow-up question to gather comprehensive information for the advisors.

Initial Question: {question}

User Profile:
{user_profile}

Conversation History:
{conversation_context}

Information Coverage:
{chr(10).join(f'- {area.title()}: {"✓ Mentioned" if covered else "✗ Not discussed"}' for area, covered in information_coverage.items())}

INSTRUCTIONS:
- Ask about the MOST IMPORTANT missing piece of information from the uncovered areas
- The advisors need comprehensive context: situation, goals, constraints, timeline, stakeholders
- Ask like ChatGPT would - natural, conversational, professional
- Keep it concise but meaningful (1-2 sentences)
- Don't mention "accuracy" or percentages
- Focus on gathering details that will help advisors provide specific, actionable recommendations
- Make it relevant to the expertise of {', '.join(agents)}
- Tailor your question depth to the "{meeting_type}" context type

Generate ONE thoughtful follow-up question:"""
    
    try:
        # Debug: Print API key status
        from constants import GEMINI_KEY
        print(f"[DEBUG generate_counter_question] API Key present: {bool(GEMINI_KEY)}, Length: {len(GEMINI_KEY) if GEMINI_KEY else 0}")
        
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
        import traceback
        print(f"Error generating counter-question: {e}")
        print(f"Full traceback: {traceback.format_exc()}")
        # Fallback to natural questions
        if not information_coverage["context"]:
            return "Could you tell me a bit more about your current situation and what you're working on?"
        elif not information_coverage["goals"]:
            return "What specific outcomes are you hoping to achieve with this?"
        elif not information_coverage["timeline"]:
            return "What's your timeframe for making progress on this initiative?"
        else:
            return "Is there anything specific you'd like the advisors to focus on?"
