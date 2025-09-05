import { serial, text, pgTable, timestamp, integer, real, jsonb, pgEnum, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Define memory type enum
export const memoryTypeEnum = pgEnum('memory_type', ['episodic', 'semantic', 'procedural', 'emotional', 'value-principle']);

// Define role enum for chat messages
export const roleEnum = pgEnum('role', ['user', 'assistant']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password_hash: text('password_hash').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Memories table - core of the LTM system
export const memoriesTable = pgTable('memories', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  embedding: real('embedding').array().notNull(), // Vector embedding for semantic search
  memory_type: memoryTypeEnum('memory_type').notNull(),
  summary: varchar('summary', { length: 500 }).notNull(), // Concise searchable summary
  full_text: text('full_text').notNull(), // Complete detailed context
  details: jsonb('details'), // Flexible metadata: keywords, dates, confidence, emotions, etc.
  confidence_score: real('confidence_score'), // Confidence in the memory accuracy (0-1)
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Chat sessions table
export const chatSessionsTable = pgTable('chat_sessions', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }), // Optional session title
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Chat messages table
export const chatMessagesTable = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  session_id: integer('session_id').notNull().references(() => chatSessionsTable.id, { onDelete: 'cascade' }),
  user_id: integer('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  role: roleEnum('role').notNull(), // 'user' or 'assistant'
  content: text('content').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Define relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  memories: many(memoriesTable),
  chatSessions: many(chatSessionsTable),
  chatMessages: many(chatMessagesTable),
}));

export const memoriesRelations = relations(memoriesTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [memoriesTable.user_id],
    references: [usersTable.id],
  }),
}));

export const chatSessionsRelations = relations(chatSessionsTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [chatSessionsTable.user_id],
    references: [usersTable.id],
  }),
  messages: many(chatMessagesTable),
}));

export const chatMessagesRelations = relations(chatMessagesTable, ({ one }) => ({
  session: one(chatSessionsTable, {
    fields: [chatMessagesTable.session_id],
    references: [chatSessionsTable.id],
  }),
  user: one(usersTable, {
    fields: [chatMessagesTable.user_id],
    references: [usersTable.id],
  }),
}));

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;
export type Memory = typeof memoriesTable.$inferSelect;
export type NewMemory = typeof memoriesTable.$inferInsert;
export type ChatSession = typeof chatSessionsTable.$inferSelect;
export type NewChatSession = typeof chatSessionsTable.$inferInsert;
export type ChatMessage = typeof chatMessagesTable.$inferSelect;
export type NewChatMessage = typeof chatMessagesTable.$inferInsert;

// Export all tables and relations for proper query building
export const tables = {
  users: usersTable,
  memories: memoriesTable,
  chatSessions: chatSessionsTable,
  chatMessages: chatMessagesTable,
};

export const tableRelations = {
  usersRelations,
  memoriesRelations,
  chatSessionsRelations,
  chatMessagesRelations,
};