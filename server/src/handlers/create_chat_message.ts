import { db } from '../db';
import { chatMessagesTable } from '../db/schema';
import { type CreateChatMessageInput, type ChatMessage } from '../schema';

export const createChatMessage = async (input: CreateChatMessageInput): Promise<ChatMessage> => {
  try {
    // Insert chat message record
    const result = await db.insert(chatMessagesTable)
      .values({
        session_id: input.session_id,
        user_id: input.user_id,
        role: input.role,
        content: input.content
      })
      .returning()
      .execute();

    const chatMessage = result[0];
    return chatMessage;
  } catch (error) {
    console.error('Chat message creation failed:', error);
    throw error;
  }
};