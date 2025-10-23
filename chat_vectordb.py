"""
Chat History Storage using ChromaDB
Stores chat messages as embeddings in a vector database,
with separate collections for each AI agent.
"""

import os
import uuid
from datetime import datetime
from typing import List, Dict, Optional
import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer

# Initialize embedding model
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')

# Initialize ChromaDB client with persistence
CHROMA_DB_DIR = "./chroma_chat_db"
os.makedirs(CHROMA_DB_DIR, exist_ok=True)

client = chromadb.PersistentClient(
    path=CHROMA_DB_DIR,
    settings=Settings(
        anonymized_telemetry=False,
        allow_reset=True
    )
)


def get_agent_collection(agent_name: str):
    """
    Get or create a ChromaDB collection for a specific agent.
    Each agent has its own collection to keep chat histories separate.
    """
    collection_name = f"chat_history_{agent_name}".lower().replace(" ", "_")
    try:
        collection = client.get_collection(collection_name)
    except:
        collection = client.create_collection(
            name=collection_name,
            metadata={"agent": agent_name, "type": "chat_history"}
        )
    return collection


def store_chat_message(
    agent_name: str,
    run_id: str,
    user_id: str,
    message: str,
    sender: str,  # "user" or "agent"
    metadata: Optional[Dict] = None
) -> str:
    """
    Store a chat message in the agent's vector database collection.
    
    Args:
        agent_name: Name of the AI agent (e.g., "Sam_Altman")
        run_id: ID of the meeting/conversation run
        user_id: ID of the user
        message: The chat message text
        sender: Either "user" or "agent"
        metadata: Additional metadata to store with the message
        
    Returns:
        message_id: Unique ID of the stored message
    """
    collection = get_agent_collection(agent_name)
    
    # Generate embedding for the message
    embedding = embedding_model.encode(message).tolist()
    
    # Create unique message ID
    message_id = str(uuid.uuid4())
    
    # Prepare metadata
    meta = {
        "run_id": run_id,
        "user_id": user_id,
        "sender": sender,
        "timestamp": datetime.utcnow().isoformat(),
        "agent": agent_name
    }
    if metadata:
        meta.update(metadata)
    
    # Store in ChromaDB
    collection.add(
        ids=[message_id],
        embeddings=[embedding],
        documents=[message],
        metadatas=[meta]
    )
    
    return message_id


def get_chat_history(
    agent_name: str,
    run_id: str,
    limit: int = 50
) -> List[Dict]:
    """
    Retrieve chat history for a specific agent and run from vector database.
    
    Args:
        agent_name: Name of the AI agent
        run_id: ID of the meeting/conversation run
        limit: Maximum number of messages to retrieve
        
    Returns:
        List of chat messages with metadata, sorted by timestamp
    """
    collection = get_agent_collection(agent_name)
    
    try:
        # Query with filter for specific run_id
        results = collection.get(
            where={"run_id": run_id},
            limit=limit
        )
        
        if not results['ids']:
            return []
        
        # Combine results into structured format
        messages = []
        for i in range(len(results['ids'])):
            messages.append({
                "id": results['ids'][i],
                "message": results['documents'][i],
                "sender": results['metadatas'][i].get('sender'),
                "timestamp": results['metadatas'][i].get('timestamp'),
                "user_id": results['metadatas'][i].get('user_id'),
            })
        
        # Sort by timestamp
        messages.sort(key=lambda x: x.get('timestamp', ''))
        
        return messages
    except Exception as e:
        print(f"Error retrieving chat history: {e}")
        return []


def get_similar_conversations(
    agent_name: str,
    query_text: str,
    user_id: str,
    n_results: int = 5
) -> List[Dict]:
    """
    Find similar past conversations using semantic search.
    Useful for providing context from previous interactions.
    
    Args:
        agent_name: Name of the AI agent
        query_text: Text to search for similar conversations
        user_id: Filter by specific user
        n_results: Number of similar messages to return
        
    Returns:
        List of similar messages with relevance scores
    """
    collection = get_agent_collection(agent_name)
    
    # Generate embedding for query
    query_embedding = embedding_model.encode(query_text).tolist()
    
    try:
        results = collection.query(
            query_embeddings=[query_embedding],
            where={"user_id": user_id},
            n_results=n_results
        )
        
        if not results['ids'] or not results['ids'][0]:
            return []
        
        # Format results
        similar_messages = []
        for i in range(len(results['ids'][0])):
            similar_messages.append({
                "message": results['documents'][0][i],
                "sender": results['metadatas'][0][i].get('sender'),
                "timestamp": results['metadatas'][0][i].get('timestamp'),
                "run_id": results['metadatas'][0][i].get('run_id'),
                "distance": results['distances'][0][i] if 'distances' in results else None
            })
        
        return similar_messages
    except Exception as e:
        print(f"Error finding similar conversations: {e}")
        return []


def delete_chat_history(agent_name: str, run_id: str) -> bool:
    """
    Delete all chat messages for a specific run.
    
    Args:
        agent_name: Name of the AI agent
        run_id: ID of the run to delete
        
    Returns:
        True if successful, False otherwise
    """
    collection = get_agent_collection(agent_name)
    
    try:
        # Get all message IDs for this run
        results = collection.get(where={"run_id": run_id})
        
        if results['ids']:
            collection.delete(ids=results['ids'])
        
        return True
    except Exception as e:
        print(f"Error deleting chat history: {e}")
        return False


def get_agent_stats(agent_name: str) -> Dict:
    """
    Get statistics about an agent's chat collection.
    
    Args:
        agent_name: Name of the AI agent
        
    Returns:
        Dictionary with collection statistics
    """
    collection = get_agent_collection(agent_name)
    
    try:
        count = collection.count()
        return {
            "agent": agent_name,
            "total_messages": count,
            "collection_name": collection.name
        }
    except Exception as e:
        print(f"Error getting agent stats: {e}")
        return {"agent": agent_name, "total_messages": 0, "error": str(e)}
