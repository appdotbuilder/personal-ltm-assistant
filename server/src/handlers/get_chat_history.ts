import { db } from '../db';
import { chatMessagesTable } from '../db/schema';
import { type GetChatHistoryInput, type ChatMessage } from '../schema';
import { eq, and, desc, SQL } from 'drizzle-orm';

export const getChatHistory = async (input: GetChatHistoryInput): Promise<ChatMessage[]> => {
  try {
    // Build conditions array for filtering
    const conditions: SQL<unknown>[] = [
      eq(chatMessagesTable.user_id, input.user_id)
    ];

    // Add session filter if provided
    if (input.session_id !== undefined) {
      conditions.push(eq(chatMessagesTable.session_id, input.session_id));
    }

    // Build and execute query
    const results = await db.select()
      .from(chatMessagesTable)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(chatMessagesTable.created_at))
      .limit(input.limit)
      .offset(input.offset)
      .execute();

    // Return results (no numeric conversions needed for this table)
    return results;
  } catch (error) {
    console.error('Chat history retrieval failed:', error);
    throw error;
  }
};