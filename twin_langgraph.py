"""
Enterprise Digital Twin LangGraph Workflow
Uses LangGraph to orchestrate a multi-stage decision-making process with robust fallback handling.
Inspired by CEO digital twin patterns but built for enterprise accuracy.
"""

import os
import json
from typing import TypedDict, List, Literal, Optional, Any
from datetime import datetime
import google.generativeai as genai
from langgraph.graph import StateGraph, END, START
from langgraph.checkpoint.memory import MemorySaver
from chromadb import PersistentClient
from twin_manager import get_twin_collections, CHROMA_TWINS_DIR

# Configure Gemini
_genai_configured = False

def ensure_genai_configured():
    """Ensure Gemini API is configured"""
    global _genai_configured
    if not _genai_configured:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found")
        genai.configure(api_key=api_key)
        _genai_configured = True


# State Definition
class TwinState(TypedDict):
    """State for digital twin conversation workflow"""
    # Messages
    messages: List[dict]  # Conversation history
    user_query: str  # Current user question
    
    # Retrieved data from vector DBs
    communication_style: str  # Style patterns from emails
    business_context: str  # CRM/KPI data
    decision_history: str  # Past strategic decisions
    profile_data: dict  # Fallback profile info
    
    # Processing flags
    low_confidence: bool  # True if insufficient data
    action_needed: bool  # True if tools should be called
    feedback_loop: bool  # True if critique requires re-proposal
    
    # Confidence scores
    style_confidence: int  # 0-100
    context_confidence: int  # 0-100
    decision_confidence: int  # 0-100
    overall_confidence: int  # 0-100
    
    # Response generation
    proposal: str  # Initial bold proposal
    critique: str  # Risk analysis
    final_response: str  # Synthesized answer
    
    # Metadata
    twin_id: str
    twin_profile: dict
    escalated: bool  # True if escalation happened


# Tool Definitions
def query_business_metrics(metric_type: str, time_period: str = "current") -> str:
    """
    Mock tool to query business metrics from CRM/ERP systems.
    In production, this would call actual HubSpot/Salesforce APIs.
    
    Args:
        metric_type: Type of metric (revenue, pipeline, customer_count, etc.)
        time_period: Time period (current, last_quarter, ytd)
    
    Returns:
        Business metric data as string
    """
    # Mock data - replace with real API calls
    metrics = {
        "revenue": f"Q4 2025 Revenue: $12.5M (up 23% YoY)",
        "pipeline": f"Current Pipeline: $45M across 230 deals",
        "customer_count": f"Active Customers: 1,240 (retention: 94%)",
        "margin": f"Gross Margin: 68% (industry avg: 55%)"
    }
    return metrics.get(metric_type, "Metric not available")


