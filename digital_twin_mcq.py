import google.generativeai as genai
from constants import GEMINI_KEY
from typing import Dict, List, Any
import json

def generate_mcq_questions(user_profile: Dict[str, Any], company_data: Dict[str, str]) -> List[Dict[str, Any]]:
    """
    Generate 50 MCQ questions (10 per category) using Gemini AI.
    Questions are personalized based on user profile and company website data.
    
    Args:
        user_profile: User's profile information (name, title, company, etc.)
        company_data: Scraped company website data
    
    Returns:
        List of 50 MCQ questions with 4 answer choices each
    """
    
    # Prepare context from user profile
    user_context = f"""
User Profile:
- Name: {user_profile.get('name', 'Not provided')}
- Title: {user_profile.get('title', 'Not provided')}
- Company: {user_profile.get('company', 'Not provided')}
- Industry: {user_profile.get('industry', 'Not provided')}
"""
    
    # Prepare company context
    company_context = ""
    if company_data.get("all_text"):
        company_context = f"\nCompany Information:\n{company_data['all_text'][:3000]}"
    
    # Create the prompt for Gemini
    prompt = f"""{user_context}{company_context}

Based on the user profile and company information above, generate exactly 50 multiple-choice questions (MCQs) to create a comprehensive digital twin persona. 

**Requirements:**
1. Generate EXACTLY 10 questions per category (50 total)
2. Each question must have exactly 4 answer choices (A, B, C, D)
3. Questions should be personalized to the user's role, industry, and company context
4. Questions should NOT repeat information already in the profile (avoid asking name, title, company, industry)
5. Questions should dig deeper into personality, thinking patterns, decision-making style, and expertise

**Categories (10 questions each):**
1. **Identity & Expertise**: Core values, professional identity, strengths, expertise areas
2. **Decision-Making**: How they approach problems, make choices, handle trade-offs
3. **Goals & Vision**: Strategic thinking, future orientation, priorities
4. **Communication**: Interaction style, collaboration preferences, leadership approach
5. **Expertise & Challenges**: Technical depth, domain knowledge, problem-solving patterns

**Output Format (JSON):**
Return a JSON array of exactly 50 questions, each with this structure:
```json
{{
  "category": "Identity & Expertise",
  "question": "What drives your professional decisions most?",
  "choices": [
    "Data and analytics",
    "Intuition and experience",
    "Team consensus",
    "Strategic alignment"
  ]
}}
```

**Important:**
- Make questions contextual to their role and industry
- Use company culture insights when available
- Questions should reveal HOW they think, not just WHAT they know
- Avoid generic questions - personalize to their context
- Each choice should be plausible and distinct

Generate the 50 MCQ questions now."""

    try:
        # Ensure Gemini is configured
        if not GEMINI_KEY:
            raise ValueError("GEMINI_API_KEY is not set")
        
        genai.configure(api_key=GEMINI_KEY)
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        
        # Generate questions with temperature for variety
        response = model.generate_content(
            prompt,
            generation_config={
                "temperature": 0.8,  # Higher temperature for variety
                "max_output_tokens": 8000,  # Enough for 50 questions
            }
        )
        
        # Extract JSON from response
        response_text = response.text.strip()
        
        # Try to extract JSON from markdown code blocks if present
        if "```json" in response_text:
            start_idx = response_text.find("```json") + 7
            end_idx = response_text.find("```", start_idx)
            response_text = response_text[start_idx:end_idx].strip()
        elif "```" in response_text:
            start_idx = response_text.find("```") + 3
            end_idx = response_text.find("```", start_idx)
            response_text = response_text[start_idx:end_idx].strip()
        
        # Parse JSON
        questions = json.loads(response_text)
        
        # Validate structure
        if not isinstance(questions, list):
            raise ValueError("Response is not a list")
        
        # Ensure exactly 50 questions
        if len(questions) < 50:
            # If fewer than 50, use fallback questions to fill the gap
            questions.extend(get_fallback_questions(50 - len(questions)))
        elif len(questions) > 50:
            # If more than 50, truncate
            questions = questions[:50]
        
        # Validate each question
        validated_questions = []
        for i, q in enumerate(questions):
            if not isinstance(q, dict):
                continue
            
            # Ensure required fields
            if "question" not in q or "choices" not in q or "category" not in q:
                continue
            
            # Ensure exactly 4 choices
            if not isinstance(q["choices"], list) or len(q["choices"]) != 4:
                continue
            
            validated_questions.append({
                "id": i + 1,
                "category": q["category"],
                "question": q["question"],
                "choices": q["choices"]
            })
        
        # If validation failed for too many, use fallback
        if len(validated_questions) < 40:
            return get_fallback_questions(50)
        
        # Fill any gaps with fallback questions
        while len(validated_questions) < 50:
            validated_questions.append(get_fallback_questions(1)[0])
        
        return validated_questions[:50]
        
    except Exception as e:
        print(f"Error generating MCQ questions: {e}")
        # Return fallback questions
        return get_fallback_questions(50)


