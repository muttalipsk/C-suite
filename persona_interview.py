"""
Persona Interview System - 20-question conversational interview for custom persona creation
"""

import google.generativeai as genai
from typing import Dict, List, Optional
import os
import json

MODEL = "gemini-2.0-flash-exp"

def ensure_genai_configured():
    """Ensure Gemini API is configured"""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not found")
    try:
        genai.configure(api_key=api_key)
    except:
        pass  # Already configured

# 20 Persona Interview Questions
PERSONA_QUESTIONS = [
    # Identity & Role (Questions 1-4)
    {
        "id": "q1",
        "category": "identity",
        "question": "What is your full name and current professional title?"
    },
    {
        "id": "q2",
        "category": "identity",
        "question": "What company do you work for, and what is your primary role or responsibility there?"
    },
    {
        "id": "q3",
        "category": "identity",
        "question": "How would you describe your industry expertise in one sentence?"
    },
    {
        "id": "q4",
        "category": "identity",
        "question": "What is your typical communication style? (e.g., Direct, Formal, Casual, Motivational)"
    },
    
    # Decision-Making & Strategy (Questions 5-8)
    {
        "id": "q5",
        "category": "decision_making",
        "question": "How do you typically approach complex business decisions? Walk me through your thought process."
    },
    {
        "id": "q6",
        "category": "decision_making",
        "question": "What is your risk tolerance when making strategic decisions? (Conservative, Moderate, Aggressive)"
    },
    {
        "id": "q7",
        "category": "decision_making",
        "question": "What are your top 3 core values that guide your professional decisions?"
    },
    {
        "id": "q8",
        "category": "decision_making",
        "question": "Describe a recent strategic decision you made and the rationale behind it."
    },
    
    # Goals & Vision (Questions 9-12)
    {
        "id": "q9",
        "category": "goals",
        "question": "What are your primary business goals for the next quarter (Q4)?"
    },
    {
        "id": "q10",
        "category": "goals",
        "question": "What is your 1-year vision for your team or organization?"
    },
    {
        "id": "q11",
        "category": "goals",
        "question": "What is your 5-year strategic vision?"
    },
    {
        "id": "q12",
        "category": "goals",
        "question": "What key metrics or KPIs do you focus on to measure success?"
    },
    
    # Communication Style (Questions 13-16)
    {
        "id": "q13",
        "category": "communication",
        "question": "How do you prefer to communicate with your team? (Email, Slack, Meetings, etc.)"
    },
    {
        "id": "q14",
        "category": "communication",
        "question": "Do you use emojis or informal language in professional communication? If so, which ones?"
    },
    {
        "id": "q15",
        "category": "communication",
        "question": "How would you describe your tone when giving feedback? (Supportive, Direct, Analytical, etc.)"
    },
    {
        "id": "q16",
        "category": "communication",
        "question": "What phrases or expressions do you use frequently in conversations?"
    },
    
    # Expertise & Challenges (Questions 17-20)
    {
        "id": "q17",
        "category": "expertise",
        "question": "What are your top 3 areas of expertise or specialization?"
    },
    {
        "id": "q18",
        "category": "expertise",
        "question": "What are the biggest challenges you face in your current role?"
    },
    {
        "id": "q19",
        "category": "expertise",
        "question": "How do you stay updated on industry trends and best practices?"
    },
    {
        "id": "q20",
        "category": "expertise",
        "question": "If someone asked your digital twin for advice, what topics would you want it to excel at?"
    },
]


def get_next_question(current_index: int) -> Optional[Dict]:
    """Get the next question in the interview sequence"""
    if current_index >= len(PERSONA_QUESTIONS):
        return None  # type: ignore
    
    question = PERSONA_QUESTIONS[current_index]
    return {
        "question_id": question["id"],
        "question_number": current_index + 1,
        "total_questions": len(PERSONA_QUESTIONS),
        "category": question["category"],
        "question_text": question["question"]
    }