# Node Functions
def retrieve_node(state: TwinState) -> TwinState:
    """
    Stage 1: Retrieve data from triple vector database system.
    CRITICAL: Handles empty results gracefully - no crashes!
    """
    twin_id = state["twin_id"]
    query = state["user_query"]
    
    try:
        # Try to get twin collections
        content_collection, style_collection = get_twin_collections(twin_id)
        
        # Query communication style (from email analysis)
        try:
            style_results = style_collection.query(
                query_texts=[query],
                n_results=3
            )
            if style_results['documents'] and style_results['documents'][0]:
                state["communication_style"] = "\n".join(style_results['documents'][0])
                # Calculate REAL confidence from similarity scores
                if style_results.get('distances') and style_results['distances'][0]:
                    # ChromaDB distances: lower = more similar
                    # Convert to confidence: (1 - avg_distance) * 100
                    avg_distance = sum(style_results['distances'][0]) / len(style_results['distances'][0])
                    state["style_confidence"] = int((1 - min(avg_distance, 1.0)) * 100)
                else:
                    state["style_confidence"] = 50  # Has data but no scores
            else:
                # FALLBACK: No style data found
                state["communication_style"] = ""
                state["style_confidence"] = 0
        except Exception as e:
            print(f"Style retrieval error: {e}")
            state["communication_style"] = ""
            state["style_confidence"] = 0
        
        # Query business context (from CRM/KPI data)
        try:
            # DEDICATED business context collection (separate from content)
            chroma_client = PersistentClient(path=CHROMA_TWINS_DIR)
            business_collection = chroma_client.get_or_create_collection(
                name=f"business_context_{twin_id}"
            )
            
            context_results = business_collection.query(
                query_texts=[query],
                n_results=5
            )
            if context_results['documents'] and context_results['documents'][0]:
                state["business_context"] = "\n".join(context_results['documents'][0])
                # Calculate REAL confidence from similarity scores
                if context_results.get('distances') and context_results['distances'][0]:
                    avg_distance = sum(context_results['distances'][0]) / len(context_results['distances'][0])
                    state["context_confidence"] = int((1 - min(avg_distance, 1.0)) * 100)
                else:
                    state["context_confidence"] = 40  # Has data but no scores
            else:
                # FALLBACK: No business context found
                state["business_context"] = ""
                state["context_confidence"] = 0
        except Exception as e:
            print(f"Business context retrieval error: {e}")
            state["business_context"] = ""
            state["context_confidence"] = 0
        
        # Query decision history (DEDICATED collection, not content)
        try:
            # Create DEDICATED decision history collection
            decision_collection = chroma_client.get_or_create_collection(
                name=f"decision_history_{twin_id}"
            )
            
            decision_results = decision_collection.query(
                query_texts=[query + " decision strategy"],
                n_results=3
            )
            if decision_results['documents'] and decision_results['documents'][0]:
                state["decision_history"] = "\n".join(decision_results['documents'][0])
                # Calculate REAL confidence from similarity scores
                if decision_results.get('distances') and decision_results['distances'][0]:
                    avg_distance = sum(decision_results['distances'][0]) / len(decision_results['distances'][0])
                    state["decision_confidence"] = int((1 - min(avg_distance, 1.0)) * 100)
                else:
                    state["decision_confidence"] = 30  # Has data but no scores
            else:
                # FALLBACK: No decision history found
                state["decision_history"] = ""
                state["decision_confidence"] = 0
        except Exception as e:
            print(f"Decision history retrieval error: {e}")
            state["decision_history"] = ""
            state["decision_confidence"] = 0
        
        # Calculate overall confidence
        confidence_scores = [
            state["style_confidence"],
            state["context_confidence"],
            state["decision_confidence"]
        ]
        state["overall_confidence"] = int(sum(confidence_scores) / len(confidence_scores))
        
        # Set low_confidence flag if overall confidence < 30
        state["low_confidence"] = state["overall_confidence"] < 30
        
        return state
        
    except Exception as e:
        print(f"Critical retrieval error: {e}")
        # CRITICAL FALLBACK: Complete failure - use profile data
        state["communication_style"] = ""
        state["business_context"] = ""
        state["decision_history"] = ""
        state["style_confidence"] = 0
        state["context_confidence"] = 0
        state["decision_confidence"] = 0
        state["overall_confidence"] = 0
        state["low_confidence"] = True
        return state


def personalize_node(state: TwinState) -> TwinState:
    """
    Stage 2: Apply communication style to response.
    Uses retrieved style patterns or falls back to profile data.
    """
    profile = state["twin_profile"]
    
    # Build style instructions
    if state["communication_style"]:
        # Use retrieved email style patterns
        style_prompt = f"""Apply this communication style (learned from actual emails):
{state["communication_style"]}

Tone: {profile.get('toneStyle', 'Professional')}
Risk Tolerance: {profile.get('riskTolerance', 'Balanced')}
"""
    else:
        # FALLBACK: Use profile-based style
        style_prompt = f"""Apply this communication style (from profile):
Tone: {profile.get('toneStyle', 'Professional')}
Formality: Medium-High
Risk Tolerance: {profile.get('riskTolerance', 'Balanced')}
Core Values: {profile.get('coreValues', 'Excellence and Innovation')}

Note: Limited style data available - using general professional approach.
"""
    
    state["communication_style"] = style_prompt
    return state


