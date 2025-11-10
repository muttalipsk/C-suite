"""
Shared utility for retrieving agent metadata across the application.
Handles both built-in AI leaders (PERSONAS) and custom digital twins (twin_*).
"""

from constants import PERSONAS


def get_agent_metadata(agent: str):
    """
    Retrieve agent metadata from PERSONAS or use defaults for digital twins.
    Returns dict with keys: company, role, description
    
    Args:
        agent (str): Agent identifier (e.g., "Sam_Altman" or "twin_e29eb729-...")
    
    Returns:
        dict: Agent metadata containing company, role, and description
        
    Raises:
        ValueError: If agent is neither in PERSONAS nor a valid twin_* identifier
    """
    if agent in PERSONAS:
        return {
            "company": PERSONAS[agent]["company"],
            "role": PERSONAS[agent]["role"],
            "description": PERSONAS[agent]["description"]
        }
    elif agent.startswith("twin_"):
        # Digital twin - use generic metadata (frontend will display actual twin info)
        # TODO: Fetch actual twin metadata from database/ChromaDB for personalized output
        return {
            "company": "Digital Twin",
            "role": "Personalized Advisor",
            "description": "Custom digital twin advisor based on your profile"
        }
    else:
        raise ValueError(f"Invalid agent: {agent}")
