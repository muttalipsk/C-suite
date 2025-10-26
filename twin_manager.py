"""
Digital Twin Manager
Handles twin creation with semantic chunking and dual vector storage (Content + Style)
"""

import os
import uuid
import json
from typing import List, Dict, Optional
import chromadb
from chromadb.config import Settings
import google.generativeai as genai
from constants import GEMINI_KEY, MODEL, EMBEDDING_MODEL
from chat_vectordb import ensure_genai_configured, get_embedding

CHROMA_TWINS_DIR = "./chroma_twins_db"
UPLOADS_DIR = "./uploads"

# Ensure directories exist
os.makedirs(CHROMA_TWINS_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)

def get_twins_chroma_client():
    """Get ChromaDB client for twins collections"""
    return chromadb.PersistentClient(
        path=CHROMA_TWINS_DIR,
        settings=Settings(
            anonymized_telemetry=False,
            allow_reset=True
        )
    )


def get_twin_collections(twin_id: str):
    """
    Get or create Content and Style collections for a specific twin.
    Returns: (content_collection, style_collection)
    """
    client = get_twins_chroma_client()
    
    content_name = f"twin_content_{twin_id}".lower()
    style_name = f"twin_style_{twin_id}".lower()
    
    try:
        content_collection = client.get_collection(content_name)
    except:
        content_collection = client.create_collection(
            name=content_name,
            metadata={"twin_id": twin_id, "type": "content"}
        )
    
    try:
        style_collection = client.get_collection(style_name)
    except:
        style_collection = client.create_collection(
            name=style_name,
            metadata={"twin_id": twin_id, "type": "style"}
        )
    
    return content_collection, style_collection


def semantic_chunk_with_gemini(text: str, chunk_type: str = "general") -> List[str]:
    """
    Use Gemini to perform semantic chunking on text.
    chunk_type: 'content' (factual data) or 'style' (communication tone)
    """
    ensure_genai_configured()
    
    # For short texts, return as single chunk
    if len(text) < 500:
        return [text]
    
    prompt = f"""
You are a semantic chunking expert. Split this text into semantically coherent chunks.

For {chunk_type} chunking:
- Content chunks: Group related facts, data points, strategies, and decisions together (300-500 chars each)
- Style chunks: Group communication patterns, tone examples, and linguistic style together (100-300 chars each)

Rules:
1. Each chunk should be self-contained and meaningful
2. Preserve context - don't split mid-sentence
3. Return ONLY a JSON array of strings
4. No explanations, just the array

Text to chunk:
{text}

Output format: ["chunk1", "chunk2", "chunk3"]
"""
    
    try:
        chat_model = genai.GenerativeModel(MODEL)
        response = chat_model.generate_content(prompt)
        chunks_text = response.text.strip()
        
        # Extract JSON array from response
        if chunks_text.startswith("["):
            chunks = json.loads(chunks_text)
            return chunks if isinstance(chunks, list) else [text]
        else:
            # Fallback: simple splitting
            return simple_chunk(text, chunk_type)
    except Exception as e:
        print(f"Semantic chunking failed: {e}, using fallback")
        return simple_chunk(text, chunk_type)


def simple_chunk(text: str, chunk_type: str) -> List[str]:
    """Fallback chunking if Gemini fails"""
    chunk_size = 400 if chunk_type == "content" else 200
    chunks = []
    
    sentences = text.split(". ")
    current_chunk = ""
    
    for sentence in sentences:
        if len(current_chunk) + len(sentence) > chunk_size and current_chunk:
            chunks.append(current_chunk.strip())
            current_chunk = sentence
        else:
            current_chunk += sentence + ". "
    
    if current_chunk.strip():
        chunks.append(current_chunk.strip())
    
    return chunks if chunks else [text]


def classify_text_type(text: str) -> str:
    """
    Classify text as 'content' (factual) or 'style' (tone/communication)
    """
    text_lower = text.lower()
    
    # Style indicators
    style_keywords = ["lol", "haha", "!", "?", "ship it", "let's go", "no excuses", 
                     "great job", "awesome", "thanks", "hey", "hi", "love it"]
    
    # Content indicators
    content_keywords = ["revenue", "q4", "goal", "kpi", "margin", "strategy", "metric",
                       "data", "analysis", "decision", "performance", "growth", "plan"]
    
    style_score = sum(1 for kw in style_keywords if kw in text_lower)
    content_score = sum(1 for kw in content_keywords if kw in text_lower)
    
    # Short messages (<150 chars) are usually style
    if len(text) < 150:
        return "style"
    
    # Decide based on scores
    return "style" if style_score > content_score else "content"


