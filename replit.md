# Ask the Expert

## Overview

Ask the Expert is a full-stack web application that provides C-suite executives with personalized strategic recommendations from digital twins of prominent AI industry leaders. The platform simulates advisory conversations with AI personas including Sam Altman (OpenAI), Jensen Huang (NVIDIA), Andrew Ng (DeepLearning.AI), Demis Hassabis (Google DeepMind), and Fei-Fei Li (Stanford AI Lab).

The application enables users to:
- Upload their professional profile and goals
- Run strategic advisory meetings with selected AI leaders
- Receive tailored recommendations based on their specific context
- Engage in follow-up conversations with individual advisors
- Access knowledge bases from each leader's writings and expertise
- **NEW: Inline question refinement** - AI analyzes meeting tasks in real-time and suggests improved versions before running meetings
- **NEW: Create personalized digital twins** that mirror their communication style and expertise
- **NEW: Chat with digital twins** from colleagues within their company domain

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System:**
- React with TypeScript for type-safe component development
- Vite as the build tool and development server
- Client-side rendering with no server-side rendering (RSR: false)

**UI Component System:**
- Shadcn/ui component library with "new-york" style variant
- Radix UI primitives for accessible, unstyled components
- Tailwind CSS for utility-first styling with custom design tokens
- Modern light theme with vibrant blue accents (inspired by Linear and Stripe)

**State Management:**
- React Query (TanStack Query) for server state management
- React Hook Form with Zod validation for form handling
- Session-based authentication state

**Key Design Decisions:**
- Component-based architecture with clear separation between auth, dashboard, and UI layers
- Custom path aliases (@/, @shared/, @assets/) for clean imports
- Progressive disclosure pattern for multi-step signup form
- Responsive grid layouts (3-column desktop, 2-column tablet, single-column mobile)

### Backend Architecture

**Dual-Backend System:**
1. **Node.js Express Server** (Port 5000)
   - TypeScript with ESM module system
   - Session-based authentication using express-session
   - RESTful endpoints under /api prefix
   - JSON request/response format
   - PostgreSQL session store for persistence
   - Forwards chat operations to Python API

2. **Python FastAPI Server** (Port 8000)
   - Python 3.11 with FastAPI framework
   - ChromaDB vector database for chat history storage
   - Sentence-Transformers for text embeddings
   - Google Gemini AI integration for chat responses
   - Each agent has separate ChromaDB collection

**AI Integration Layer:**
- Google Gemini AI (gemini-2.5-flash model) for generating recommendations
- System prompts designed for C-suite strategic advisory context
- Structured response format (Summary, Key Recommendations, Rationale, Next Steps)
- Temperature set to 0.2 for consistent, focused responses

**VectorDB Chat Storage:**
- ChromaDB (lightweight vector database) for chat history
- **Gemini Embedding Model (models/embedding-001)** for embedding generation (replaced sentence-transformers for faster startup)
- Agent-specific collections (e.g., chat_history_sam_altman, chat_history_jensen_huang)
- Semantic search capabilities for finding similar past conversations
- Metadata: run_id, user_id, sender, timestamp stored with each message

**Recent Changes (November 4, 2025):**
- **Counter-Questioning System** (In Development): Conversational information gathering before meetings
  - Replaces question refinement with ChatGPT-style counter-questions
  - Uses vector DB to evaluate if question has 80% accuracy potential
  - Asks follow-up questions to gather missing information
  - Continues conversation until 80% accuracy threshold is met
  - Sends complete conversation context to meeting endpoint
  - Architecture: PreMeetingSession storage, /api/pre-meeting endpoints, chat-style UI

