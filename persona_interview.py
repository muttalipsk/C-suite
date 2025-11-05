"""
Persona Interview System - AI-generated personalized 20-question interview for custom persona creation
Questions are dynamically generated based on user's existing profile to avoid redundancy
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


def extract_profile_keywords(user_profile: Dict) -> set:
    """Extract keywords from user profile to filter redundant questions"""
    keywords = set()
    
    # Extract name components
    if user_profile.get("name"):
        keywords.add(user_profile["name"].lower())
        keywords.update(user_profile["name"].lower().split())
    
    # Extract company
    if user_profile.get("company"):
        keywords.add(user_profile["company"].lower())
    
    # Extract title
    if user_profile.get("title"):
        keywords.add(user_profile["title"].lower())
    
    # Extract industry
    if user_profile.get("industry"):
        keywords.add(user_profile["industry"].lower())
    
    return keywords


def is_question_redundant(question: str, profile_keywords: set) -> bool:
    """Check if question asks about information already in profile"""
    question_lower = question.lower()
    
    # Check for basic identity questions
    redundant_phrases = [
        "what is your name",
        "your full name",
        "what company do you work",
        "your current title",
        "your professional title",
        "what is your title",
        "what industry",
        "which company"
    ]
    
    for phrase in redundant_phrases:
        if phrase in question_lower:
            return True
    
    return False


def validate_and_fix_questions(questions: List[Dict], user_profile: Dict) -> List[Dict]:
    """
    Validate AI-generated questions and fix structure issues.
    Ensures exactly 4 questions per category and filters redundant questions.
    """
    profile_keywords = extract_profile_keywords(user_profile)
    
    # Required categories with exact count
    required_categories = {
        "identity": 4,
        "decision_making": 4,
        "goals": 4,
        "communication": 4,
        "expertise": 4
    }
    
    # Group questions by category
    categorized = {cat: [] for cat in required_categories.keys()}
    
    for q in questions:
        category = q.get("category", "").lower()
        question_text = q.get("question", "")
        
        # Skip redundant questions
        if is_question_redundant(question_text, profile_keywords):
            print(f"⚠ Skipping redundant question: {question_text[:50]}...")
            continue
        
        # Map variations to standard category names
        if category in ["identity", "identity_expertise"]:
            category = "identity"
        elif category in ["decision_making", "decision-making", "strategy"]:
            category = "decision_making"
        elif category in ["goals", "vision", "goals_vision"]:
            category = "goals"
        elif category in ["communication", "communication_style"]:
            category = "communication"
        elif category in ["expertise", "challenges", "expertise_challenges"]:
            category = "expertise"
        
        if category in categorized:
            categorized[category].append(q)
    
    # Build final question list with exactly 4 per category
    final_questions = []
    fallback = generate_fallback_questions()
    fallback_by_category = {cat: [] for cat in required_categories.keys()}
    
    for q in fallback:
        cat = q["category"]
        fallback_by_category[cat].append(q)
    
    question_id = 1
    for category, required_count in required_categories.items():
        category_questions = categorized[category]
        
        # Take up to required_count questions from AI output
        for i in range(required_count):
            if i < len(category_questions):
                q = category_questions[i]
                q["id"] = f"q{question_id}"
                final_questions.append(q)
            else:
                # Fill gaps with fallback questions
                fallback_q = fallback_by_category[category][i]
                fallback_q["id"] = f"q{question_id}"
                final_questions.append(fallback_q)
                print(f"⚠ Using fallback question for {category}: {fallback_q['question'][:50]}...")
            
            question_id += 1
    
    print(f"✓ Validated {len(final_questions)} questions (5 categories × 4 questions)")
    return final_questions


def generate_personalized_questions(user_profile: Dict) -> List[Dict]:
    """
    Generate 20 personalized interview questions based on the user's existing profile.
    
    Args:
        user_profile: Dict containing user's existing profile data (name, title, company, industry, goals, etc.)
    
    Returns:
        List of 20 question dictionaries with id, category, and question text
    """
    ensure_genai_configured()
    
    prompt = f"""You are an expert interviewer creating a personalized digital twin profile. Generate 20 thoughtful, specific interview questions based on what we already know about this person.

EXISTING USER PROFILE:
{json.dumps(user_profile, indent=2)}

IMPORTANT RULES:
1. DO NOT ask about information already in their profile (name, company, title, industry if already known)
2. Ask DEEPER, more specific questions that build on what we know
3. Make questions personalized to their role, industry, and context
4. Focus on capturing their unique thinking patterns, communication style, and expertise

REQUIRED STRUCTURE (20 questions across 5 categories):

Category 1: identity (EXACTLY 4 questions)
- Focus on unique aspects of their professional identity we don't yet know
- Ask about specific expertise areas, learning journey, career defining moments

Category 2: decision_making (EXACTLY 4 questions)  
- How they approach specific types of decisions relevant to their role
- Recent examples of strategic choices they've made
- Their risk tolerance and decision-making frameworks

Category 3: goals (EXACTLY 4 questions)
- Specific goals beyond generic profile info
- Personal definition of success in their context
- Vision for their team, projects, or initiatives

Category 4: communication (EXACTLY 4 questions)
- How they communicate in different situations (1-on-1, team meetings, presentations)
- Preferred communication channels and why
- How they adapt their style for different audiences
- Specific phrases, tone, or communication patterns they use

