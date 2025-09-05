import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, chatSessionsTable, chatMessagesTable } from '../db/schema';
import { type CreateChatMessageInput } from '../schema';
import { createChatMessage } from '../handlers/create_chat_message';
import { eq } from 'drizzle-orm';

// Test user data
const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  password_hash: 'hashed_password'
};

// Test chat session data
const testChatSession = {
  user_id: 1, // Will be set after user creation
  title: 'Test Chat Session'
};

// Simple test input
const testInput: CreateChatMessageInput = {
  session_id: 1, // Will be set after session creation
  user_id: 1, // Will be set after user creation
  role: 'user' as const,
  content: 'Hello, this is a test message!'
};

describe('createChatMessage', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a chat message', async () => {
    // Create prerequisite user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create prerequisite chat session
    const sessionResult = await db.insert(chatSessionsTable)
      .values({
        ...testChatSession,
        user_id: userId
      })
      .returning()
      .execute();
    const sessionId = sessionResult[0].id;

    // Update test input with actual IDs
    const input = {
      ...testInput,
      session_id: sessionId,
      user_id: userId
    };

    const result = await createChatMessage(input);

    // Basic field validation
    expect(result.session_id).toEqual(sessionId);
    expect(result.user_id).toEqual(userId);
    expect(result.role).toEqual('user');
    expect(result.content).toEqual('Hello, this is a test message!');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save chat message to database', async () => {
    // Create prerequisite user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create prerequisite chat session
    const sessionResult = await db.insert(chatSessionsTable)
      .values({
        ...testChatSession,
        user_id: userId
      })
      .returning()
      .execute();
    const sessionId = sessionResult[0].id;

    // Update test input with actual IDs
    const input = {
      ...testInput,
      session_id: sessionId,
      user_id: userId
    };

    const result = await createChatMessage(input);

    // Query using proper drizzle syntax
    const messages = await db.select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.id, result.id))
      .execute();

    expect(messages).toHaveLength(1);
    expect(messages[0].session_id).toEqual(sessionId);
    expect(messages[0].user_id).toEqual(userId);
    expect(messages[0].role).toEqual('user');
    expect(messages[0].content).toEqual('Hello, this is a test message!');
    expect(messages[0].created_at).toBeInstanceOf(Date);
  });

  it('should create assistant message', async () => {
    // Create prerequisite user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create prerequisite chat session
    const sessionResult = await db.insert(chatSessionsTable)
      .values({
        ...testChatSession,
        user_id: userId
      })
      .returning()
      .execute();
    const sessionId = sessionResult[0].id;

    // Create assistant message
    const assistantInput: CreateChatMessageInput = {
      session_id: sessionId,
      user_id: userId,
      role: 'assistant',
      content: 'Hello! How can I help you today?'
    };

    const result = await createChatMessage(assistantInput);

    expect(result.role).toEqual('assistant');
    expect(result.content).toEqual('Hello! How can I help you today?');
    expect(result.session_id).toEqual(sessionId);
    expect(result.user_id).toEqual(userId);
  });

  it('should create multiple messages in same session', async () => {
    // Create prerequisite user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create prerequisite chat session
    const sessionResult = await db.insert(chatSessionsTable)
      .values({
        ...testChatSession,
        user_id: userId
      })
      .returning()
      .execute();
    const sessionId = sessionResult[0].id;

    // Create first message
    const message1 = await createChatMessage({
      session_id: sessionId,
      user_id: userId,
      role: 'user',
      content: 'First message'
    });

    // Create second message
    const message2 = await createChatMessage({
      session_id: sessionId,
      user_id: userId,
      role: 'assistant',
      content: 'Second message'
    });

    // Verify both messages exist in the session
    const messages = await db.select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.session_id, sessionId))
      .execute();

    expect(messages).toHaveLength(2);
    expect(messages[0].content).toEqual('First message');
    expect(messages[0].role).toEqual('user');
    expect(messages[1].content).toEqual('Second message');
    expect(messages[1].role).toEqual('assistant');
  });

  it('should handle long content', async () => {
    // Create prerequisite user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create prerequisite chat session
    const sessionResult = await db.insert(chatSessionsTable)
      .values({
        ...testChatSession,
        user_id: userId
      })
      .returning()
      .execute();
    const sessionId = sessionResult[0].id;

    // Create message with long content
    const longContent = 'A'.repeat(5000); // Very long message
    const input: CreateChatMessageInput = {
      session_id: sessionId,
      user_id: userId,
      role: 'user',
      content: longContent
    };

    const result = await createChatMessage(input);

    expect(result.content).toEqual(longContent);
    expect(result.content.length).toEqual(5000);
  });

  it('should throw error for non-existent session', async () => {
    // Create prerequisite user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Try to create message with non-existent session
    const input: CreateChatMessageInput = {
      session_id: 99999, // Non-existent session ID
      user_id: userId,
      role: 'user',
      content: 'Test message'
    };

    await expect(createChatMessage(input)).rejects.toThrow(/foreign key constraint/i);
  });

  it('should throw error for non-existent user', async () => {
    // Create prerequisite user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create prerequisite chat session
    const sessionResult = await db.insert(chatSessionsTable)
      .values({
        ...testChatSession,
        user_id: userId
      })
      .returning()
      .execute();
    const sessionId = sessionResult[0].id;

    // Try to create message with non-existent user
    const input: CreateChatMessageInput = {
      session_id: sessionId,
      user_id: 99999, // Non-existent user ID
      role: 'user',
      content: 'Test message'
    };

    await expect(createChatMessage(input)).rejects.toThrow(/foreign key constraint/i);
  });
});