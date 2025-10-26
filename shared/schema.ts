import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table with extended profile fields
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  photo: text("photo"), // URL to uploaded photo
  companyName: text("company_name").notNull(),
  designation: text("designation").notNull(),
  roleDescription: text("role_description").notNull(),
  productExpectations: text("product_expectations").notNull(),
  companyWebsite: text("company_website").notNull(),
  roleDetails: text("role_details").notNull(),
  goalOneYear: text("goal_one_year").notNull(),
  goalFiveYears: text("goal_five_years").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Meeting runs
export const runs = pgTable("runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  task: text("task").notNull(),
  userProfile: text("user_profile"), // Auto-populated from user data
  turns: integer("turns").notNull().default(1),
  agents: text("agents").array().notNull(), // Array of selected agent names
  recommendations: jsonb("recommendations").notNull(), // JSON object with agent recommendations
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Chat history
export const chats = pgTable("chats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").notNull().references(() => runs.id, { onDelete: "cascade" }),
  agent: text("agent").notNull(),
  message: text("message").notNull(),
  sender: text("sender").notNull(), // 'user' or 'agent'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Agent memory
export const agentMemory = pgTable("agent_memory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  runId: varchar("run_id"), // Nullable - memories can exist independently
  agent: text("agent").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Knowledge corpus for RAG
export const corpus = pgTable("corpus", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agent: text("agent").notNull(),
  fileName: text("file_name").notNull(),
  chunkText: text("chunk_text").notNull(),
  embedding: text("embedding"), // Stored as JSON string
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Digital Twins - User's AI replicas
export const twins = pgTable("twins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  twinName: text("twin_name").notNull(),
  companyDomain: text("company_domain").notNull(), // Email domain for access control (e.g., "redplutoanalytics.com")
  toneStyle: text("tone_style").notNull(), // "Direct", "Motivational", "Sarcastic", "Formal", "Humorous"
  riskTolerance: text("risk_tolerance").notNull(),
  coreValues: text("core_values").notNull(),
  emojiPreference: text("emoji_preference"), // e.g., "LOL", "None"
  sampleMessages: jsonb("sample_messages").notNull(), // Array of communication samples
  profileData: jsonb("profile_data").notNull(), // {q4Goal, coreStrategy, company, designation, etc.}
  filesUploaded: text("files_uploaded").array(), // Array of file paths in /uploads
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
}).extend({
  password: z.string().min(8, "Password must be at least 8 characters"),
  email: z.string().email("Invalid email address"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const insertRunSchema = createInsertSchema(runs).omit({
  id: true,
  createdAt: true,
  userId: true, // Will be set from session
});

export const insertChatSchema = createInsertSchema(chats).omit({
  id: true,
  createdAt: true,
});

export const insertCorpusSchema = createInsertSchema(corpus).omit({
  id: true,
  createdAt: true,
});

export const insertAgentMemorySchema = createInsertSchema(agentMemory).omit({
  id: true,
  createdAt: true,
  userId: true, // Will be set from session
});

export const insertTwinSchema = createInsertSchema(twins).omit({
  id: true,
  createdAt: true,
  userId: true, // Will be set from session
  companyDomain: true, // Will be extracted from user's email
}).extend({
  toneStyle: z.enum(["Direct", "Motivational", "Sarcastic", "Formal", "Humorous"]),
  sampleMessages: z.array(z.string()).min(3, "At least 3 sample messages required"),
});

// TypeScript types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export type Run = typeof runs.$inferSelect;
export type InsertRun = z.infer<typeof insertRunSchema>;

export type Chat = typeof chats.$inferSelect;
export type InsertChat = z.infer<typeof insertChatSchema>;

export type AgentMemory = typeof agentMemory.$inferSelect;
export type InsertAgentMemory = z.infer<typeof insertAgentMemorySchema>;

export type Corpus = typeof corpus.$inferSelect;

export type Twin = typeof twins.$inferSelect;
export type InsertTwin = z.infer<typeof insertTwinSchema>;

// AI Agent personas constants
export const AI_AGENTS = {
  Sam_Altman: {
    name: "Sam Altman",
    company: "OpenAI",
    role: "CEO",
    avatar: "@assets/generated_images/Sam_Altman_professional_headshot_a9283ae5.png",
  },
  Jensen_Huang: {
    name: "Jensen Huang",
    company: "NVIDIA",
    role: "CEO",
    avatar: "@assets/generated_images/Jensen_Huang_professional_headshot_dbf371ed.png",
  },
  Andrew_Ng: {
    name: "Andrew Ng",
    company: "DeepLearning.AI",
    role: "Founder",
    avatar: "@assets/generated_images/Andrew_Ng_professional_headshot_1ec25e6e.png",
  },
  Demis_Hassabis: {
    name: "Demis Hassabis",
    company: "Google DeepMind",
    role: "CEO",
    avatar: "@assets/generated_images/Demis_Hassabis_professional_headshot_ba7b28f2.png",
  },
  Fei_Fei_Li: {
    name: "Fei-Fei Li",
    company: "Stanford AI Lab",
    role: "Co-Director",
    avatar: "@assets/generated_images/Fei-Fei_Li_professional_headshot_516c6cd4.png",
  },
} as const;

export type AgentKey = keyof typeof AI_AGENTS;
