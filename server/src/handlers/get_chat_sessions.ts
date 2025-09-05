import { db } from '../db';
import { chatSessionsTable } from '../db/schema';
import { type ChatSession } from '../schema';
import { eq, desc } from 'drizzle-orm';

export const getChatSessions = async (userId: number): Promise<ChatSession[]> => {
  try {
    // Get all chat sessions for the user, ordered by most recent first
    const results = await db.select()
      .from(chatSessionsTable)
      .where(eq(chatSessionsTable.user_id, userId))
      .orderBy(desc(chatSessionsTable.updated_at))
      .execute();

    return results;
  } catch (error) {
    console.error('Get chat sessions failed:', error);
    throw error;
  }
};