Category 5: expertise (EXACTLY 4 questions)
- Deep dive into their specialized knowledge areas
- Current challenges they're navigating
- How they stay current in their field
- Topics they want their digital twin to excel at advising on

Return ONLY a JSON array of 20 questions in this exact format:
[
  {{"id": "q1", "category": "identity", "question": "Your specific question here"}},
  {{"id": "q2", "category": "identity", "question": "Your specific question here"}},
  {{"id": "q3", "category": "identity", "question": "Your specific question here"}},
  {{"id": "q4", "category": "identity", "question": "Your specific question here"}},
  {{"id": "q5", "category": "decision_making", "question": "Your specific question here"}},
  ...
  {{"id": "q20", "category": "expertise", "question": "Your specific question here"}}
]

Make each question conversational, specific, and valuable for creating an authentic digital twin.
"""
    
    try:
        chat_model = genai.GenerativeModel(MODEL)
        response = chat_model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                temperature=0.7,
                max_output_tokens=2000,
            )
        )
        
        questions_text = response.text.strip()
        # Remove markdown code blocks if present
        if questions_text.startswith("```"):
            questions_text = questions_text.split("```")[1]
            if questions_text.startswith("json"):
                questions_text = questions_text[4:]
            questions_text = questions_text.strip()
        
        questions = json.loads(questions_text)
        print(f"✓ Generated {len(questions)} personalized questions from AI")
        
        # Validate and fix structure
        validated_questions = validate_and_fix_questions(questions, user_profile)
        return validated_questions
        
    except Exception as e:
        print(f"Error generating personalized questions: {e}")
        # Fallback to curated questions if AI generation fails
        fallback = generate_fallback_questions()
        print(f"✓ Using {len(fallback)} fallback questions")
        return fallback


def generate_fallback_questions() -> List[Dict]:
    """Fallback questions if AI generation fails"""
    return [
        {"id": "q1", "category": "identity", "question": "What unique perspective do you bring to your role that others might not?"},
        {"id": "q2", "category": "identity", "question": "Describe a defining moment in your career that shaped who you are today."},
        {"id": "q3", "category": "identity", "question": "What aspect of your expertise are you most proud of developing?"},
        {"id": "q4", "category": "identity", "question": "How would your team describe your leadership or working style?"},
        {"id": "q5", "category": "decision_making", "question": "Walk me through how you made a recent important decision."},
        {"id": "q6", "category": "decision_making", "question": "What factors do you weigh most heavily when making strategic choices?"},
        {"id": "q7", "category": "decision_making", "question": "Describe a time when you had to make a decision with incomplete information."},
        {"id": "q8", "category": "decision_making", "question": "What trade-offs do you commonly face in your role, and how do you navigate them?"},
        {"id": "q9", "category": "goals", "question": "What specific outcome would make you feel successful this quarter?"},
        {"id": "q10", "category": "goals", "question": "If you could achieve one breakthrough in the next year, what would it be?"},
        {"id": "q11", "category": "goals", "question": "What legacy do you want to create in your current position?"},
        {"id": "q12", "category": "goals", "question": "What metric matters most to you personally, beyond standard KPIs?"},
        {"id": "q13", "category": "communication", "question": "How do you adapt your communication style when giving difficult feedback?"},
        {"id": "q14", "category": "communication", "question": "What's your approach to communicating complex ideas to non-technical stakeholders?"},
        {"id": "q15", "category": "communication", "question": "Describe your typical communication style in team meetings vs 1-on-1 conversations."},
        {"id": "q16", "category": "communication", "question": "What phrases or frameworks do you frequently use when advising others?"},
        {"id": "q17", "category": "expertise", "question": "What topic could you teach a masterclass on based on your experience?"},
        {"id": "q18", "category": "expertise", "question": "What's the most complex problem you're working on right now?"},
        {"id": "q19", "category": "expertise", "question": "How do you approach learning when entering an unfamiliar area?"},
        {"id": "q20", "category": "expertise", "question": "If someone asks your digital twin for advice, what should it be exceptional at?"}
    ]


def get_next_question(questions: List[Dict], current_index: int) -> Optional[Dict]:
    """Get the next question from the personalized question list"""
    if current_index >= len(questions):
        return None  # type: ignore
    
    question = questions[current_index]
    return {
        "question_id": question["id"],
        "question_number": current_index + 1,
        "total_questions": len(questions),
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


class GenerateQuestionsRequest(BaseModel):
    user_profile: Dict


class NextQuestionRequest(BaseModel):
    questions: List[Dict]
    current_index: int


class AnalyzeEmailsRequest(BaseModel):
    emails: List[str]


class GenerateSummaryRequest(BaseModel):
    answers: Dict
    email_style: Optional[Dict] = None


@router.post("/generate-questions")
async def generate_questions_endpoint(request: GenerateQuestionsRequest):
    """
    Generate 20 personalized interview questions based on user's profile.
    Questions are tailored to avoid asking about information already in the profile.
    """
    questions = generate_personalized_questions(request.user_profile)
    return {
        "total_questions": len(questions),
        "questions": questions
    }


@router.post("/next-question")
async def next_question(request: NextQuestionRequest):
    """Get the next question from the personalized question list"""
    question = get_next_question(request.questions, request.current_index)
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
