// Reference: javascript_database blueprint
import { 
  users, runs, chats, agentMemory, corpus,
  type User, type InsertUser,
  type Run, type InsertRun,
  type Chat, type InsertChat,
  type AgentMemory, type Corpus
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

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
      .where(eq(chats.runId, runId))
      .where(eq(chats.agent, agent))
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
}

export const storage = new DatabaseStorage();