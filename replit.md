# Ask the Expert

## Overview

Ask the Expert is a full-stack web application designed for C-suite executives, offering personalized strategic recommendations through interactions with digital twins of prominent AI industry leaders. The platform simulates advisory conversations with AI personas like Sam Altman, Jensen Huang, Andrew Ng, Demis Hassabis, and Fei-Fei Li.

Key capabilities include:
- Uploading professional profiles and goals.
- Running strategic advisory meetings with selected AI leaders.
- Receiving tailored recommendations and engaging in follow-up conversations.
- Accessing knowledge bases from each leader's expertise.
- AI-driven refinement of meeting tasks and personalized question generation.
- Creation of personalized digital twins mirroring user communication styles and expertise.
- Interaction with digital twins of colleagues within their company domain.
- AI-powered communication style analysis from email samples.

The project aims to provide executives with on-demand strategic guidance, leveraging advanced AI to simulate expert consultations and foster informed decision-making.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend uses React with TypeScript and Vite. It leverages Shadcn/ui for components, Radix UI for primitives, and Tailwind CSS for styling, adhering to a modern light theme with vibrant blue accents. State management is handled by React Query for server state and React Hook Form with Zod for forms. Key design decisions include a component-based architecture, custom path aliases, progressive disclosure for forms, and responsive grid layouts.

### Backend Architecture
The system employs a dual-backend architecture:
1.  **Node.js Express Server (Port 5000)**: TypeScript, ESM, session-based authentication, RESTful API, JSON format, PostgreSQL session store. It forwards chat operations to the Python API.
2.  **Python FastAPI Server (Port 8000)**: Python 3.11, FastAPI, ChromaDB for chat history, Sentence-Transformers (initially, now Gemini embedding model) for embeddings, and Google Gemini AI for chat responses. Each AI agent has a separate ChromaDB collection.

**AI Integration Layer:**
-   Utilizes Google Gemini AI (gemini-2.5-flash model) for recommendations, employing system prompts tailored for C-suite advisory and structured response formats (Summary, Key Recommendations, Rationale, Next Steps). Temperature is set to 0.2 for consistent responses.
-   **VectorDB Chat Storage:** ChromaDB stores chat history with agent-specific collections, using Gemini's embedding model for generating embeddings. Semantic search is enabled for past conversations.

**Feature Specifications:**
-   **Structured Markdown Chat Responses**: Chat outputs are formatted in structured markdown, parsed by a shared utility (`lib/parseRecommendation.ts`) for consistent display and enhanced security.
-   **Automatic Digital Twin Metadata Generation**: AI-powered extraction and storage of twin metadata (company, role, description, knowledge) in a `twin_metadata` table, used in Gemini prompts for personalized interactions.
-   **Custom Persona Creation System**: Features a 20-Question Personalized Interview (AI-generated based on user profile to avoid redundancy, validated for structure and relevance) and Email Writing Style Analysis (extracts tone, formality, etc.).
-   **Counter-Questioning System**: Replaces inline question refinement with an AI-driven conversational pre-meeting process. Gemini AI dynamically gathers context by asking 3-4 comprehensive questions before proceeding to a meeting, ensuring thorough information collection.
-   **Vibrant Attractive Design**: A modern light theme with gradients, glass morphism effects, gradient text, colorful shadows, and smooth animations using Framer Motion.

### Data Storage
-   **PostgreSQL (Neon serverless)**: Primary database using Drizzle ORM for type-safe queries. Stores `Users`, `Runs`, `Agent Memory`, `Session` data. User profiles include professional details, goals, and company info.
-   **ChromaDB Vector Database**: Stores chat history in agent-specific collections, with chat message text, embeddings, and metadata (run_id, user_id, sender, timestamp).

### Key Architectural Patterns
-   Middleware for session management and authentication.
-   Centralized error handling and robust logging.
-   Clear separation of concerns (routes, storage, AI logic).
-   Node.js acts as an orchestration layer for Python-based AI operations.

## External Dependencies

**AI & Machine Learning:**
-   **Google Gemini API (@google/genai)**: Primary LLM for strategic recommendations (model: gemini-2.5-flash).
-   **Google Gemini Embedding Model**: Used for generating text embeddings in ChromaDB.

**Database & Infrastructure:**
-   **Neon Postgres (@neondatabase/serverless)**: Serverless PostgreSQL database.
-   **ChromaDB**: Lightweight vector database for chat history.

**Authentication & Security:**
-   **bcrypt**: Password hashing.
-   **express-session**: Session management.
-   **connect-pg-simple**: PostgreSQL session store.

**Development Tools:**
-   **Drizzle Kit**: Database migrations and schema management.
-   **Vite**: Build tool.

**UI Dependencies:**
-   **Radix UI**: Accessible component primitives.
-   **Tailwind CSS**: Utility-first styling framework.
-   **Lucide React**: Icon library.
-   **date-fns**: Date formatting.
-   **Framer Motion**: Animation library.

**Type Safety:**
-   **Zod**: Runtime schema validation.
-   **drizzle-zod**: Schema-to-Zod conversion.