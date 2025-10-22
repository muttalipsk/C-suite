
import os
import json
import faiss
import numpy as np
from typing import List
import google.generativeai as genai
from constants import EMBEDDING_MODEL, GEMINI_KEY

genai.configure(api_key=GEMINI_KEY)

def build_or_update_index(persona: str, corpus_dir: str, index_dir: str):
    """Build or update FAISS index for a persona's corpus"""
    corpus_path = os.path.join(corpus_dir, persona)
    if not os.path.exists(corpus_path):
        return
    
    texts = []
    for filename in os.listdir(corpus_path):
        filepath = os.path.join(corpus_path, filename)
        with open(filepath, 'r') as f:
            texts.append(f.read())
    
    if not texts:
        return
    
    # Generate embeddings
    embeddings = []
    for text in texts:
        result = genai.embed_content(
            model=EMBEDDING_MODEL,
            content=text,
            task_type="retrieval_document"
        )
        embeddings.append(result['embedding'])
    
    # Create FAISS index
    embeddings_array = np.array(embeddings).astype('float32')
    dimension = embeddings_array.shape[1]
    index = faiss.IndexFlatL2(dimension)
    index.add(embeddings_array)
    
    # Save index
    os.makedirs(index_dir, exist_ok=True)
    index_path = os.path.join(index_dir, f"{persona}.index")
    faiss.write_index(index, index_path)
    
    # Save texts mapping
    mapping_path = os.path.join(index_dir, f"{persona}_mapping.json")
    with open(mapping_path, 'w') as f:
        json.dump(texts, f)

def retrieve_relevant_chunks(persona: str, query: str, CORPUS_DIR: str, INDEX_DIR: str, top_k: int = 3) -> str:
    """Retrieve relevant chunks from persona's corpus using FAISS"""
    index_path = os.path.join(INDEX_DIR, f"{persona}.index")
    mapping_path = os.path.join(INDEX_DIR, f"{persona}_mapping.json")
    
    if not os.path.exists(index_path) or not os.path.exists(mapping_path):
        return ""
    
    # Load index and mapping
    index = faiss.read_index(index_path)
    with open(mapping_path, 'r') as f:
        texts = json.load(f)
    
    # Generate query embedding
    result = genai.embed_content(
        model=EMBEDDING_MODEL,
        content=query,
        task_type="retrieval_query"
    )
    query_embedding = np.array([result['embedding']]).astype('float32')
    
    # Search
    distances, indices = index.search(query_embedding, min(top_k, len(texts)))
    
    # Return relevant chunks
    relevant_chunks = [texts[i] for i in indices[0] if i < len(texts)]
    return "\n\n".join(relevant_chunks[:top_k])

def load_knowledge(persona: str) -> str:
    """Load persona's base knowledge"""
    from constants import PERSONAS
    if persona not in PERSONAS:
        return ""
    return PERSONAS[persona].get("knowledge", "")

def load_memory(persona: str, memory_dir: str) -> str:
    """Load recent memory for a persona"""
    memory_file = os.path.join(memory_dir, f"{persona}_memory.txt")
    if not os.path.exists(memory_file):
        return ""
    
    with open(memory_file, 'r') as f:
        lines = f.readlines()
        return "".join(lines[-10:])  # Last 10 entries

def merge_recommendations(recommendations: dict) -> str:
    """Merge recommendations from multiple agents"""
    merged = []
    for agent, rec in recommendations.items():
        merged.append(f"**{agent}:**\n{rec}\n")
    return "\n".join(merged)
