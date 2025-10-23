# VectorDB Chat History Setup Guide

## Overview

The chat history system now uses **ChromaDB** (vector database) instead of PostgreSQL. Each AI agent has its own separate ChromaDB collection, allowing for:

- ✅ Agent-specific chat histories (Sam Altman, Jensen Huang, Andrew Ng, etc.)
- ✅ Semantic search over past conversations
- ✅ Text embeddings for better context retrieval
- ✅ Scalable storage for chat messages

## Architecture

```
┌─────────────────┐
│   React Frontend│
│   (Port 5000)   │
└────────┬────────┘
         │ HTTP Requests
         ▼
┌─────────────────┐
│ Node.js Express │  ◄─── Authentication, User Management
│   (Port 5000)   │  ◄─── Recommendations, Meetings
└────────┬────────┘
         │ /api/chat requests
         │ forwarded to →
         ▼
┌─────────────────┐
│ Python FastAPI  │  ◄─── Chat History Storage
│   (Port 8000)   │  ◄─── Vector Embeddings
└────────┬────────┘        ◄─── Agent-Specific Collections
         │
         ▼
┌─────────────────┐
│   ChromaDB      │
│ Vector Database │
│                 │
│ Collections:    │
│ • chat_history_sam_altman
│ • chat_history_jensen_huang
│ • chat_history_andrew_ng
│ • chat_history_demis_hassabis
│ • chat_history_fei_fei_li
└─────────────────┘
```

## Installation

### Step 1: Install Python Dependencies

```bash
# Install ChromaDB and Sentence Transformers
pip install chromadb==0.5.23 sentence-transformers==3.3.1
```

**Note**: If you encounter permission issues, you may need to install manually or contact Replit support for package installation assistance.

### Step 2: Verify Python Files

Make sure these files exist in your project root:
- ✅ `chat_vectordb.py` - ChromaDB chat storage module
- ✅ `main.py` - FastAPI server (updated with ChromaDB endpoints)
- ✅ `models.py` - Pydantic models (updated with user_id)

### Step 3: Start Both Servers

#### Option A: Using the Startup Script (Recommended)

```bash
./start-both-servers.sh
```

This script starts:
1. Python FastAPI server on port 8000
2. Node.js Express server on port 5000

#### Option B: Manual Start (for debugging)

Terminal 1 - Python Server:
```bash
python main.py
```

Terminal 2 - Node.js Server:
```bash
npm run dev
```

## How It Works

### Chat Message Flow

1. **User sends a chat message** from the React frontend
2. **Node.js Express** receives the message at `/api/chat`
3. **Node.js forwards** the request to Python API at `http://localhost:8000/chat`
4. **Python FastAPI**:
   - Fetches chat history from agent-specific ChromaDB collection
   - Generates text embedding for the user message
   - Calls Gemini AI to generate response
   - Stores both user message and AI response in ChromaDB with embeddings
   - Returns the AI response
5. **Node.js** sends response back to frontend
6. **React** displays the chat message

### Agent Separation

Each agent maintains a **separate ChromaDB collection**:

```python
# Example collection names
chat_history_sam_altman
chat_history_jensen_huang
chat_history_andrew_ng
chat_history_demis_hassabis
chat_history_fei_fei_li
```

This ensures that:
- Sam Altman's chat history is completely separate from Jensen Huang's
- Each agent can only access their own conversation history
- No cross-contamination between agents

### Data Stored in ChromaDB

For each message:
```json
{
  "id": "uuid",
  "document": "The actual message text",
  "embedding": [0.1, 0.2, ..., 0.384],
  "metadata": {
    "run_id": "meeting-session-id",
    "user_id": "user-uuid",
    "sender": "user" or "agent",
    "timestamp": "2025-10-23T08:30:00Z",
    "agent": "Sam_Altman"
  }
}
```

## API Endpoints

### Python FastAPI (Port 8000)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/chat` | POST | Send chat message and get response |
| `/get_chat` | GET | Get chat history for agent & run |
| `/agent_stats/{agent}` | GET | Get stats for an agent's collection |

### Example: Send Chat Message

```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "run_id": "abc123",
    "agent": "Sam_Altman",
    "message": "What should be my AI strategy?",
    "user_id": "user-uuid"
  }'
```

### Example: Get Chat History

```bash
curl "http://localhost:8000/get_chat?run_id=abc123&agent=Sam_Altman"
```

## Troubleshooting

### Issue: Python dependencies not installed

**Solution**:
```bash
pip install chromadb sentence-transformers
```

If that doesn't work, try:
```bash
python -m pip install chromadb sentence-transformers
```

### Issue: Port 8000 already in use

**Solution**:
```bash
# Find and kill the process using port 8000
lsof -ti:8000 | xargs kill -9

# Then restart
python main.py
```

### Issue: ChromaDB initialization error

**Solution**: Delete the ChromaDB directory and restart:
```bash
rm -rf ./chroma_chat_db
python main.py
```

### Issue: Node.js can't connect to Python API

**Symptoms**: Error in Node.js logs: "Python API error: ECONNREFUSED"

**Solution**: Make sure Python server is running first:
```bash
# Check if Python server is running
curl http://localhost:8000/
# Should return: {"message": "Python AI Backend is running!", "status": "healthy"}
```

## Benefits of VectorDB Approach

1. **Agent Isolation**: Each agent has completely separate chat history
2. **Semantic Search**: Find similar past conversations using embeddings
3. **Scalability**: ChromaDB handles large volumes of chat messages efficiently
4. **Flexibility**: Easy to add new features like "find similar conversations"
5. **Performance**: Fast retrieval with vector similarity search

## Migration from PostgreSQL

The old PostgreSQL `chats` table is no longer used for chat storage. Chat history now lives in ChromaDB with separate collections per agent.

**What's still in PostgreSQL:**
- ✅ Users
- ✅ Runs (meeting sessions)
- ✅ Agent Memory (saved recommendations)
- ✅ Sessions

**What's now in ChromaDB:**
- ✅ Chat messages (user and agent)
- ✅ Chat embeddings
- ✅ Conversation metadata

## Future Enhancements

With vector database in place, you can now:

1. **Semantic Search**: "Find conversations about GPU strategy"
2. **Context Retrieval**: Automatically pull relevant past conversations
3. **Smart Summarization**: Summarize all conversations with an agent
4. **Recommendation Engine**: Suggest which agent to talk to based on past conversations

## Support

If you encounter issues:
1. Check both server logs (Node.js and Python)
2. Verify Python dependencies are installed
3. Ensure both servers are running
4. Check ChromaDB directory permissions
