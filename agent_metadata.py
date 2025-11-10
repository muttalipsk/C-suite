"""
Shared utility for retrieving agent metadata across the application.
Handles both built-in AI leaders (PERSONAS) and custom digital twins (twin_*).
"""

import os
import psycopg2
from constants import PERSONAS
from functools import lru_cache

# Cache twin metadata for 5 minutes
_twin_metadata_cache = {}
_cache_ttl = 300  # 5 minutes


def _get_db_connection():
    """Get PostgreSQL connection from environment variables"""
    return psycopg2.connect(os.environ.get("DATABASE_URL"))


@lru_cache(maxsize=100)
def _fetch_twin_metadata_from_db(twin_key: str):
    """
    Fetch twin metadata from PostgreSQL database.
    Cached to avoid excessive DB queries.
    """
    try:
        conn = _get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            """
            SELECT company, role, description, knowledge 
            FROM twin_metadata 
            WHERE twin_key = %s
            """,
            (twin_key,)
        )
        
        result = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if result:
            return {
                "company": result[0],
                "role": result[1],
                "description": result[2],
                "knowledge": result[3]
            }
        return None
        
    except Exception as e:
        print(f"Error fetching twin metadata for {twin_key}: {e}")
        return None


def get_agent_metadata(agent: str):
    """
    Retrieve agent metadata from PERSONAS or database for digital twins.
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
        # Digital twin - fetch metadata from PostgreSQL database
        metadata = _fetch_twin_metadata_from_db(agent)
        
        if metadata:
            return {
                "company": metadata["company"],
                "role": metadata["role"],
                "description": metadata["description"]
            }
        else:
            # Fallback if metadata not found in database
            print(f"⚠️ WARNING: No metadata found for {agent}, using generic fallback")
            return {
                "company": "Digital Twin",
                "role": "Personalized Advisor",
                "description": "Custom digital twin advisor based on your profile"
            }
    else:
        raise ValueError(f"Invalid agent: {agent}")
