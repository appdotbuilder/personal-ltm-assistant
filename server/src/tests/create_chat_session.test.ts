import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { chatSessionsTable, usersTable } from '../db/schema';
import { type CreateChatSessionInput } from '../schema';
import { createChatSession } from '../handlers/create_chat_session';
import { eq } from 'drizzle-orm';

describe('createChatSession', () => {
  let testUserId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create test user for foreign key reference
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();
    
    testUserId = userResult[0].id;
  });

  afterEach(resetDB);

  it('should create a chat session with title', async () => {
    const testInput: CreateChatSessionInput = {
      user_id: testUserId,
      title: 'My Chat Session'
    };

    const result = await createChatSession(testInput);

    // Basic field validation
    expect(result.user_id).toEqual(testUserId);
    expect(result.title).toEqual('My Chat Session');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a chat session without title', async () => {
    const testInput: CreateChatSessionInput = {
      user_id: testUserId
    };

    const result = await createChatSession(testInput);

    // Basic field validation
    expect(result.user_id).toEqual(testUserId);
    expect(result.title).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a chat session with null title', async () => {
    const testInput: CreateChatSessionInput = {
      user_id: testUserId,
      title: null
    };

    const result = await createChatSession(testInput);

    // Basic field validation
    expect(result.user_id).toEqual(testUserId);
    expect(result.title).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save chat session to database', async () => {
    const testInput: CreateChatSessionInput = {
      user_id: testUserId,
      title: 'Test Session'
    };

    const result = await createChatSession(testInput);

    // Query using proper drizzle syntax
    const sessions = await db.select()
      .from(chatSessionsTable)
      .where(eq(chatSessionsTable.id, result.id))
      .execute();

    expect(sessions).toHaveLength(1);
    expect(sessions[0].user_id).toEqual(testUserId);
    expect(sessions[0].title).toEqual('Test Session');
    expect(sessions[0].created_at).toBeInstanceOf(Date);
    expect(sessions[0].updated_at).toBeInstanceOf(Date);
  });

  it('should throw error for non-existent user', async () => {
    const testInput: CreateChatSessionInput = {
      user_id: 99999, // Non-existent user ID
      title: 'Test Session'
    };

    await expect(createChatSession(testInput)).rejects.toThrow(/User with id 99999 not found/i);
  });

  it('should create multiple sessions for same user', async () => {
    const testInput1: CreateChatSessionInput = {
      user_id: testUserId,
      title: 'Session 1'
    };

    const testInput2: CreateChatSessionInput = {
      user_id: testUserId,
      title: 'Session 2'
    };

    const result1 = await createChatSession(testInput1);
    const result2 = await createChatSession(testInput2);

    expect(result1.id).not.toEqual(result2.id);
    expect(result1.user_id).toEqual(testUserId);
    expect(result2.user_id).toEqual(testUserId);
    expect(result1.title).toEqual('Session 1');
    expect(result2.title).toEqual('Session 2');

    // Verify both exist in database
    const sessions = await db.select()
      .from(chatSessionsTable)
      .where(eq(chatSessionsTable.user_id, testUserId))
      .execute();

    expect(sessions).toHaveLength(2);
  });
});