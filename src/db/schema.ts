import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().unique(),
  openrouterApiKey: text("openrouter_api_key"),
  openrouterModel: text("openrouter_model").default("anthropic/claude-sonnet-4"),
  agentAutoReply: integer("agent_auto_reply", { mode: "boolean" }).default(false),
  agentAutoSummary: integer("agent_auto_summary", { mode: "boolean" }).default(false),
  agentTone: text("agent_tone").default("professional"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const agentLogs = sqliteTable("agent_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  action: text("action").notNull(),
  source: text("source").notNull(),
  input: text("input"),
  output: text("output"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (table) => ({
  userIdIdx: index("agent_logs_user_id_idx").on(table.userId),
}));

export const notes = sqliteTable("notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  source: text("source"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const graphSubscriptions = sqliteTable("graph_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  resource: text("resource").notNull(),
  subscriptionId: text("subscription_id").notNull(),
  expirationDateTime: integer("expiration_date_time", { mode: "timestamp" }).notNull(),
  changeType: text("change_type").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (table) => ({
  userIdIdx: index("graph_subscriptions_user_id_idx").on(table.userId),
}));

export const messageQueue = sqliteTable("message_queue", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  source: text("source", { enum: ["email", "teams"] }).notNull(),
  resourceId: text("resource_id").notNull(),
  chatId: text("chat_id"),
  subject: text("subject"),
  fromAddress: text("from_address").notNull(),
  body: text("body").notNull(),
  status: text("status", { enum: ["pending", "processing", "completed", "failed", "awaiting_approval"] }).notNull().default("pending"),
  aiResponse: text("ai_response"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  processedAt: integer("processed_at", { mode: "timestamp" }),
}, (table) => ({
  userIdIdx: index("message_queue_user_id_idx").on(table.userId),
  statusIdx: index("message_queue_status_idx").on(table.status),
}));

export const approvalResponses = sqliteTable("approval_responses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  queueId: integer("queue_id").notNull().references(() => messageQueue.id),
  draftResponse: text("draft_response").notNull(),
  source: text("source", { enum: ["email", "teams"] }).notNull(),
  recipientInfo: text("recipient_info").notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  decidedAt: integer("decided_at", { mode: "timestamp" }),
}, (table) => ({
  userIdIdx: index("approval_responses_user_id_idx").on(table.userId),
  queueIdIdx: index("approval_responses_queue_id_idx").on(table.queueId),
}));
