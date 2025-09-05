import { z } from 'zod';

// Memory type enum schema
export const memoryTypeSchema = z.enum(['episodic', 'semantic', 'procedural', 'emotional', 'value-principle']);
export type MemoryType = z.infer<typeof memoryTypeSchema>;

// User schema
export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().email(),
  password_hash: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});
export type User = z.infer<typeof userSchema>;

// User input schemas
export const createUserInputSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8)
});
export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const loginUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string()
});
export type LoginUserInput = z.infer<typeof loginUserInputSchema>;

// Memory schema
export const memorySchema = z.object({
  id: z.number(),
  user_id: z.number(),
  embedding: z.array(z.number()),
  memory_type: memoryTypeSchema,
  summary: z.string(),
  full_text: z.string(),
  details: z.record(z.any()).nullable(), // Flexible JSON field
  confidence_score: z.number().min(0).max(1).nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});
export type Memory = z.infer<typeof memorySchema>;

// Memory input schemas
export const createMemoryInputSchema = z.object({
  user_id: z.number(),
  embedding: z.array(z.number()),
  memory_type: memoryTypeSchema,
  summary: z.string().min(1).max(500),
  full_text: z.string().min(1),
  details: z.record(z.any()).nullable().optional(),
  confidence_score: z.number().min(0).max(1).nullable().optional()
});
export type CreateMemoryInput = z.infer<typeof createMemoryInputSchema>;

export const updateMemoryInputSchema = z.object({
  id: z.number(),
  embedding: z.array(z.number()).optional(),
  memory_type: memoryTypeSchema.optional(),
  summary: z.string().min(1).max(500).optional(),
  full_text: z.string().min(1).optional(),
  details: z.record(z.any()).nullable().optional(),
  confidence_score: z.number().min(0).max(1).nullable().optional()
});
export type UpdateMemoryInput = z.infer<typeof updateMemoryInputSchema>;

// Memory search/filter schema
export const searchMemoriesInputSchema = z.object({
  user_id: z.number(),
  query: z.string().optional(),
  memory_type: memoryTypeSchema.optional(),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
  embedding: z.array(z.number()).optional() // For semantic search
});
export type SearchMemoriesInput = z.infer<typeof searchMemoriesInputSchema>;

// Chat session schema
export const chatSessionSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  title: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});
export type ChatSession = z.infer<typeof chatSessionSchema>;

// Chat message schema
export const chatMessageSchema = z.object({
  id: z.number(),
  session_id: z.number(),
  user_id: z.number(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  created_at: z.coerce.date()
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

// Chat input schemas
export const createChatSessionInputSchema = z.object({
  user_id: z.number(),
  title: z.string().nullable().optional()
});
export type CreateChatSessionInput = z.infer<typeof createChatSessionInputSchema>;

export const createChatMessageInputSchema = z.object({
  session_id: z.number(),
  user_id: z.number(),
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1)
});
export type CreateChatMessageInput = z.infer<typeof createChatMessageInputSchema>;

export const getChatHistoryInputSchema = z.object({
  user_id: z.number(),
  session_id: z.number().optional(),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0)
});
export type GetChatHistoryInput = z.infer<typeof getChatHistoryInputSchema>;

// Memory analytics schemas
export const getMemoryStatsInputSchema = z.object({
  user_id: z.number()
});
export type GetMemoryStatsInput = z.infer<typeof getMemoryStatsInputSchema>;

export const memoryStatsSchema = z.object({
  total_memories: z.number(),
  memories_by_type: z.record(z.number()),
  recent_memories: z.number(),
  avg_confidence_score: z.number().nullable()
});
export type MemoryStats = z.infer<typeof memoryStatsSchema>;