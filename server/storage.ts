// Reference: javascript_database blueprint
import { 
  users, runs, chats, agentMemory, corpus, twins, preMeetingSessions, personaInterviewSessions, chatFollowupSessions,
  type User, type InsertUser,
  type Run, type InsertRun,
  type Chat, type InsertChat,
  type AgentMemory, type Corpus,
  type Twin, type InsertTwin,
  type PreMeetingSession, type InsertPreMeetingSession,
  type PersonaInterviewSession, type InsertPersonaInterviewSession,
  type ChatFollowupSession, type InsertChatFollowupSession
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;

  // Run operations
  createRun(run: InsertRun & { userId: string }): Promise<Run>;
  getRun(id: string): Promise<Run | undefined>;
  getUserRuns(userId: string): Promise<Run[]>;

  // Chat operations
  createChat(chat: InsertChat): Promise<Chat>;
  getChatsByRunAndAgent(runId: string, agent: string): Promise<Chat[]>;

  // Agent memory operations
  addAgentMemory(userId: string, agent: string, content: string, runId?: string): Promise<AgentMemory>;
  getAgentMemory(agentKey: string, limit?: number): Promise<AgentMemory[]>;
  getRecentMemories(userId: string, limit?: number): Promise<AgentMemory[]>;

  // Corpus operations
  addCorpusChunk(agent: string, fileName: string, chunkText: string, embedding?: string): Promise<Corpus>;
  getCorpusByAgent(agent: string): Promise<Corpus[]>;

  // Twin operations
  createTwin(twin: InsertTwin & { userId: string; companyDomain: string }): Promise<Twin>;
  getTwin(id: string): Promise<Twin | undefined>;
  getUserTwins(userId: string): Promise<Twin[]>;
  getTwinsByDomain(companyDomain: string): Promise<Twin[]>;
  deleteTwin(id: string): Promise<void>;

  // Pre-meeting session operations
  createPreMeetingSession(session: InsertPreMeetingSession & { userId: string }): Promise<PreMeetingSession>;
  getPreMeetingSession(id: string): Promise<PreMeetingSession | undefined>;
  updatePreMeetingSession(id: string, updates: Partial<PreMeetingSession>): Promise<PreMeetingSession | undefined>;
  deletePreMeetingSession(id: string): Promise<void>;

  // Persona Interview session operations
  createPersonaInterviewSession(session: InsertPersonaInterviewSession & { userId: string }): Promise<PersonaInterviewSession>;
  getPersonaInterviewSession(id: string): Promise<PersonaInterviewSession | undefined>;
  updatePersonaInterviewSession(id: string, updates: Partial<PersonaInterviewSession>): Promise<PersonaInterviewSession | undefined>;
  deletePersonaInterviewSession(id: string): Promise<void>;

  // Chat Followup session operations
  createChatFollowupSession(session: InsertChatFollowupSession & { userId: string }): Promise<ChatFollowupSession>;
  getChatFollowupSession(id: string): Promise<ChatFollowupSession | undefined>;
  updateChatFollowupSession(id: string, updates: Partial<ChatFollowupSession>): Promise<ChatFollowupSession | undefined>;
  deleteChatFollowupSession(id: string): Promise<void>;
  getActiveChatFollowupSession(userId: string, runId: string, agent: string): Promise<ChatFollowupSession | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async createRun(run: InsertRun & { userId: string }): Promise<Run> {
    const [newRun] = await db
      .insert(runs)
      .values(run)
      .returning();
    return newRun;
  }

  async getRun(id: string): Promise<Run | undefined> {
    const [run] = await db.select().from(runs).where(eq(runs.id, id));
    return run || undefined;
  }

  async getUserRuns(userId: string): Promise<Run[]> {
    return await db
      .select()
      .from(runs)
      .where(eq(runs.userId, userId))
      .orderBy(desc(runs.createdAt));
  }

  async createChat(chat: InsertChat): Promise<Chat> {
    const [newChat] = await db
      .insert(chats)
      .values(chat)
      .returning();
    return newChat;
  }

  async getChatsByRunAndAgent(runId: string, agent: string): Promise<Chat[]> {
    return await db
      .select()
      .from(chats)
      .where(and(eq(chats.runId, runId), eq(chats.agent, agent)))
      .orderBy(chats.createdAt);
  }

  async addAgentMemory(userId: string, agent: string, content: string, runId?: string): Promise<AgentMemory> {
    const [memory] = await db
      .insert(agentMemory)
      .values({ userId, agent, content, runId })
      .returning();
    return memory;
  }

  async getAgentMemory(agentKey: string, limit: number = 10): Promise<AgentMemory[]> {
    return db
      .select()
      .from(agentMemory)
      .where(eq(agentMemory.agent, agentKey))
      .orderBy(desc(agentMemory.createdAt))
      .limit(limit);
  }

  async getRecentMemories(userId: string, limit: number = 20): Promise<AgentMemory[]> {
    return db
      .select()
      .from(agentMemory)
      .where(eq(agentMemory.userId, userId))
      .orderBy(desc(agentMemory.createdAt))
      .limit(limit);
  }

  async addCorpusChunk(agent: string, fileName: string, chunkText: string, embedding?: string): Promise<Corpus> {
    const [chunk] = await db
      .insert(corpus)
      .values({ agent, fileName, chunkText, embedding })
      .returning();
    return chunk;
  }

  async getCorpusByAgent(agent: string): Promise<Corpus[]> {
    return await db
      .select()
      .from(corpus)
      .where(eq(corpus.agent, agent));
  }

  async createTwin(twin: InsertTwin & { userId: string; companyDomain: string }): Promise<Twin> {
    const [newTwin] = await db
      .insert(twins)
      .values(twin)
      .returning();
    return newTwin;
  }

  async getTwin(id: string): Promise<Twin | undefined> {
    const [twin] = await db.select().from(twins).where(eq(twins.id, id));
    return twin || undefined;
  }

  async getUserTwins(userId: string): Promise<Twin[]> {
    return await db
      .select()
      .from(twins)
      .where(eq(twins.userId, userId))
      .orderBy(desc(twins.createdAt));
  }

  async getTwinsByDomain(companyDomain: string): Promise<Twin[]> {
    return await db
      .select()
      .from(twins)
      .where(eq(twins.companyDomain, companyDomain))
      .orderBy(desc(twins.createdAt));
  }

  async deleteTwin(id: string): Promise<void> {
    await db.delete(twins).where(eq(twins.id, id));
  }

  async createPreMeetingSession(session: InsertPreMeetingSession & { userId: string }): Promise<PreMeetingSession> {
    const [newSession] = await db
      .insert(preMeetingSessions)
      .values(session)
      .returning();
    return newSession;
  }

  async getPreMeetingSession(id: string): Promise<PreMeetingSession | undefined> {
    const [session] = await db.select().from(preMeetingSessions).where(eq(preMeetingSessions.id, id));
    return session || undefined;
  }

  async updatePreMeetingSession(id: string, updates: Partial<PreMeetingSession>): Promise<PreMeetingSession | undefined> {
    const [session] = await db
      .update(preMeetingSessions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(preMeetingSessions.id, id))
      .returning();
    return session || undefined;
  }

  async deletePreMeetingSession(id: string): Promise<void> {
    await db.delete(preMeetingSessions).where(eq(preMeetingSessions.id, id));
  }

  async createPersonaInterviewSession(session: InsertPersonaInterviewSession & { userId: string }): Promise<PersonaInterviewSession> {
    const [newSession] = await db
      .insert(personaInterviewSessions)
      .values(session)
      .returning();
    return newSession;
  }

  async getPersonaInterviewSession(id: string): Promise<PersonaInterviewSession | undefined> {
    const [session] = await db.select().from(personaInterviewSessions).where(eq(personaInterviewSessions.id, id));
    return session || undefined;
  }

  async updatePersonaInterviewSession(id: string, updates: Partial<PersonaInterviewSession>): Promise<PersonaInterviewSession | undefined> {
    const [session] = await db
      .update(personaInterviewSessions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(personaInterviewSessions.id, id))
      .returning();
    return session || undefined;
  }

  async deletePersonaInterviewSession(id: string): Promise<void> {
    await db.delete(personaInterviewSessions).where(eq(personaInterviewSessions.id, id));
  }

  async createChatFollowupSession(session: InsertChatFollowupSession & { userId: string }): Promise<ChatFollowupSession> {
    const [newSession] = await db
      .insert(chatFollowupSessions)
      .values(session)
      .returning();
    return newSession;
  }

  async getChatFollowupSession(id: string): Promise<ChatFollowupSession | undefined> {
    const [session] = await db.select().from(chatFollowupSessions).where(eq(chatFollowupSessions.id, id));
    return session || undefined;
  }

  async updateChatFollowupSession(id: string, updates: Partial<ChatFollowupSession>): Promise<ChatFollowupSession | undefined> {
    const [session] = await db
      .update(chatFollowupSessions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(chatFollowupSessions.id, id))
      .returning();
    return session || undefined;
  }

  async deleteChatFollowupSession(id: string): Promise<void> {
    await db.delete(chatFollowupSessions).where(eq(chatFollowupSessions.id, id));
  }

  async getActiveChatFollowupSession(userId: string, runId: string, agent: string): Promise<ChatFollowupSession | undefined> {
    const [session] = await db
      .select()
      .from(chatFollowupSessions)
      .where(
        and(
          eq(chatFollowupSessions.userId, userId),
          eq(chatFollowupSessions.runId, runId),
          eq(chatFollowupSessions.agent, agent),
          eq(chatFollowupSessions.status, "active")
        )
      )
      .orderBy(desc(chatFollowupSessions.createdAt))
      .limit(1);
    return session || undefined;
  }
}

export const storage = new DatabaseStorage();