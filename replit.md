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
- **NEW: 20-Question Personalized Interview** - AI generates unique questions based on user's profile to avoid redundancy
  - Gemini analyzes existing profile (name, company, title, industry) to generate personalized questions
  - Two-layer redundancy prevention: AI prompt instruction + post-generation validation filter
  - Validation ensures exactly 4 questions per category (Identity, Decision-Making, Goals, Communication, Expertise)
  - Best-effort filter catches common confirmation patterns while allowing strategic contextual questions
- **NEW: Email Writing Style Analysis** - Upload/paste 10-20 emails for AI-powered communication style extraction

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

**Recent Changes (November 5, 2025):**
- **Custom Persona Creation System** (COMPLETED): AI-powered personalized interview system
  - **20-Question Personalized Interview**: AI generates unique questions based on user's existing profile
    - Gemini AI analyzes user profile to avoid redundant questions
    - Questions tailored to user's role, industry, and context
    - 5 categories: Identity & Expertise, Decision-Making, Goals & Vision, Communication Style, Expertise & Challenges
    - Temperature 0.7 for conversational, natural questions
    - **Validation System**: Programmatically enforces structure and filters redundancy
      - Ensures exactly 4 questions per category (20 total)
      - Filters questions about name, title, company, industry if already in profile
      - Maps AI category variations to standard names
      - Fills gaps with curated fallback questions if AI output is incomplete
    - Fallback to curated questions if AI generation fails
  - **Smart Question Generation**: Doesn't ask about information already in profile
    - Programmatic keyword extraction from user profile
    - Filters redundant phrases ("what is your name", "your current title")
    - If user already has name/title/company in profile, asks deeper questions
    - Builds on existing knowledge to capture unique thinking patterns
    - Personalizes to specific role (CEO vs CTO vs Founder)
  - **Email Writing Style Analysis**: AI-powered analysis of 10-20 email samples
    - Extracts tone, formality level, common phrases, emoji usage
    - Identifies signature patterns and key communication characteristics
  - **Domain-Based Access Control**: Personas only visible to same @domain users
  - **Python Endpoints**: 
    - POST /persona-interview/generate-questions (generates personalized questions)
    - POST /persona-interview/next-question (sequential interview flow)
    - POST /persona-interview/analyze-emails (writing style analysis)
    - POST /persona-interview/generate-summary (persona summary generation)
  - **Database Schema**: persona_interview_sessions table for session state management
  - **UI Navigation**: "Create Persona" option added between "View Profile" and "Logout"
  - **Integration**: Uses existing twin storage (ChromaDB dual collections for content + style)

- **Counter-Questioning System** (COMPLETED): ChatGPT-style pre-meeting conversation system
  - Replaces inline question refinement with conversational information gathering
  - **AI-Driven Readiness**: Gemini AI decides when enough information is gathered (no percentage thresholds)
    - Uses evaluate_readiness_with_ai function with READY/CONTINUE decision logic
    - **Dynamic Information Gathering**: Asks 3-4 questions to gather comprehensive context
    - Hard safety limit: Forces readiness after 5 user responses (maximum questions)
    - AI evaluates 5 key areas: context, goals, constraints, timeline, stakeholders
    - Proceeds when 4-5 areas are sufficiently covered
    - Natural conversation flow without visible accuracy metrics
  - **Counter-Question Generation**: Uses Gemini to ask natural, conversational follow-up questions
    - Temperature 0.8 for varied, ChatGPT-like responses
    - Focuses on gathering comprehensive information across key areas
    - Questions are thoughtful and meaningful (1-2 sentences)
    - No mention of "accuracy" or percentages in user-facing messages
    - Tailored to expertise of selected advisors
  - **Architecture**:
    - PostgreSQL: PreMeetingSession table tracks conversation state (status: active/completed/cancelled)
    - Node.js: /api/pre-meeting/init, /iterate, /complete endpoints with hard 5-turn limit
    - Python: /pre-meeting/generate-question (first question) and /pre-meeting/evaluate endpoints
    - Frontend: PreMeetingConversation component with pure chat UI (no progress bar)
  - **User Flow**: Submit question → 3-4 comprehensive questions → Auto-proceed to meeting (max 5 questions)
  - **Enriched Context**: Complete conversation history sent to meeting endpoint for better recommendations

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