- **Vibrant Attractive Design**: Modern light theme with gradients and visual depth
  - Electric blue (#4F46E5) to rich purple (#9333EA) gradient palette
  - Glass morphism effects with backdrop blur on cards and panels
  - Gradient text effects on headers and titles
  - Colorful shadows and enhanced visual depth
  - Smooth animations with Framer Motion for all interactions
  - Professional micro-interactions (hover, tap, entrance animations)

**Recent Changes (October 26, 2025):**
- **Digital Twin Feature**: Complete implementation of personalized digital twins
  - Dual ChromaDB vector storage: separate Content & Style collections per twin
  - Semantic chunking using Gemini for intelligent text splitting
  - RAG workflow: Content retrieval → Profile fallback → Escalation + Style RAG (mandatory)
  - Company domain-based access control for twin visibility
  - File upload support (PDF, TXT, DOC, MD) with multer middleware
  - Frontend: CreateTwinPage and TwinsPage with routing
  - Navigation: Wouter routing integrated into DashboardPage

**Recent Changes (October 23, 2025):**
- Replaced sentence-transformers with Gemini embedding API to fix slow Python server startup
- Removed LangChain LLM wrappers, now using genai.GenerativeModel directly for better performance
- Moved genai.configure() to FastAPI startup event with proper error handling
- Added ensure_genai_configured() function for lazy initialization
- Fixed run ID mismatch: Node.js now returns Python's UUID instead of Postgres ID to /chat endpoint

**Key Architectural Patterns:**
- Middleware pipeline for session management and authentication
- Centralized error handling
- Request/response logging for API routes
- Separation of concerns: routes, storage, AI logic in distinct modules
- Inter-service communication: Node.js → Python API for chat operations

### Data Storage

**Database:**
- PostgreSQL via Neon serverless with WebSocket connections
- Drizzle ORM for type-safe database queries
- Schema-first approach with shared types between frontend and backend

**Data Models:**

*PostgreSQL Database:*
1. **Users Table** - Extended profile with professional details, goals, company info, and photo
2. **Runs Table** - Meeting sessions with task, selected agents, and JSON recommendations
3. **Agent Memory Table** - Long-term memory storage per agent (recommendations saved by user)
4. **Session Table** - Express session storage

*ChromaDB Vector Database:*
1. **Chat Collections** - One collection per agent (e.g., chat_history_sam_altman)
   - Documents: Chat message text
   - Embeddings: 384-dimensional vectors from sentence-transformers
   - Metadata: run_id, user_id, sender (user/agent), timestamp

**Session Management:**
- PostgreSQL-backed session store (connect-pg-simple)
- 30-day cookie expiration
- HTTP-only cookies with secure flag in production

**Key Design Decisions:**
- User profiles auto-populate meeting context
- Recommendations stored as JSONB for flexible querying
- **Chat history now stored in VectorDB with separate collections per agent**
- Agent memory enables continuity across conversations
- Vector embeddings enable semantic search of past conversations

### External Dependencies

**AI & Machine Learning:**
- Google Gemini API (@google/genai) - Primary LLM for generating strategic recommendations
- API Key required: GEMINI_API_KEY environment variable
- Model: gemini-2.5-flash for balanced performance and quality

**Database & Infrastructure:**
- Neon Postgres (@neondatabase/serverless) - Serverless PostgreSQL database
- WebSocket support for serverless connections
- DATABASE_URL environment variable required

**Authentication & Security:**
- bcrypt - Password hashing (v6.0.0)
- express-session - Session management
- connect-pg-simple - PostgreSQL session store

**Development Tools:**
- Drizzle Kit - Database migrations and schema management
- Vite plugins for Replit integration (@replit/vite-plugin-*)
- ESBuild for server-side bundling

**UI Dependencies:**
- Radix UI - Accessible component primitives (15+ packages)
- Tailwind CSS - Utility-first styling
- Lucide React - Icon library
- date-fns - Date formatting utilities

**Type Safety:**
- Zod - Runtime schema validation
- drizzle-zod - Schema-to-Zod conversion
- TypeScript strict mode enabled

**Key Integration Points:**
- Session secret configurable via SESSION_SECRET environment variable
- All database operations use connection pooling
- AI responses parsed for structured recommendation display
- File uploads converted to base64 for photo storage