"""
Email Analysis Module
Analyzes user emails to extract communication style, tone, and decision-making patterns.
Uses Gemini AI to understand email content and build accurate digital twin personality.
"""

import os
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
import google.generativeai as genai

_genai_configured = False

def ensure_genai_configured():
    """Ensure Gemini API is configured before use"""
    global _genai_configured
    if not _genai_configured:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found in environment")
        genai.configure(api_key=api_key)
        _genai_configured = True

class EmailAnalyzer:
    """Analyzes email communication patterns to build digital twin personality"""
    
    def __init__(self):
        ensure_genai_configured()
        self.model = genai.GenerativeModel('gemini-2.0-flash-exp')
        self.embedding_model = 'models/embedding-001'
    
    def analyze_email_batch(self, emails: List[Dict[str, Any]], user_profile: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze a batch of emails to extract communication style.
        
        Args:
            emails: List of email objects with 'subject', 'body', 'to', 'from', 'date'
            user_profile: User profile data for context
            
        Returns:
            Analysis results with tone, style, patterns, and confidence score
        """
        if not emails:
            return {
                "success": False,
                "confidence": 0,
                "error": "No emails provided for analysis",
                "fallback_required": True
            }
        
        # Prepare email data for analysis
        email_samples = []
        for email in emails[:100]:  # Analyze up to 100 recent emails
            sample = {
                "subject": email.get("subject", ""),
                "body": email.get("body", "")[:1000],  # First 1000 chars
                "length": len(email.get("body", "")),
                "has_greeting": self._has_greeting(email.get("body", "")),
                "has_signature": self._has_signature(email.get("body", ""))
            }
            email_samples.append(sample)
        
        # Use Gemini to extract communication style
        analysis_prompt = f"""Analyze these {len(email_samples)} emails from {user_profile.get('name', 'the user')} and extract their communication style.

User Profile:
- Name: {user_profile.get('name')}
- Role: {user_profile.get('designation')} at {user_profile.get('companyName')}

Email Samples:
{json.dumps(email_samples[:20], indent=2)}

Extract and return a JSON object with:
1. tone: Primary tone (Direct/Motivational/Sarcastic/Formal/Humorous/Diplomatic)
2. formality_level: 1-10 scale (1=very casual, 10=very formal)
3. decision_style: How they make decisions (Data-driven/Intuitive/Collaborative/Autocratic)
4. vocabulary_complexity: 1-10 scale
5. emoji_usage: frequency (None/Rare/Moderate/Frequent)
6. signature_phrases: List of phrases they commonly use
7. response_patterns: Typical response length and structure
8. politeness_level: 1-10 scale
9. risk_language: How they discuss risks/challenges
10. confidence_indicators: Phrases showing confidence/uncertainty

Return ONLY valid JSON with these fields."""

        try:
            response = self.model.generate_content(analysis_prompt)
            analysis = self._parse_json_response(response.text)
            
            if not analysis:
                return self._fallback_analysis(email_samples, user_profile)
            
            # Calculate confidence based on email volume and analysis completeness
            confidence = self._calculate_style_confidence(len(emails), analysis)
            
            return {
                "success": True,
                "confidence": confidence,
                "tone": analysis.get("tone", "Professional"),
                "formality_level": analysis.get("formality_level", 5),
                "decision_style": analysis.get("decision_style", "Balanced"),
                "vocabulary_complexity": analysis.get("vocabulary_complexity", 5),
                "emoji_usage": analysis.get("emoji_usage", "None"),
                "signature_phrases": analysis.get("signature_phrases", []),
                "response_patterns": analysis.get("response_patterns", {}),
                "politeness_level": analysis.get("politeness_level", 7),
                "risk_language": analysis.get("risk_language", ""),
                "confidence_indicators": analysis.get("confidence_indicators", []),
                "emails_analyzed": len(emails),
                "fallback_required": False
            }
            
        except Exception as e:
            print(f"Error analyzing emails: {e}")
            return self._fallback_analysis(email_samples, user_profile)
    
    def extract_decisions(self, emails: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract strategic decisions and their rationale from emails"""
        decisions = []
        
        for email in emails:
            body = email.get("body", "")
            if self._looks_like_decision(body):
                decision_prompt = f"""Analyze this email and extract any strategic decision made.

Email Subject: {email.get('subject')}
Email Body: {body[:2000]}

If this contains a strategic decision, return JSON with:
{{
    "decision": "The decision made",
    "rationale": "Why this decision was made",
    "context": "Business context (KPIs, challenges, opportunities)",
    "confidence": 0-100
}}

If no decision found, return {{"decision": null}}"""

                try:
                    response = self.model.generate_content(decision_prompt)
                    decision_data = self._parse_json_response(response.text)
                    
                    if decision_data and decision_data.get("decision"):
                        decisions.append({
                            **decision_data,
                            "source": "email",
                            "source_id": email.get("id"),
                            "date": email.get("date")
                        })
                except Exception as e:
                    print(f"Error extracting decision: {e}")
                    continue
        
        return decisions
    
    def _has_greeting(self, text: str) -> bool:
        """Check if email has greeting"""
        greetings = ["hi", "hello", "hey", "dear", "greetings"]
        first_line = text.lower().split('\n')[0] if text else ""
        return any(g in first_line for g in greetings)
    
    def _has_signature(self, text: str) -> bool:
        """Check if email has signature"""
        signatures = ["regards", "best", "thanks", "sincerely", "cheers"]
        last_lines = text.lower().split('\n')[-3:] if text else []
        return any(any(sig in line for sig in signatures) for line in last_lines)
    
    def _looks_like_decision(self, text: str) -> bool:
        """Check if email might contain a decision"""
        decision_keywords = [
            "decided", "decision", "approve", "moving forward",
            "go ahead", "strategy", "plan", "initiative"
        ]
        text_lower = text.lower()
        return any(keyword in text_lower for keyword in decision_keywords)
    
    def _parse_json_response(self, text: str) -> Optional[Dict]:
        """Parse JSON from Gemini response"""
        try:
            # Remove markdown code blocks if present
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]
            
            return json.loads(text.strip())
        except Exception as e:
            print(f"Error parsing JSON: {e}")
            return None
    
    def _calculate_style_confidence(self, email_count: int, analysis: Dict) -> int:
        """Calculate confidence score based on data volume and completeness"""
        # Base confidence from email count (0-60 points)
        count_confidence = min(60, (email_count / 500) * 60)
        
        # Analysis completeness (0-40 points)
        required_fields = ["tone", "formality_level", "decision_style", "signature_phrases"]
        completeness = sum(1 for field in required_fields if analysis.get(field)) / len(required_fields)
        completeness_score = completeness * 40
        
        return int(count_confidence + completeness_score)
    
    def _fallback_analysis(self, email_samples: List[Dict], user_profile: Dict) -> Dict[str, Any]:
        """Provide fallback analysis when Gemini fails"""
        return {
            "success": True,
            "confidence": 20,  # Low confidence for fallback
            "tone": "Professional",
            "formality_level": 5,
            "decision_style": "Balanced",
            "vocabulary_complexity": 5,
            "emoji_usage": "None",
            "signature_phrases": [],
            "response_patterns": {"length": "medium"},
            "politeness_level": 7,
            "risk_language": "balanced",
            "confidence_indicators": [],
            "emails_analyzed": len(email_samples),
            "fallback_required": True,
            "fallback_reason": "Analysis failed, using generic professional style"
        }
