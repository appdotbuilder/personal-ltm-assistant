import { db } from '../db';
import { chatSessionsTable, usersTable } from '../db/schema';
import { type CreateChatSessionInput, type ChatSession } from '../schema';
import { eq } from 'drizzle-orm';

export const createChatSession = async (input: CreateChatSessionInput): Promise<ChatSession> => {
  try {
    // Verify user exists to prevent foreign key constraint violations
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .limit(1)
      .execute();

    if (user.length === 0) {
      throw new Error(`User with id ${input.user_id} not found`);
    }

    // Insert chat session record
    const result = await db.insert(chatSessionsTable)
      .values({
        user_id: input.user_id,
        title: input.title || null
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Chat session creation failed:', error);
    throw error;
  }
};