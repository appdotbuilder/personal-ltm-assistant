import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createUserInputSchema,
  loginUserInputSchema,
  createMemoryInputSchema,
  updateMemoryInputSchema,
  searchMemoriesInputSchema,
  createChatSessionInputSchema,
  createChatMessageInputSchema,
  getChatHistoryInputSchema,
  getMemoryStatsInputSchema
} from './schema';

// Import handlers
import { createUser } from './handlers/create_user';
import { loginUser } from './handlers/login_user';
import { createMemory } from './handlers/create_memory';
import { updateMemory } from './handlers/update_memory';
import { searchMemories } from './handlers/search_memories';
import { getMemories } from './handlers/get_memories';
import { deleteMemory } from './handlers/delete_memory';
import { createChatSession } from './handlers/create_chat_session';
import { createChatMessage } from './handlers/create_chat_message';
import { getChatHistory } from './handlers/get_chat_history';
import { getChatSessions } from './handlers/get_chat_sessions';
import { getMemoryStats } from './handlers/get_memory_stats';
import { processConversation } from './handlers/process_conversation';
import { generateResponse } from './handlers/generate_response';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check endpoint
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // User authentication endpoints
  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),

  loginUser: publicProcedure
    .input(loginUserInputSchema)
    .mutation(({ input }) => loginUser(input)),

  // Memory management endpoints (Core LTM system)
  createMemory: publicProcedure
    .input(createMemoryInputSchema)
    .mutation(({ input }) => createMemory(input)),

  updateMemory: publicProcedure
    .input(updateMemoryInputSchema)
    .mutation(({ input }) => updateMemory(input)),

  searchMemories: publicProcedure
    .input(searchMemoriesInputSchema)
    .query(({ input }) => searchMemories(input)),

  getMemories: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getMemories(input.userId)),

  deleteMemory: publicProcedure
    .input(z.object({ memoryId: z.number(), userId: z.number() }))
    .mutation(({ input }) => deleteMemory(input.memoryId, input.userId)),

  // Chat system endpoints
  createChatSession: publicProcedure
    .input(createChatSessionInputSchema)
    .mutation(({ input }) => createChatSession(input)),

  createChatMessage: publicProcedure
    .input(createChatMessageInputSchema)
    .mutation(({ input }) => createChatMessage(input)),

  getChatHistory: publicProcedure
    .input(getChatHistoryInputSchema)
    .query(({ input }) => getChatHistory(input)),

  getChatSessions: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getChatSessions(input.userId)),

  // Memory analytics endpoint (for Memory Dashboard)
  getMemoryStats: publicProcedure
    .input(getMemoryStatsInputSchema)
    .query(({ input }) => getMemoryStats(input)),

  // AI Agent endpoints (Kuration & Abruf Agents)
  processConversation: publicProcedure
    .input(z.object({
      userId: z.number(),
      sessionId: z.number(),
      messages: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
        timestamp: z.date()
      }))
    }))
    .mutation(({ input }) => processConversation(input)),

  generateResponse: publicProcedure
    .input(z.object({
      userId: z.number(),
      sessionId: z.number(),
      userMessage: z.string(),
      conversationHistory: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
        timestamp: z.date()
      }))
    }))
    .mutation(({ input }) => generateResponse(input)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`Personal Assistant TRPC server listening at port: ${port}`);
  console.log(`Features: Long-term Memory System, Chat Interface, User Authentication`);
}

start();