def process_file(file_path: str) -> str:
    """Extract text from uploaded file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        print(f"Error reading file {file_path}: {e}")
        return ""


def create_twin_vectors(
    twin_id: str,
    sample_messages: List[str],
    uploaded_files: List[str],
    profile_data: Dict
) -> Dict:
    """
    Process all twin data and store in dual vector databases.
    Returns statistics about created vectors.
    """
    content_collection, style_collection = get_twin_collections(twin_id)
    
    stats = {
        "content_chunks": 0,
        "style_chunks": 0,
        "files_processed": 0,
        "errors": []
    }
    
    # 1. Process sample messages (always style)
    print(f"Processing {len(sample_messages)} sample messages...")
    for i, msg in enumerate(sample_messages):
        chunks = semantic_chunk_with_gemini(msg, "style")
        for chunk_idx, chunk in enumerate(chunks):
            try:
                embedding = get_embedding(chunk)
                style_collection.add(
                    ids=[f"sample_{i}_{chunk_idx}"],
                    embeddings=[embedding],
                    documents=[chunk],
                    metadatas=[{
                        "type": "sample_message",
                        "source": "user_input",
                        "twin_id": twin_id
                    }]
                )
                stats["style_chunks"] += 1
            except Exception as e:
                stats["errors"].append(f"Sample message {i}: {str(e)}")
    
    # 2. Process uploaded files
    print(f"Processing {len(uploaded_files)} uploaded files...")
    for file_path in uploaded_files:
        text = process_file(file_path)
        if not text:
            continue
        
        # Classify entire file
        file_type = classify_text_type(text)
        collection = content_collection if file_type == "content" else style_collection
        
        chunks = semantic_chunk_with_gemini(text, file_type)
        
        for chunk_idx, chunk in enumerate(chunks):
            try:
                embedding = get_embedding(chunk)
                collection.add(
                    ids=[f"file_{os.path.basename(file_path)}_{chunk_idx}"],
                    embeddings=[embedding],
                    documents=[chunk],
                    metadatas=[{
                        "type": file_type,
                        "source": os.path.basename(file_path),
                        "twin_id": twin_id
                    }]
                )
                
                if file_type == "content":
                    stats["content_chunks"] += 1
                else:
                    stats["style_chunks"] += 1
            except Exception as e:
                stats["errors"].append(f"File {file_path} chunk {chunk_idx}: {str(e)}")
        
        stats["files_processed"] += 1
    
    # 3. Add profile data to content collection
    print("Adding profile data to content collection...")
    profile_text = f"""
    Company: {profile_data.get('company_name', 'N/A')}
    Designation: {profile_data.get('designation', 'N/A')}
    Q4 Goal: {profile_data.get('q4_goal', 'N/A')}
    Core Strategy: {profile_data.get('core_strategy', 'N/A')}
    Risk Tolerance: {profile_data.get('risk_tolerance', 'N/A')}
    Core Values: {profile_data.get('core_values', 'N/A')}
    """
    
    try:
        embedding = get_embedding(profile_text)
        content_collection.add(
            ids=["profile_data"],
            embeddings=[embedding],
            documents=[profile_text],
            metadatas=[{
                "type": "profile",
                "source": "user_profile",
                "twin_id": twin_id
            }]
        )
        stats["content_chunks"] += 1
    except Exception as e:
        stats["errors"].append(f"Profile data: {str(e)}")
    
    print(f"Twin vectors created: {stats['content_chunks']} content, {stats['style_chunks']} style")
    return stats


def query_twin_content(twin_id: str, query: str, limit: int = 3) -> List[str]:
    """Retrieve relevant content chunks for a twin"""
    content_collection, _ = get_twin_collections(twin_id)
    
    try:
        query_embedding = get_embedding(query)
        results = content_collection.query(
            query_embeddings=[query_embedding],
            n_results=limit
        )
        
        if results and results['documents']:
            return results['documents'][0]
        return []
    except Exception as e:
        print(f"Error querying twin content: {e}")
        return []


def query_twin_style(twin_id: str, limit: int = 5) -> List[str]:
    """Retrieve style examples for a twin"""
    _, style_collection = get_twin_collections(twin_id)
    
    try:
        # Get random style samples (no specific query)
        results = style_collection.get(limit=limit)
        
        if results and results['documents']:
            return results['documents']
        return []
    except Exception as e:
        print(f"Error querying twin style: {e}")
        return []


def delete_twin_collections(twin_id: str):
    """Delete both content and style collections for a twin"""
    client = get_twins_chroma_client()
    
    content_name = f"twin_content_{twin_id}".lower()
    style_name = f"twin_style_{twin_id}".lower()
    
    try:
        client.delete_collection(content_name)
        client.delete_collection(style_name)
        print(f"Deleted collections for twin {twin_id}")
    except Exception as e:
        print(f"Error deleting twin collections: {e}")
