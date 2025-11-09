"""
Chat Followup Counter-Questioning System
Intelligent counter-questioning during agent chat conversations
"""

import google.generativeai as genai
from typing import List, Dict, Optional
from chat_vectordb import ensure_genai_configured
from constants import TEMP


def evaluate_chat_question(
    question: str,
    agent: str,
    user_profile: str,
    meeting_type: str,
    chat_history: List[Dict[str, str]],
    agent_recommendations: Optional[str] = None
) -> bool:
    """
    Evaluate if a chat question has enough context or needs counter-questions.
    
    Returns: needs_counter_questions (boolean)
    """
    ensure_genai_configured()
    
    # Build chat context from history
    chat_context = "\n".join([
        f"{turn['sender'].upper()}: {turn['message']}"
        for turn in chat_history[-10:]  # Last 10 messages for context
    ])
    
    # Create evaluation prompt
    evaluation_prompt = f"""You are evaluating whether a user's question to an AI advisor needs clarification.

AI Advisor: {agent}

User's Question: {question}

User Profile:
{user_profile}

Meeting Type: {meeting_type}

Recent Chat History:
{chat_context}

{f"Agent's Previous Recommendations:{agent_recommendations}" if agent_recommendations else ""}

EVALUATION CRITERIA:

Answer DIRECTLY if:
- Question is specific and clear
- All necessary context is in the chat history or user profile
- The question is about something already recommended
- It's a simple follow-up to previous conversation

Ask COUNTER-QUESTIONS (1-2 max) if:
- Question is vague or ambiguous
- Missing critical details (what, when, why, how)
- Unclear scope or constraints
- Need to understand specific use case or scenario

Examples:
❌ "How should I implement this?" - TOO VAGUE (needs counter-questions)
✅ "How should I implement the database indexing you recommended for patient records?" - SPECIFIC (answer directly)
❌ "Which one should I choose?" - UNCLEAR (needs counter-questions)
✅ "Should I use PostgreSQL or MongoDB for the user authentication system?" - CLEAR (answer directly)

Respond with ONLY ONE WORD:
- "ANSWER" if the question has enough context to answer directly
- "CLARIFY" if counter-questions are needed

Decision:"""
    
    try:
        model = genai.GenerativeModel("gemini-2.0-flash-exp")
        response = model.generate_content(
            evaluation_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.3,
                max_output_tokens=10,
            )
        )
        
        import string
        decision = response.text.strip().upper()
        decision_normalized = decision.strip(string.punctuation + string.whitespace)
        
        needs_clarification = decision_normalized == "CLARIFY"
        
        print(f"Chat Question Evaluation:")
        print(f"  Question: {question}")
        print(f"  Decision: {decision}")
        print(f"  Needs clarification: {needs_clarification}")
        
        return needs_clarification
        
    except Exception as e:
        print(f"Error evaluating chat question: {e}")
        # Conservative fallback: Don't ask counter-questions on error
        return False


def generate_chat_counter_question(
    question: str,
    agent: str,
    user_profile: str,
    meeting_type: str,
    chat_history: List[Dict[str, str]],
    agent_recommendations: Optional[str] = None,
    previous_counter_questions: List[str] = []
) -> List[str]:
    """
    Generate 1-2 targeted counter-questions based on full context.
    Returns a list of questions (1-2 items).
    
    Uses:
    - User profile
    - Meeting type
    - Chat history
    - Agent's previous recommendations
    - Current question
    """
    ensure_genai_configured()
    
    # Build chat context
    chat_context = "\n".join([
        f"{turn['sender'].upper()}: {turn['message']}"
        for turn in chat_history[-10:]
    ])
    
    # Build previous counter-questions context
    previous_qs = "\n".join([f"- {q}" for q in previous_counter_questions]) if previous_counter_questions else "None"
    
    # Context type descriptions
    context_descriptions = {
        "board": "formal Board Meeting requiring strategic depth",
        "email": "Email/Chat format needing quick, actionable insights",
        "chat": "General Strategy discussion for high-level guidance"
    }
    context_desc = context_descriptions.get(meeting_type, context_descriptions["chat"])
    
    # Create prompt for counter-question generation
    system_prompt = f"""You are {agent}, an AI advisor helping a user in a chat conversation.

User Profile:
{user_profile}

Meeting Type: {context_desc}

Recent Chat History:
{chat_context}

{f'''Your Previous Recommendations to This User:
{agent_recommendations}

Remember what you recommended earlier - use this context to ask relevant follow-up questions.''' if agent_recommendations else ''}

User's New Question: {question}

Previously Asked Counter-Questions:
{previous_qs}

INSTRUCTIONS:
You need to ask 1-2 SPECIFIC clarifying questions to give a high-quality answer.

✅ Good Counter-Questions:
- "Are you asking about the database indexing I recommended for patient records, or about the API architecture?"
- "To clarify - do you want to implement this for your production system (10k users) or the pilot phase (100 users)?"
- "Are you focusing on the technical implementation details, or the business strategy and ROI?"

❌ Bad Counter-Questions:
- "Can you provide more details?" (too vague)
- "What do you mean?" (not specific)
- "Could you elaborate?" (not helpful)

Guidelines:
1. Maximum 1-2 questions only
2. Reference what you discussed earlier if relevant
3. Be specific about what you need to know
4. Make it easy for the user to answer
5. Keep it conversational and professional
6. Don't repeat questions already asked

Generate your counter-question(s):"""
    
    try:
        from constants import GEMINI_KEY
        print(f"[DEBUG generate_chat_counter_question] API Key present: {bool(GEMINI_KEY)}")
        
        model = genai.GenerativeModel("gemini-2.0-flash-exp")
        response = model.generate_content(
            system_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.7,
                max_output_tokens=200,
            )
        )
        
        counter_question_text = response.text.strip()
        counter_question_text = counter_question_text.strip('"').strip("'")
        
        # Parse multiple questions: split by numbered format (1., 2.) or newlines
        import re
        # Try to split by numbered questions first
        numbered_pattern = r'^\s*\d+[\.\)]\s+'
        lines = counter_question_text.split('\n')
        questions = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            # Remove numbering if present
            cleaned = re.sub(numbered_pattern, '', line)
            if cleaned:
                questions.append(cleaned)
        
        # If no valid split, return the whole text as one question
        if not questions:
            questions = [counter_question_text]
        
        # Limit to max 2 questions
        questions = questions[:2]
        
        print(f"Generated {len(questions)} counter-question(s): {questions}")
        return questions
        
    except Exception as e:
        import traceback
        print(f"Error generating chat counter-question: {e}")
        print(f"Full traceback: {traceback.format_exc()}")
        
        # Fallback questions as list
        if agent_recommendations:
            return ["Could you clarify which part of my earlier recommendations you're asking about?"]
        else:
            return ["Could you provide a bit more context about what specifically you'd like help with?"]
