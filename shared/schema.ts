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

// Email Accounts - Connected email providers
export const emailAccounts = pgTable("email_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(), // "gmail" or "outlook"
  emailAddress: text("email_address").notNull(),
  accessToken: text("access_token"), // Encrypted OAuth token
  refreshToken: text("refresh_token"), // Encrypted OAuth refresh token
  tokenExpiry: timestamp("token_expiry"),
  isActive: text("is_active").notNull().default("true"), // "true" or "false"
  lastSyncedAt: timestamp("last_synced_at"),
  emailsAnalyzed: integer("emails_analyzed").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// CRM Connections - Connected business systems
export const crmConnections = pgTable("crm_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(), // "hubspot", "salesforce", etc.
  accessToken: text("access_token"), // Encrypted OAuth token
  refreshToken: text("refresh_token"),
  tokenExpiry: timestamp("token_expiry"),
  isActive: text("is_active").notNull().default("true"),
  lastSyncedAt: timestamp("last_synced_at"),
  metadata: jsonb("metadata"), // Provider-specific config
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Decision Logs - Strategic decisions extracted from emails/meetings
export const decisionLogs = pgTable("decision_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  twinId: varchar("twin_id").references(() => twins.id, { onDelete: "cascade" }),
  source: text("source").notNull(), // "email", "meeting", "document"
  sourceId: text("source_id"), // Email ID, meeting ID, etc.
  decision: text("decision").notNull(),
  rationale: text("rationale"),
  outcome: text("outcome"),
  context: jsonb("context"), // Relevant KPIs, participants, etc.
  decisionDate: timestamp("decision_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Digital Twins - User's AI replicas with confidence tracking
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
  
  // NEW: Data ingestion tracking
  emailAccountId: varchar("email_account_id").references(() => emailAccounts.id, { onDelete: "set null" }),
  crmConnectionId: varchar("crm_connection_id").references(() => crmConnections.id, { onDelete: "set null" }),
  ingestionStatus: text("ingestion_status").default("pending"), // "pending", "processing", "completed", "failed"
  ingestionProgress: jsonb("ingestion_progress"), // {emailsProcessed, crmDataSynced, decisionsExtracted}
  
  // NEW: Confidence scoring
  styleConfidence: integer("style_confidence").default(0), // 0-100 score
  contextConfidence: integer("context_confidence").default(0), // 0-100 score
  decisionConfidence: integer("decision_confidence").default(0), // 0-100 score
  overallConfidence: integer("overall_confidence").default(0), // 0-100 weighted average
  
  // NEW: Data source metadata
  dataSourceStats: jsonb("data_source_stats"), // {emailCount, crmRecords, decisionCount, lastUpdated}
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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

export const insertEmailAccountSchema = createInsertSchema(emailAccounts).omit({
  id: true,
  createdAt: true,
  userId: true, // Will be set from session
});

export const insertCrmConnectionSchema = createInsertSchema(crmConnections).omit({
  id: true,
  createdAt: true,
  userId: true, // Will be set from session
});

export const insertDecisionLogSchema = createInsertSchema(decisionLogs).omit({
  id: true,
  createdAt: true,
  userId: true, // Will be set from session
});

export const insertTwinSchema = createInsertSchema(twins).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  userId: true, // Will be set from session
  companyDomain: true, // Will be extracted from user's email
  ingestionStatus: true, // Managed by backend
  ingestionProgress: true, // Managed by backend
  styleConfidence: true, // Calculated by system
  contextConfidence: true, // Calculated by system
  decisionConfidence: true, // Calculated by system
  overallConfidence: true, // Calculated by system
  dataSourceStats: true, // Calculated by system
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

export type EmailAccount = typeof emailAccounts.$inferSelect;
export type InsertEmailAccount = z.infer<typeof insertEmailAccountSchema>;

export type CrmConnection = typeof crmConnections.$inferSelect;
export type InsertCrmConnection = z.infer<typeof insertCrmConnectionSchema>;

export type DecisionLog = typeof decisionLogs.$inferSelect;
export type InsertDecisionLog = z.infer<typeof insertDecisionLogSchema>;

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
