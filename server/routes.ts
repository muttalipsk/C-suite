import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, loginSchema, insertTwinSchema, AI_AGENTS } from "@shared/schema";
import { generateAgentRecommendation, generateChatResponse } from "./gemini";
import bcrypt from "bcrypt";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import axios from "axios";
import FormData from "form-data";
import multer from "multer";
import path from "path";
import fs from "fs";
import { Request, Response } from "express"; // Import Request and Response types

const PgSession = connectPgSimple(session);

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Session middleware
  app.use(
    session({
      store: new PgSession({
        pool,
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "ai-leaders-boardroom-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
      },
    })
  );

  // Auth middleware
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  };

  // Build user profile string from user data
  const buildUserProfile = (user: any): string => {
    return `Name: ${user.name}
Company: ${user.companyName}
Designation: ${user.designation}
Role Description: ${user.roleDescription}
Product Expectations: ${user.productExpectations}
Company Website: ${user.companyWebsite}
Role Details: ${user.roleDetails}
1-Year Goal: ${user.goalOneYear}
5-Year Goal: ${user.goalFiveYears}`;
  };

  // AUTHROUTES
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);

      // Check if user exists
      const existingUser = await storage.getUserByEmail(data.email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, 10);

      // Create user
      const user = await storage.createUser({
        ...data,
        password: hashedPassword,
      });

      // Set session
      req.session.userId = user.id;

      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        photo: user.photo
      });
    } catch (error: any) {
      console.error("Signup error:", error);
      res.status(400).json({ error: error.message || "Signup failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);

      // Find user
      const user = await storage.getUserByEmail(data.email);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Verify password
      const validPassword = await bcrypt.compare(data.password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Set session
      req.session.userId = user.id;

      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        photo: user.photo
      });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(400).json({ error: error.message || "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  // MEETING/RUN ROUTES - Forwards ALL agent operations to Python API
  // Track recent meeting requests to prevent duplicates
  const recentMeetingRequests = new Map<string, number>();
  const DUPLICATE_THRESHOLD_MS = 2000; // 2 seconds

  // Run meeting endpoint
  app.post("/api/meeting", requireAuth, async (req: Request, res: Response) => {
    try {
      const { task, agents, turns = 1, meetingType = "board" } = req.body;

      console.log("🔴 SERVER: POST /api/meeting received");
      console.log("  - meetingType:", meetingType);
      console.log("  - agents:", agents);
      console.log("  - task:", task?.substring(0, 50) + "...");
      console.log("  - Full body:", req.body);

      // Create a unique key for this request
      const requestKey = `${task}-${agents.join(',')}-${meetingType}`;
      const now = Date.now();

      // Check if we've seen this exact request recently
      if (recentMeetingRequests.has(requestKey)) {
        const lastRequestTime = recentMeetingRequests.get(requestKey)!;
        if (now - lastRequestTime < DUPLICATE_THRESHOLD_MS) {
          console.log("⚠️ Duplicate meeting request detected and ignored");
          return res.status(429).json({ error: "Duplicate request - please wait" });
        }
      }

      // Record this request
      recentMeetingRequests.set(requestKey, now);

      // Clean up old entries (older than 5 seconds)
      for (const [key, time] of Array.from(recentMeetingRequests.entries())) {
        if (now - time > 5000) {
          recentMeetingRequests.delete(key);
        }
      }

      if (!task || !agents || agents.length === 0) {
        return res.status(400).json({ error: "Task and agents are required" });
      }

      // Get user for profile
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      const userProfile = buildUserProfile(user);

      // Forward ALL agent operations to Python API with ChromaDB memory
      const axios = await import('axios');
      const pythonResponse = await axios.default.post("http://localhost:8000/meeting", {
        task,
        user_profile: userProfile,
        turns,
        agents,
        user_id: req.session.userId!.toString(),  // Pass user ID for VectorDB tracking
        meeting_type: meetingType,  // Pass meeting type for context-aware responses
      });

      const { run_id: pythonRunId, recommendations } = pythonResponse.data;

      // Save run to PostgreSQL database (Node.js handles DB persistence)
      // Store pythonRunId so we can map between DB ID and Python UUID
      const run = await storage.createRun({
        userId: req.session.userId!,
        task,
        userProfile,
        turns,
        agents,
        recommendations,
      });

      console.log(`Meeting completed: DB ID ${run.id}, Python Run ID ${pythonRunId}`);

      // IMPORTANT: Return Python's run_id to frontend (not DB ID)
      // Python /chat endpoint needs Python's UUID to find the run file
      res.json({
        runId: pythonRunId,  // Use Python's UUID so /chat can find the run file
        recommendations,
      });
    } catch (error: any) {
      console.error("Meeting error:", error);
      res.status(500).json({ error: error.message || "Failed to run meeting" });
    }
  });

  // QUESTION REFINEMENT ROUTE - Analyzes questions and suggests improvements
  app.post("/api/refine-question", requireAuth, async (req, res) => {
    try {
      const { question, agent, runId } = req.body;

      if (!question || !agent) {
        return res.status(400).json({ error: "question and agent are required" });
      }

      // Forward to Python API for question refinement
      const pythonResponse = await fetch("http://localhost:8000/refine-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          agent,
          run_id: runId,
        }),
      });

      const result = await pythonResponse.json();

      if (!pythonResponse.ok) {
        throw new Error(result.error || "Question refinement failed");
      }

      res.json(result);
    } catch (error: any) {
      console.error("Question refinement error:", error);
      // Return no refinement on error
      res.json({ needs_refinement: false, suggestions: [] });
    }
  });

  // CHAT ROUTES - Now uses Python VectorDB API
  app.post("/api/chat", requireAuth, async (req, res) => {
    try {
      const { runId, agent, message } = req.body;

      if (!runId || !agent || !message) {
        return res.status(400).json({ error: "runId, agent, and message are required" });
      }

      // Forward to Python API with VectorDB chat storage
      const pythonResponse = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          run_id: runId,
          agent,
          message,
          user_id: req.session.userId
        })
      });

      if (!pythonResponse.ok) {
        throw new Error(`Python API error: ${pythonResponse.statusText}`);
      }

      const data = await pythonResponse.json();
      res.json({ response: data.response });
    } catch (error: any) {
      console.error("Chat error:", error);
      res.status(500).json({ error: error.message || "Chat failed" });
    }
  });

  app.get("/api/chat/:runId/:agent", requireAuth, async (req, res) => {
    try {
      const { runId, agent } = req.params;

      // Fetch from Python VectorDB API (agent-specific collection)
      const pythonResponse = await fetch(`http://localhost:8000/get_chat?run_id=${runId}&agent=${agent}`);

      if (!pythonResponse.ok) {
        throw new Error(`Python API error: ${pythonResponse.statusText}`);
      }

      const data = await pythonResponse.json();

      // Convert format to match frontend expectations
      const history = data.history.map((h: any) => ({
        sender: h.user ? "user" : "agent",
        message: h.user || h.agent,
        timestamp: new Date().toISOString()
      }));

      res.json({ history });
    } catch (error) {
      console.error("Get chat error:", error);
      res.status(500).json({ error: "Failed to get chat history" });
    }
  });

  // MEMORY ROUTES
  app.post("/api/memory", requireAuth, async (req, res) => {
    try {
      const { agent, runId, content } = req.body;

      if (!agent || !content) {
        return res.status(400).json({ error: "agent and content are required" });
      }

      const memory = await storage.addAgentMemory(
        req.session.userId!,
        agent,
        content,
        runId
      );

      res.json({ success: true, memoryId: memory.id });
    } catch (error: any) {
      console.error("Memory save error:", error);
      res.status(500).json({ error: error.message || "Failed to save memory" });
    }
  });

  // Save recommendation to memory
  app.post("/api/save-recommendation", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { runId, agent, recommendation } = req.body;

    if (!runId || !agent || !recommendation) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const memory = await storage.addAgentMemory(
        req.session.userId,
        agent,
        recommendation,
        runId
      );

      res.json({ success: true, memoryId: memory.id });
    } catch (error: any) {
      console.error(`Error saving recommendation: ${error.message}`);
      res.status(500).json({ error: "Failed to save recommendation" });
    }
  });

  // Get agent memory for current user
  app.get("/api/agent-memory", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      // Get recent memories across all agents
      const memories = await storage.getRecentMemories(req.session.userId, 20);
      res.json({ memories });
    } catch (error: any) {
      console.error(`Error fetching agent memory: ${error.message}`);
      res.status(500).json({ error: "Failed to fetch agent memory" });
    }
  });

  // USER PROFILE ROUTES
  app.get("/api/profile", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Failed to get profile" });
    }
  });

  // Update user profile
  app.put("/api/profile", requireAuth, async (req, res) => {
    try {
      const updates = req.body;
      // Ensure we only update allowed fields and prevent modification of sensitive ones
      const allowedUpdates = [
        'name',
        'companyName',
        'designation',
        'roleDescription',
        'productExpectations',
        'companyWebsite',
        'roleDetails',
        'goalOneYear',
        'goalFiveYears',
        'photo'
      ];
      const sanitizedUpdates: Record<string, any> = {};
      for (const key of allowedUpdates) {
        if (updates.hasOwnProperty(key)) {
          sanitizedUpdates[key] = updates[key];
        }
      }

      const user = await storage.updateUser(req.session.userId!, sanitizedUpdates);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Failed to update profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // RUN HISTORY
  app.get("/api/runs", requireAuth, async (req, res) => {
    try {
      const runs = await storage.getUserRuns(req.session.userId!);
      res.json(runs);
    } catch (error) {
      res.status(500).json({ error: "Failed to get runs" });
    }
  });

  // ==== DIGITAL TWIN ROUTES ====

  // Configure multer for file uploads
  const upload = multer({
    dest: 'uploads/',
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB max file size
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['.txt', '.pdf', '.doc', '.docx', '.md'];
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowedTypes.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error('Only text files, PDFs, and documents are allowed'));
      }
    }
  });

  // Create a digital twin
  app.post("/api/twins/create", requireAuth, upload.array('files', 10), async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Extract company domain from email (e.g., user@company.com -> company.com)
      const companyDomain = user.email.split('@')[1];

      // Parse JSON data from request
      const {
        twinName,
        toneStyle,
        riskTolerance,
        coreValues,
        emojiPreference,
        sampleMessages,
        profileData
      } = req.body;

      // Validate required fields
      const parsed = insertTwinSchema.parse({
        twinName,
        toneStyle,
        riskTolerance,
        coreValues,
        emojiPreference: emojiPreference || "None",
        sampleMessages: JSON.parse(sampleMessages),
        profileData: JSON.parse(profileData),
        filesUploaded: (req.files as Express.Multer.File[])?.map(f => f.path) || []
      });

      // Create twin in database
      const twin = await storage.createTwin({
        ...parsed,
        userId: req.session.userId!,
        companyDomain
      });

      // Send files to Python API for vector embedding
      const formData = new FormData();
      formData.append('twin_id', twin.id);
      formData.append('sample_messages', sampleMessages);
      formData.append('profile_data', profileData);

      // Attach files to form data
      const files = req.files as Express.Multer.File[];
      if (files && files.length > 0) {
        for (const file of files) {
          const fileStream = fs.createReadStream(file.path);
          formData.append('files', fileStream, file.originalname);
        }
      }

      // Call Python API to create vector embeddings
      try {
        const pythonResponse = await axios.post(
          'http://localhost:8000/twin/create',
          formData,
          {
            headers: formData.getHeaders(),
            timeout: 180000 // 3 minutes for processing
          }
        );

        console.log('Twin vectors created:', pythonResponse.data);
      } catch (pythonError: any) {
        console.error('Python API error:', pythonError.message);
        // Don't fail the request - twin is created in DB
      }

      res.json({
        success: true,
        twin: {
          id: twin.id,
          twinName: twin.twinName,
          companyDomain: twin.companyDomain,
          createdAt: twin.createdAt
        }
      });
    } catch (error: any) {
      console.error("Twin creation error:", error);
      res.status(400).json({ error: error.message || "Failed to create twin" });
    }
  });

  // Get twins (filtered by company domain)
  app.get("/api/twins", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const companyDomain = user.email.split('@')[1];
      const twins = await storage.getTwinsByDomain(companyDomain);

      res.json({ twins });
    } catch (error) {
      console.error("Failed to get twins:", error);
      res.status(500).json({ error: "Failed to get twins" });
    }
  });

  // Chat with a digital twin
  app.post("/api/twins/:id/chat", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { message } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      // Get twin from database
      const twin = await storage.getTwin(id);
      if (!twin) {
        return res.status(404).json({ error: "Twin not found" });
      }

      // Verify access (must be from same company domain)
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const userDomain = user.email.split('@')[1];
      if (twin.companyDomain !== userDomain) {
        return res.status(403).json({ error: "Access denied - different company domain" });
      }

      // Call Python API for twin chat
      const formData = new FormData();
      formData.append('twin_id', twin.id);
      formData.append('message', message);
      formData.append('profile_data', JSON.stringify(twin.profileData));
      formData.append('tone_style', twin.toneStyle);
      formData.append('emoji_preference', twin.emojiPreference || "None");

      const pythonResponse = await axios.post(
        'http://localhost:8000/twin/chat',
        formData,
        {
          headers: formData.getHeaders(),
          timeout: 60000 // 1 minute
        }
      );

      res.json({
        response: pythonResponse.data.response,
        escalated: pythonResponse.data.escalated,
        contentFound: pythonResponse.data.content_found
      });
    } catch (error: any) {
      console.error("Twin chat error:", error);
      res.status(500).json({ error: error.response?.data?.error || "Failed to chat with twin" });
    }
  });

  // Upload knowledge base for AI leaders
  app.post("/api/agents/:agentName/knowledge", requireAuth, upload.array('files', 20), async (req, res) => {
    try {
      const { agentName } = req.params;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      // Forward files to Python API
      const formData = new FormData();
      formData.append('agent', agentName);

      for (const file of files) {
        const fileStream = fs.createReadStream(file.path);
        formData.append('files', fileStream, file.originalname);
      }

      const pythonResponse = await axios.post(
        'http://localhost:8000/agent/upload-knowledge',
        formData,
        {
          headers: formData.getHeaders(),
          timeout: 300000 // 5 minutes for large documents
        }
      );

      // Clean up uploaded files
      for (const file of files) {
        fs.unlinkSync(file.path);
      }

      res.json(pythonResponse.data);
    } catch (error: any) {
      console.error("Agent knowledge upload error:", error);
      res.status(500).json({
        error: error.response?.data?.error || "Failed to upload agent knowledge"
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}