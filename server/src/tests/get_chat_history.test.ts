import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, chatSessionsTable, chatMessagesTable } from '../db/schema';
import { type GetChatHistoryInput } from '../schema';
import { getChatHistory } from '../handlers/get_chat_history';

// Test data
const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  password_hash: 'hashedpassword123'
};

const testUser2 = {
  username: 'testuser2',
  email: 'test2@example.com',
  password_hash: 'hashedpassword456'
};

describe('getChatHistory', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should retrieve chat history for a user', async () => {
    // Create test user
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create test session
    const [session] = await db.insert(chatSessionsTable)
      .values({
        user_id: user.id,
        title: 'Test Chat'
      })
      .returning()
      .execute();

    // Create test messages with staggered timestamps
    const [message1] = await db.insert(chatMessagesTable)
      .values({
        session_id: session.id,
        user_id: user.id,
        role: 'user' as const,
        content: 'Hello, how are you?'
      })
      .returning()
      .execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 1));

    const [message2] = await db.insert(chatMessagesTable)
      .values({
        session_id: session.id,
        user_id: user.id,
        role: 'assistant' as const,
        content: 'I am doing well, thank you! How can I help you today?'
      })
      .returning()
      .execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 1));

    const [message3] = await db.insert(chatMessagesTable)
      .values({
        session_id: session.id,
        user_id: user.id,
        role: 'user' as const,
        content: 'Can you help me with a problem?'
      })
      .returning()
      .execute();

    // Test basic retrieval
    const input: GetChatHistoryInput = {
      user_id: user.id,
      limit: 20,
      offset: 0
    };

    const result = await getChatHistory(input);

    // Verify results
    expect(result).toHaveLength(3);
    expect(result[0].user_id).toEqual(user.id);
    expect(result[0].session_id).toEqual(session.id);
    expect(result[0].content).toEqual('Can you help me with a problem?'); // Most recent first
    expect(result[0].role).toEqual('user');
    expect(result[0].created_at).toBeInstanceOf(Date);

    // Verify ordering (most recent first)
    expect(result[0].created_at >= result[1].created_at).toBe(true);
    expect(result[1].created_at >= result[2].created_at).toBe(true);

    // Verify all messages belong to correct user
    result.forEach(message => {
      expect(message.user_id).toEqual(user.id);
    });
  });

  it('should filter by specific session_id', async () => {
    // Create test user
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create two test sessions
    const [session1] = await db.insert(chatSessionsTable)
      .values({
        user_id: user.id,
        title: 'Session 1'
      })
      .returning()
      .execute();

    const [session2] = await db.insert(chatSessionsTable)
      .values({
        user_id: user.id,
        title: 'Session 2'
      })
      .returning()
      .execute();

    // Create messages for both sessions
    await db.insert(chatMessagesTable)
      .values([
        {
          session_id: session1.id,
          user_id: user.id,
          role: 'user' as const,
          content: 'Message in session 1'
        },
        {
          session_id: session2.id,
          user_id: user.id,
          role: 'user' as const,
          content: 'Message in session 2'
        },
        {
          session_id: session1.id,
          user_id: user.id,
          role: 'assistant' as const,
          content: 'Response in session 1'
        }
      ])
      .execute();

    // Test filtering by session_id
    const input: GetChatHistoryInput = {
      user_id: user.id,
      session_id: session1.id,
      limit: 20,
      offset: 0
    };

    const result = await getChatHistory(input);

    // Should only return messages from session 1
    expect(result).toHaveLength(2);
    result.forEach(message => {
      expect(message.session_id).toEqual(session1.id);
      expect(message.user_id).toEqual(user.id);
    });

    // Verify content
    expect(result.some(m => m.content === 'Message in session 1')).toBe(true);
    expect(result.some(m => m.content === 'Response in session 1')).toBe(true);
    expect(result.some(m => m.content === 'Message in session 2')).toBe(false);
  });

  it('should apply pagination correctly', async () => {
    // Create test user
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create test session
    const [session] = await db.insert(chatSessionsTable)
      .values({
        user_id: user.id,
        title: 'Pagination Test'
      })
      .returning()
      .execute();

    // Create 5 test messages
    const messages = Array.from({ length: 5 }, (_, i) => ({
      session_id: session.id,
      user_id: user.id,
      role: 'user' as const,
      content: `Message ${i + 1}`
    }));

    await db.insert(chatMessagesTable)
      .values(messages)
      .execute();

    // Test first page
    const firstPage: GetChatHistoryInput = {
      user_id: user.id,
      limit: 2,
      offset: 0
    };

    const firstResult = await getChatHistory(firstPage);
    expect(firstResult).toHaveLength(2);

    // Test second page
    const secondPage: GetChatHistoryInput = {
      user_id: user.id,
      limit: 2,
      offset: 2
    };

    const secondResult = await getChatHistory(secondPage);
    expect(secondResult).toHaveLength(2);

    // Test third page
    const thirdPage: GetChatHistoryInput = {
      user_id: user.id,
      limit: 2,
      offset: 4
    };

    const thirdResult = await getChatHistory(thirdPage);
    expect(thirdResult).toHaveLength(1); // Only 1 message left

    // Verify no overlap between pages
    const firstIds = firstResult.map(m => m.id);
    const secondIds = secondResult.map(m => m.id);
    const thirdIds = thirdResult.map(m => m.id);

    expect(firstIds.some(id => secondIds.includes(id))).toBe(false);
    expect(firstIds.some(id => thirdIds.includes(id))).toBe(false);
    expect(secondIds.some(id => thirdIds.includes(id))).toBe(false);
  });

  it('should return empty array when no messages exist', async () => {
    // Create test user but no messages
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const input: GetChatHistoryInput = {
      user_id: user.id,
      limit: 20,
      offset: 0
    };

    const result = await getChatHistory(input);
    expect(result).toHaveLength(0);
  });

  it('should isolate messages by user_id', async () => {
    // Create two test users
    const [user1] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const [user2] = await db.insert(usersTable)
      .values(testUser2)
      .returning()
      .execute();

    // Create sessions for both users
    const [session1] = await db.insert(chatSessionsTable)
      .values({
        user_id: user1.id,
        title: 'User 1 Session'
      })
      .returning()
      .execute();

    const [session2] = await db.insert(chatSessionsTable)
      .values({
        user_id: user2.id,
        title: 'User 2 Session'
      })
      .returning()
      .execute();

    // Create messages for both users
    await db.insert(chatMessagesTable)
      .values([
        {
          session_id: session1.id,
          user_id: user1.id,
          role: 'user' as const,
          content: 'User 1 message'
        },
        {
          session_id: session2.id,
          user_id: user2.id,
          role: 'user' as const,
          content: 'User 2 message'
        }
      ])
      .execute();

    // Test user 1's messages
    const input1: GetChatHistoryInput = {
      user_id: user1.id,
      limit: 20,
      offset: 0
    };

    const result1 = await getChatHistory(input1);
    expect(result1).toHaveLength(1);
    expect(result1[0].content).toEqual('User 1 message');
    expect(result1[0].user_id).toEqual(user1.id);

    // Test user 2's messages
    const input2: GetChatHistoryInput = {
      user_id: user2.id,
      limit: 20,
      offset: 0
    };

    const result2 = await getChatHistory(input2);
    expect(result2).toHaveLength(1);
    expect(result2[0].content).toEqual('User 2 message');
    expect(result2[0].user_id).toEqual(user2.id);
  });

  it('should handle non-existent session_id gracefully', async () => {
    // Create test user
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Test with non-existent session_id
    const input: GetChatHistoryInput = {
      user_id: user.id,
      session_id: 99999, // Non-existent session
      limit: 20,
      offset: 0
    };

    const result = await getChatHistory(input);
    expect(result).toHaveLength(0);
  });

  it('should apply default values correctly', async () => {
    // Create test user and session
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const [session] = await db.insert(chatSessionsTable)
      .values({
        user_id: user.id,
        title: 'Default Test'
      })
      .returning()
      .execute();

    // Create multiple messages (more than default limit)
    const messages = Array.from({ length: 25 }, (_, i) => ({
      session_id: session.id,
      user_id: user.id,
      role: 'user' as const,
      content: `Message ${i + 1}`
    }));

    await db.insert(chatMessagesTable)
      .values(messages)
      .execute();

    // Test with input that will use defaults (limit: 50, offset: 0)
    const input: GetChatHistoryInput = {
      user_id: user.id,
      limit: 50,
      offset: 0
    };

    const result = await getChatHistory(input);
    expect(result).toHaveLength(25); // Should get all messages since they're under default limit
  });
});