def get_fallback_questions(count: int = 50) -> List[Dict[str, Any]]:
    """
    Return curated fallback MCQ questions when AI generation fails.
    
    Args:
        count: Number of questions to return (up to 50)
    
    Returns:
        List of fallback MCQ questions
    """
    
    fallback_questions = [
        # Identity & Expertise (10)
        {"category": "Identity & Expertise", "question": "What best describes your professional identity?", "choices": ["Strategic visionary", "Technical expert", "People leader", "Innovative problem-solver"]},
        {"category": "Identity & Expertise", "question": "What is your core strength in your role?", "choices": ["Deep technical knowledge", "Strategic thinking", "Building relationships", "Driving execution"]},
        {"category": "Identity & Expertise", "question": "How do you stay current in your field?", "choices": ["Reading research papers", "Attending conferences", "Peer discussions", "Hands-on experimentation"]},
        {"category": "Identity & Expertise", "question": "What defines your professional value?", "choices": ["Subject matter expertise", "Leadership ability", "Innovation capacity", "Operational excellence"]},
        {"category": "Identity & Expertise", "question": "What motivates you most at work?", "choices": ["Solving complex problems", "Leading teams", "Creating impact", "Building expertise"]},
        {"category": "Identity & Expertise", "question": "How do you prefer to learn new skills?", "choices": ["Structured courses", "Learning by doing", "Mentorship", "Self-study"]},
        {"category": "Identity & Expertise", "question": "What is your approach to expertise?", "choices": ["Deep specialist", "Broad generalist", "T-shaped (both)", "Context-dependent"]},
        {"category": "Identity & Expertise", "question": "What professional legacy do you want?", "choices": ["Technical innovations", "Strong teams built", "Industry impact", "Knowledge shared"]},
        {"category": "Identity & Expertise", "question": "How do you define success?", "choices": ["Results achieved", "People developed", "Problems solved", "Vision realized"]},
        {"category": "Identity & Expertise", "question": "What drives your career decisions?", "choices": ["Learning opportunities", "Impact potential", "Compensation", "Work-life balance"]},
        
        # Decision-Making (10)
        {"category": "Decision-Making", "question": "How do you make important decisions?", "choices": ["Data-driven analysis", "Intuition and experience", "Consensus building", "Quick decisive action"]},
        {"category": "Decision-Making", "question": "What do you prioritize when facing trade-offs?", "choices": ["Speed to market", "Quality perfection", "Cost efficiency", "Risk mitigation"]},
        {"category": "Decision-Making", "question": "How do you handle uncertainty?", "choices": ["Gather more data", "Trust gut feeling", "Seek expert input", "Run small experiments"]},
        {"category": "Decision-Making", "question": "What's your approach to risk?", "choices": ["Risk-averse", "Calculated risks", "Risk-seeking", "Context-dependent"]},
        {"category": "Decision-Making", "question": "How do you prioritize tasks?", "choices": ["Impact vs effort", "Urgency first", "Strategic alignment", "Stakeholder needs"]},
        {"category": "Decision-Making", "question": "When do you involve others in decisions?", "choices": ["Always collaborate", "Only when needed", "After initial analysis", "Rarely, decide independently"]},
        {"category": "Decision-Making", "question": "How do you handle conflicting priorities?", "choices": ["Escalate quickly", "Find creative solutions", "Make tough calls", "Build consensus"]},
        {"category": "Decision-Making", "question": "What guides your strategic choices?", "choices": ["Long-term vision", "Market opportunities", "Competitive advantage", "Customer needs"]},
        {"category": "Decision-Making", "question": "How do you evaluate options?", "choices": ["Systematic frameworks", "Pros/cons lists", "Scenario planning", "Rapid prototyping"]},
        {"category": "Decision-Making", "question": "When do you change your mind?", "choices": ["New data emerges", "Trusted feedback", "Outcomes differ", "Rarely change course"]},
        
        # Goals & Vision (10)
        {"category": "Goals & Vision", "question": "What is your primary professional goal?", "choices": ["Industry leadership", "Technical mastery", "Build great products", "Develop talent"]},
        {"category": "Goals & Vision", "question": "How do you think about the future?", "choices": ["5-10 year vision", "Next quarter focus", "1-3 year plan", "Opportunistic adaptation"]},
        {"category": "Goals & Vision", "question": "What change do you want to create?", "choices": ["Technology advancement", "Business transformation", "Team culture", "Customer experience"]},
        {"category": "Goals & Vision", "question": "How do you set priorities?", "choices": ["Strategic objectives", "Customer impact", "Revenue potential", "Team capacity"]},
        {"category": "Goals & Vision", "question": "What defines your vision of success?", "choices": ["Market leadership", "Innovation breakthroughs", "Team excellence", "Sustainable growth"]},
        {"category": "Goals & Vision", "question": "How do you balance short vs long-term?", "choices": ["Long-term focused", "Balance both", "Short-term results", "Opportunistic"]},
        {"category": "Goals & Vision", "question": "What metrics matter most to you?", "choices": ["Business outcomes", "Team satisfaction", "Technical quality", "Customer value"]},
        {"category": "Goals & Vision", "question": "How do you inspire others?", "choices": ["Compelling vision", "Clear goals", "Personal example", "Tangible results"]},
        {"category": "Goals & Vision", "question": "What's your approach to innovation?", "choices": ["Disruptive changes", "Continuous improvement", "Fast follower", "Selective adoption"]},
        {"category": "Goals & Vision", "question": "How do you measure progress?", "choices": ["Milestone achievement", "Learning velocity", "Impact delivered", "Team growth"]},
        
        # Communication (10)
        {"category": "Communication", "question": "How do you prefer to communicate?", "choices": ["Written detailed docs", "Quick verbal sync", "Visual presentations", "Collaborative sessions"]},
        {"category": "Communication", "question": "What is your leadership style?", "choices": ["Directive and clear", "Collaborative consensus", "Servant leadership", "Coaching and developing"]},
        {"category": "Communication", "question": "How do you handle conflict?", "choices": ["Direct confrontation", "Diplomatic mediation", "Avoid when possible", "Find win-win solutions"]},
        {"category": "Communication", "question": "How do you give feedback?", "choices": ["Direct and immediate", "Structured and scheduled", "Gentle and supportive", "Balanced approach"]},
        {"category": "Communication", "question": "What's your meeting style?", "choices": ["Agenda-driven efficient", "Open collaborative", "Minimal meetings", "As needed flexibility"]},
        {"category": "Communication", "question": "How do you collaborate?", "choices": ["Lead from front", "Facilitate others", "Work independently", "Partner equally"]},
        {"category": "Communication", "question": "How do you persuade others?", "choices": ["Data and logic", "Stories and examples", "Relationships and trust", "Vision and inspiration"]},
        {"category": "Communication", "question": "What's your listening style?", "choices": ["Active questioning", "Patient absorbing", "Solution-focused", "Empathetic understanding"]},
        {"category": "Communication", "question": "How do you share information?", "choices": ["Proactive broadcasts", "Pull-based on demand", "Need-to-know basis", "Full transparency"]},
        {"category": "Communication", "question": "How do you build relationships?", "choices": ["Professional focus", "Personal connection", "Results-driven trust", "Authentic openness"]},
        
        # Expertise & Challenges (10)
        {"category": "Expertise & Challenges", "question": "What technical area excites you most?", "choices": ["AI/ML advancement", "System architecture", "Data engineering", "Product innovation"]},
        {"category": "Expertise & Challenges", "question": "How do you approach complex problems?", "choices": ["Break down systematically", "Find root causes", "Explore multiple angles", "Prototype quickly"]},
        {"category": "Expertise & Challenges", "question": "What is your debugging approach?", "choices": ["Systematic elimination", "Hypothesis testing", "Pattern recognition", "Ask for help early"]},
        {"category": "Expertise & Challenges", "question": "How do you handle technical debt?", "choices": ["Address proactively", "Balance with features", "Refactor continuously", "Accept strategically"]},
        {"category": "Expertise & Challenges", "question": "What's your learning curve preference?", "choices": ["Steep challenges", "Gradual growth", "Just-in-time learning", "Deep mastery first"]},
        {"category": "Expertise & Challenges", "question": "How do you validate solutions?", "choices": ["Rigorous testing", "User feedback", "Peer review", "Real-world deployment"]},
        {"category": "Expertise & Challenges", "question": "What's your approach to failure?", "choices": ["Learn and iterate", "Analyze thoroughly", "Move on quickly", "Prevention focus"]},
        {"category": "Expertise & Challenges", "question": "How do you stay technical?", "choices": ["Hands-on coding", "Architecture design", "Code reviews", "Stay strategic"]},
        {"category": "Expertise & Challenges", "question": "What's your quality standard?", "choices": ["Perfect before ship", "Good enough to iterate", "Depends on context", "Customer defines quality"]},
        {"category": "Expertise & Challenges", "question": "How do you share expertise?", "choices": ["Documentation", "Teaching sessions", "Code examples", "Mentoring individuals"]}
    ]
    
    # Add IDs to questions
    for i, q in enumerate(fallback_questions):
        q["id"] = i + 1
    
    return fallback_questions[:count]