def analyze_email_writing_style(email_texts: List[str]) -> Dict:
    """
    Use Gemini to analyze writing style from email samples.
    Returns: {tone, patterns, phrases, formality_level, emoji_usage}
    """
    ensure_genai_configured()
    
    if not email_texts or len(email_texts) < 3:
        return {
            "error": "At least 3 email samples required for accurate analysis"
        }
    
    combined_emails = "\n\n---EMAIL SEPARATOR---\n\n".join(email_texts[:20])  # Max 20 emails
    
    prompt = f"""
You are an expert in communication style analysis. Analyze the following {len(email_texts[:20])} email samples and extract the author's writing style characteristics.

Emails:
{combined_emails}

Please analyze and return ONLY a JSON object with the following structure:
{{
  "tone": "One of: Direct, Formal, Casual, Motivational, Analytical, Friendly",
  "formality_level": "One of: Very Formal, Formal, Semi-Formal, Casual, Very Casual",
  "common_phrases": ["phrase1", "phrase2", "phrase3"],
  "sentence_length": "One of: Short, Medium, Long, Mixed",
  "emoji_usage": "One of: Frequent, Occasional, Rare, None",
  "common_emojis": ["emoji1", "emoji2"] or [],
  "signature_patterns": "Description of any signature patterns or closings",
  "key_characteristics": ["characteristic1", "characteristic2", "characteristic3"]
}}

Return ONLY the JSON object, no explanations.
"""
    
    try:
        chat_model = genai.GenerativeModel(MODEL)
        response = chat_model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                temperature=0.3,
                max_output_tokens=500,
            )
        )
        
        style_text = response.text.strip()
        # Remove markdown code blocks if present
        if style_text.startswith("```"):
            style_text = style_text.split("```")[1]
            if style_text.startswith("json"):
                style_text = style_text[4:]
            style_text = style_text.strip()
        
        style_analysis = json.loads(style_text)
        print(f"Email style analysis completed: {style_analysis}")
        return style_analysis
        
    except Exception as e:
        print(f"Error analyzing email style: {e}")
        return {
            "error": f"Failed to analyze writing style: {str(e)}"
        }


def generate_persona_summary(answers: Dict, email_style: Optional[Dict] = None) -> str:
    """
    Generate a comprehensive persona summary from interview answers and email analysis.
    This will be stored in the twin's profile.
    """
    ensure_genai_configured()
    
    prompt = f"""
You are creating a comprehensive persona profile. Based on the following interview answers, create a detailed summary that captures the person's professional identity, communication style, decision-making approach, and expertise.

Interview Answers:
{json.dumps(answers, indent=2)}

Email Style Analysis (if available):
{json.dumps(email_style or {}, indent=2)}

Generate a comprehensive persona summary that includes:
1. Professional Identity & Role
2. Communication Style & Preferences
3. Decision-Making Approach & Risk Tolerance
4. Core Values & Principles
5. Goals & Vision
6. Areas of Expertise
7. Key Characteristics for AI Replication

Make it detailed and actionable for creating an AI digital twin.
"""
    
    try:
        chat_model = genai.GenerativeModel(MODEL)
        response = chat_model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                temperature=0.4,
                max_output_tokens=1500,
            )
        )
        
        summary = response.text.strip()
        print(f"Persona summary generated: {len(summary)} characters")
        return summary
        
    except Exception as e:
        print(f"Error generating persona summary: {e}")
        return f"Error generating summary: {str(e)}"


# ============= FastAPI Endpoints =============
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/persona-interview", tags=["persona-interview"])


class NextQuestionRequest(BaseModel):
    current_index: int


class AnalyzeEmailsRequest(BaseModel):
    emails: List[str]


class GenerateSummaryRequest(BaseModel):
    answers: Dict
    email_style: Optional[Dict] = None


@router.get("/questions")
async def get_all_questions():
    """Get all 20 persona interview questions"""
    return {
        "total_questions": len(PERSONA_QUESTIONS),
        "questions": PERSONA_QUESTIONS
    }


@router.post("/next-question")
async def next_question(request: NextQuestionRequest):
    """Get the next question in the interview sequence"""
    question = get_next_question(request.current_index)
    if question is None:
        return {
            "completed": True,
            "message": "Interview complete! All 20 questions answered."
        }
    return {
        "completed": False,
        "question": question
    }


@router.post("/analyze-emails")
async def analyze_emails(request: AnalyzeEmailsRequest):
    """Analyze writing style from email samples"""
    if not request.emails or len(request.emails) < 3:
        raise HTTPException(
            status_code=400,
            detail="At least 3 email samples required for accurate analysis"
        )
    
    result = analyze_email_writing_style(request.emails)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return {"style_analysis": result}


@router.post("/generate-summary")
async def generate_summary(request: GenerateSummaryRequest):
    """Generate persona summary from interview answers and email style"""
    summary = generate_persona_summary(request.answers, request.email_style)
    return {"summary": summary}
