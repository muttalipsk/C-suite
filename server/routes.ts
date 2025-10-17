import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, loginSchema, AI_AGENTS } from "@shared/schema";
import { generateRecommendation, generateChatResponse } from "./gemini";
import bcrypt from "bcrypt";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";

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

  // AUTH ROUTES
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

  // MEETING/RUN ROUTES
  app.post("/api/meeting", requireAuth, async (req, res) => {
    try {
      const { task, agents, turns = 1 } = req.body;

      if (!task || !agents || agents.length === 0) {
        return res.status(400).json({ error: "Task and agents are required" });
      }

      // Get user for profile
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      const userProfile = buildUserProfile(user);

      // Generate recommendations from all selected agents in parallel
      const recommendations: Record<string, string> = {};
      
      await Promise.all(
        agents.map(async (agentKey: string) => {
          const agent = AI_AGENTS[agentKey as keyof typeof AI_AGENTS];
          if (!agent) return;

          // Get agent memory
          const memoryRecords = await storage.getAgentMemory(agentKey, 5);
          const memory = memoryRecords.map(m => m.content).join('\n');

          // Generate recommendation
          const recommendation = await generateRecommendation(
            agent.name,
            agent.company,
            agent.role,
            `AI industry leader specializing in ${agent.company}'s domain`,
            task,
            userProfile,
            "", // knowledge - would be loaded from corpus in full implementation
            memory
          );

          recommendations[agentKey] = recommendation;

          // Save to agent memory
          await storage.addAgentMemory(
            req.session.userId!,
            agentKey,
            `Recommendation for task: "${task}". Summary: ${recommendation.substring(0, 200)}...`
          );
        })
      );

      // Save run
      const run = await storage.createRun({
        userId: req.session.userId!,
        task,
        userProfile,
        turns,
        agents,
        recommendations,
      });

      res.json({
        runId: run.id,
        recommendations,
      });
    } catch (error: any) {
      console.error("Meeting error:", error);
      res.status(500).json({ error: error.message || "Failed to run meeting" });
    }
  });

  // CHAT ROUTES
  app.post("/api/chat", requireAuth, async (req, res) => {
    try {
      const { runId, agent, message } = req.body;

      if (!runId || !agent || !message) {
        return res.status(400).json({ error: "runId, agent, and message are required" });
      }

      // Get run
      const run = await storage.getRun(runId);
      if (!run) {
        return res.status(404).json({ error: "Run not found" });
      }

      // Get agent info
      const agentInfo = AI_AGENTS[agent as keyof typeof AI_AGENTS];
      if (!agentInfo) {
        return res.status(400).json({ error: "Invalid agent" });
      }

      // Get chat history
      const history = await storage.getChatsByRunAndAgent(runId, agent);
      const chatHistory = history.map(h => ({
        user: h.sender === "user" ? h.message : "",
        agent: h.sender === "agent" ? h.message : "",
      })).filter(h => h.user || h.agent);

      // Get agent memory
      const memoryRecords = await storage.getAgentMemory(agent, 5);
      const memory = memoryRecords.map(m => m.content).join('\n');

      // Get previous recommendation
      const recommendation = run.recommendations[agent] || "";

      // Generate response
      const response = await generateChatResponse(
        agentInfo.name,
        agentInfo.company,
        agentInfo.role,
        `AI industry leader specializing in ${agentInfo.company}'s domain`,
        run.task,
        run.userProfile || "",
        recommendation,
        chatHistory,
        message,
        "", // knowledge
        memory
      );

      // Save messages
      await storage.createChat({
        runId,
        agent,
        message,
        sender: "user",
      });

      await storage.createChat({
        runId,
        agent,
        message: response,
        sender: "agent",
      });

      res.json({ response });
    } catch (error: any) {
      console.error("Chat error:", error);
      res.status(500).json({ error: error.message || "Chat failed" });
    }
  });

  app.get("/api/chat/:runId/:agent", requireAuth, async (req, res) => {
    try {
      const { runId, agent } = req.params;
      
      const history = await storage.getChatsByRunAndAgent(runId, agent);
      
      res.json({
        history: history.map(h => ({
          sender: h.sender,
          message: h.message,
          timestamp: h.createdAt,
        })),
      });
    } catch (error) {
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

  app.put("/api/profile", requireAuth, async (req, res) => {
    try {
      const updates = req.body;
      delete updates.id;
      delete updates.password; // Don't allow password updates this way

      const user = await storage.updateUser(req.session.userId!, updates);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
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

  const httpServer = createServer(app);

  return httpServer;
}
