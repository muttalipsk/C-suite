import os
import faiss
import numpy as np
from pypdf import PdfReader
import io
from constants import PERSONAS, GEMINI_KEY, EMBEDDING_MODEL  # Import from constants
from langchain_google_genai import GoogleGenerativeAIEmbeddings

# Load knowledge from PDF
def load_knowledge(persona: str) -> str:
    pdf_path = PERSONAS[persona]["pdf"]
    if os.path.exists(pdf_path):
        try:
            with open(pdf_path, "rb") as f:
                reader = PdfReader(f)
                text = ""
                for page in reader.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
        except Exception as e:
            print(f"Error reading PDF {pdf_path} as PDF: {e}. Falling back to text read.")
            with open(pdf_path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()
        return text
    return "No baseline knowledge loaded."

# Embedding model
emb_model = GoogleGenerativeAIEmbeddings(model=EMBEDDING_MODEL, google_api_key=GEMINI_KEY)

def get_embedding(text: str) -> list[float]:
    return emb_model.embed_query(text)

# FAISS Index Management
def build_or_update_index(persona: str, CORPUS_DIR, INDEX_DIR):
    corpus_path = os.path.join(CORPUS_DIR, persona)
    index_path = os.path.join(INDEX_DIR, f"{persona}.faiss")
    texts = []
    if os.path.exists(corpus_path):
        for filename in os.listdir(corpus_path):
            filepath = os.path.join(corpus_path, filename)
            with open(filepath, "r") as f:
                texts.append(f.read())
    if not texts:
        return None
    embeddings = [get_embedding(text) for text in texts]
    dim = len(embeddings[0])
    index = faiss.IndexFlatL2(dim)
    index.add(np.array(embeddings))
    faiss.write_index(index, index_path)
    return index

def load_index(persona: str, INDEX_DIR):
    index_path = os.path.join(INDEX_DIR, f"{persona}.faiss")
    if os.path.exists(index_path):
        return faiss.read_index(index_path)
    return None

def retrieve_relevant_chunks(persona: str, query: str, CORPUS_DIR, INDEX_DIR, top_k: int = 3) -> str:
    index = load_index(persona, INDEX_DIR)
    if index is None:
        return ""
    query_emb = np.array([get_embedding(query)])
    _, indices = index.search(query_emb, top_k)
    corpus_path = os.path.join(CORPUS_DIR, persona)
    chunks = []
    for idx in indices[0]:
        if idx < len(os.listdir(corpus_path)):
            filename = os.listdir(corpus_path)[idx]
            with open(os.path.join(corpus_path, filename), "r") as f:
                chunks.append(f.read())
    return "\n\n".join(chunks)

# Reducers for state channels
def merge_recommendations(current: dict[str, str], update: dict[str, str]) -> dict[str, str]:
    current.update(update)
    return current

def load_memory(persona: str, MEMORY_DIR):
    memory_file = os.path.join(MEMORY_DIR, f"{persona}_memory.txt")
    if os.path.exists(memory_file):
        with open(memory_file, "r") as f:
            lines = f.readlines()
        if len(lines) > 10:
            lines = lines[-10:]
            with open(memory_file, "w") as f:
                f.write("".join(lines))
        return "".join(lines[-3:])  # Inject last 3
    return ""