def decision_node(state: TwinState) -> TwinState:
    """
    Stage 3: Multi-agent decision process (Proposal → Critique → Moderator).
    This is the core LangGraph pattern for high-quality responses.
    """
    ensure_genai_configured()
    model = genai.GenerativeModel('gemini-2.0-flash-exp')
    
    query = state["user_query"]
    profile = state["twin_profile"]
    
    # STEP 1: PROPOSAL (Bold, innovative thinking)
    proposal_context = f"""Business Context:
{state["business_context"] if state["business_context"] else "Limited data - use general principles"}

Decision History:
{state["decision_history"] if state["decision_history"] else "No historical decisions available"}

Profile:
- Role: {profile.get('designation', 'Executive')}
- Company: {profile.get('company', 'Organization')}
- Goals: {json.dumps(profile.get('profileData', {}).get('goals', 'Growth'))}
"""
    
    proposal_prompt = f"""You are proposing a bold, innovative response to this question.

Question: {query}

Context: {proposal_context}

Communication Style: {state["communication_style"]}

Propose a strategic response that is:
1. Bold and forward-thinking
2. Grounded in available data (or acknowledge limitations)
3. Risk-tolerant but rational
4. Aligned with the person's communication style

Keep it concise (2-3 paragraphs).
"""
    
    try:
        proposal_response = model.generate_content(
            proposal_prompt,
            generation_config=genai.GenerationConfig(temperature=0.8)
        )
        state["proposal"] = proposal_response.text
    except Exception as e:
        print(f"Proposal generation error: {e}")
        state["proposal"] = "Unable to generate proposal due to system error."
    
    # STEP 2: CRITIQUE (Risk analysis and reality check)
    critique_prompt = f"""You are critiquing this proposal for risks and gaps.

Proposal: {state["proposal"]}

Business Context: {proposal_context}

Analyze:
1. What risks or challenges does this proposal face?
2. What data or context is missing?
3. What could go wrong?
4. Are there better alternatives?

Be constructive but thorough. 2-3 key points.
"""
    
    try:
        critique_response = model.generate_content(
            critique_prompt,
            generation_config=genai.GenerationConfig(temperature=0.3)
        )
        state["critique"] = critique_response.text
    except Exception as e:
        print(f"Critique generation error: {e}")
        state["critique"] = "Unable to generate critique."
    
    # STEP 3: MODERATOR (Synthesize final answer)
    moderator_prompt = f"""Synthesize a final response that balances the proposal and critique.

Question: {query}

Proposal: {state["proposal"]}

Critique: {state["critique"]}

Communication Style: {state["communication_style"]}

Create a balanced, actionable response that:
1. Incorporates the bold thinking from the proposal
2. Addresses the risks from the critique
3. Matches the communication style
4. Acknowledges data limitations if confidence is low (current: {state["overall_confidence"]}%)

Format: Clear, concise, actionable advice.
"""
    
    try:
        moderator_response = model.generate_content(
            moderator_prompt,
            generation_config=genai.GenerationConfig(temperature=0.5)
        )
        state["final_response"] = moderator_response.text
    except Exception as e:
        print(f"Moderator generation error: {e}")
        state["final_response"] = "Unable to generate final response."
    
    # Check if critique suggests major concerns (trigger feedback loop)
    state["feedback_loop"] = "significant risk" in state["critique"].lower() or "major concern" in state["critique"].lower()
    
    # Check if tools might be needed for data
    state["action_needed"] = "need more data" in state["critique"].lower() or state["context_confidence"] < 20
    
    return state


def escalate_node(state: TwinState) -> TwinState:
    """
    Stage 4: Escalation when confidence is too low.
    Provides general guidance and suggests data sources to improve accuracy.
    """
    ensure_genai_configured()
    model = genai.GenerativeModel('gemini-2.0-flash-exp')
    
    query = state["user_query"]
    profile = state["twin_profile"]
    
    escalation_prompt = f"""You are a digital twin with LIMITED DATA. Provide helpful general guidance while being transparent about limitations.

Question: {query}

Available Profile Data:
- Role: {profile.get('designation', 'Executive')}
- Company: {profile.get('company', 'Organization')}
- Goals: {json.dumps(profile.get('profileData', {}))}

Confidence Scores:
- Communication Style: {state["style_confidence"]}%
- Business Context: {state["context_confidence"]}%
- Decision History: {state["decision_confidence"]}%
- Overall: {state["overall_confidence"]}%

Provide:
1. General strategic guidance based on best practices
2. Clearly state what data is missing
3. Suggest what data sources would improve accuracy (email history, CRM data, past decisions)

Be helpful but transparent about limitations.
"""
    
    try:
        response = model.generate_content(
            escalation_prompt,
            generation_config=genai.GenerationConfig(temperature=0.4)
        )
        
        escalation_note = f"""

---
⚠️ **Limited Data Available** (Confidence: {state["overall_confidence"]}%)

To improve accuracy, consider connecting:
- Email account (for communication style)
- CRM system (for business context)
- Upload past decisions/documents

Meanwhile, here's general guidance:
"""
        
        state["final_response"] = escalation_note + "\n" + response.text
        state["escalated"] = True
        
    except Exception as e:
        print(f"Escalation error: {e}")
        state["final_response"] = f"Unable to provide guidance. Please connect data sources to improve twin accuracy. (Error: {str(e)})"
        state["escalated"] = True
    
    return state


def generate_node(state: TwinState) -> TwinState:
    """
    Stage 5: Final response generation (when NOT escalated).
    Adds confidence indicator and citations if available.
    """
    # Add confidence indicator to response
    confidence_note = ""
    if state["overall_confidence"] < 70:
        confidence_note = f"\n\n💡 **Confidence: {state['overall_confidence']}%** - Consider connecting more data sources for higher accuracy."
    
    state["final_response"] = state["final_response"] + confidence_note
    state["escalated"] = False
    
    return state


# Routing Function
def route_after_decision(state: TwinState) -> Literal["escalate", "generate", "decision"]:
    """Route after decision node based on confidence and feedback"""
    if state["low_confidence"]:
        return "escalate"
    if state["feedback_loop"]:
        return "decision"  # Loop back for refinement
    return "generate"


# Build LangGraph Workflow
def build_twin_graph():
    """Build the complete LangGraph workflow"""
    workflow = StateGraph(state_schema=TwinState)
    
    # Add nodes
    workflow.add_node("retrieve", retrieve_node)
    workflow.add_node("personalize", personalize_node)
    workflow.add_node("decision", decision_node)
    workflow.add_node("escalate", escalate_node)
    workflow.add_node("generate", generate_node)
    
    # Add edges
    workflow.add_edge(START, "retrieve")
    workflow.add_edge("retrieve", "personalize")
    workflow.add_edge("personalize", "decision")
    
    # Conditional routing after decision
    workflow.add_conditional_edges(
        "decision",
        route_after_decision,
        {
            "escalate": "escalate",
            "generate": "generate",
            "decision": "decision"  # Allow one feedback loop
        }
    )
    
    workflow.add_edge("escalate", END)
    workflow.add_edge("generate", END)
    
    # Compile with memory
    return workflow.compile(checkpointer=MemorySaver())


# Main execution function
def run_twin_conversation(twin_id: str, twin_profile: dict, user_query: str) -> dict:
    """
    Run a conversation with a digital twin using LangGraph workflow.
    
    Args:
        twin_id: Twin ID
        twin_profile: Twin profile data
        user_query: User's question
    
    Returns:
        Dict with response, confidence scores, and metadata
    """
    # Initialize state
    initial_state: TwinState = {
        "messages": [],
        "user_query": user_query,
        "communication_style": "",
        "business_context": "",
        "decision_history": "",
        "profile_data": twin_profile.get("profileData", {}),
        "low_confidence": False,
        "action_needed": False,
        "feedback_loop": False,
        "style_confidence": 0,
        "context_confidence": 0,
        "decision_confidence": 0,
        "overall_confidence": 0,
        "proposal": "",
        "critique": "",
        "final_response": "",
        "twin_id": twin_id,
        "twin_profile": twin_profile,
        "escalated": False
    }
    
    # Build and run graph
    graph = build_twin_graph()
    
    try:
        final_state = graph.invoke(initial_state)
        
        return {
            "response": final_state["final_response"],
            "confidence": {
                "style": final_state["style_confidence"],
                "context": final_state["context_confidence"],
                "decision": final_state["decision_confidence"],
                "overall": final_state["overall_confidence"]
            },
            "escalated": final_state["escalated"],
            "proposal": final_state["proposal"],
            "critique": final_state["critique"]
        }
    except Exception as e:
        print(f"Graph execution error: {e}")
        # ULTIMATE FALLBACK
        return {
            "response": f"I apologize, but I encountered an error processing your request. To provide accurate responses, please connect your email and CRM data. Error: {str(e)}",
            "confidence": {
                "style": 0,
                "context": 0,
                "decision": 0,
                "overall": 0
            },
            "escalated": True,
            "proposal": "",
            "critique": ""
        }
