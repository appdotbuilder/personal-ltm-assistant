import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, chatSessionsTable } from '../db/schema';
import { getChatSessions } from '../handlers/get_chat_sessions';

describe('getChatSessions', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when user has no chat sessions', async () => {
    // Create a user first
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    const result = await getChatSessions(userId);

    expect(result).toEqual([]);
  });

  it('should return all chat sessions for a user', async () => {
    // Create a user first
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create multiple chat sessions
    const session1 = await db.insert(chatSessionsTable)
      .values({
        user_id: userId,
        title: 'First Chat Session'
      })
      .returning()
      .execute();

    const session2 = await db.insert(chatSessionsTable)
      .values({
        user_id: userId,
        title: 'Second Chat Session'
      })
      .returning()
      .execute();

    const session3 = await db.insert(chatSessionsTable)
      .values({
        user_id: userId,
        title: null // Test nullable title
      })
      .returning()
      .execute();

    const result = await getChatSessions(userId);

    expect(result).toHaveLength(3);
    
    // Check that all sessions are returned with correct structure
    const sessionTitles = result.map(s => s.title);
    expect(sessionTitles).toContain('First Chat Session');
    expect(sessionTitles).toContain('Second Chat Session');
    expect(sessionTitles).toContain(null);

    // Verify all required fields are present
    result.forEach(session => {
      expect(session.id).toBeDefined();
      expect(session.user_id).toEqual(userId);
      expect(session.created_at).toBeInstanceOf(Date);
      expect(session.updated_at).toBeInstanceOf(Date);
    });
  });

  it('should return sessions ordered by most recent first', async () => {
    // Create a user first
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create sessions with slight delays to ensure different timestamps
    const session1 = await db.insert(chatSessionsTable)
      .values({
        user_id: userId,
        title: 'Oldest Session'
      })
      .returning()
      .execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    const session2 = await db.insert(chatSessionsTable)
      .values({
        user_id: userId,
        title: 'Newest Session'
      })
      .returning()
      .execute();

    const result = await getChatSessions(userId);

    expect(result).toHaveLength(2);
    
    // Verify ordering - most recent first
    expect(result[0].title).toEqual('Newest Session');
    expect(result[1].title).toEqual('Oldest Session');
    
    // Verify timestamps are in descending order
    expect(result[0].updated_at >= result[1].updated_at).toBe(true);
  });

  it('should only return sessions for the specified user', async () => {
    // Create two users
    const user1Result = await db.insert(usersTable)
      .values({
        username: 'user1',
        email: 'user1@example.com',
        password_hash: 'hashed_password1'
      })
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({
        username: 'user2',
        email: 'user2@example.com',
        password_hash: 'hashed_password2'
      })
      .returning()
      .execute();

    const user1Id = user1Result[0].id;
    const user2Id = user2Result[0].id;

    // Create sessions for both users
    await db.insert(chatSessionsTable)
      .values([
        { user_id: user1Id, title: 'User 1 Session 1' },
        { user_id: user1Id, title: 'User 1 Session 2' },
        { user_id: user2Id, title: 'User 2 Session 1' },
        { user_id: user2Id, title: 'User 2 Session 2' }
      ])
      .execute();

    // Get sessions for user 1
    const user1Sessions = await getChatSessions(user1Id);
    
    expect(user1Sessions).toHaveLength(2);
    user1Sessions.forEach(session => {
      expect(session.user_id).toEqual(user1Id);
    });

    const user1Titles = user1Sessions.map(s => s.title);
    expect(user1Titles).toContain('User 1 Session 1');
    expect(user1Titles).toContain('User 1 Session 2');
    expect(user1Titles).not.toContain('User 2 Session 1');
    expect(user1Titles).not.toContain('User 2 Session 2');

    // Get sessions for user 2
    const user2Sessions = await getChatSessions(user2Id);
    
    expect(user2Sessions).toHaveLength(2);
    user2Sessions.forEach(session => {
      expect(session.user_id).toEqual(user2Id);
    });

    const user2Titles = user2Sessions.map(s => s.title);
    expect(user2Titles).toContain('User 2 Session 1');
    expect(user2Titles).toContain('User 2 Session 2');
    expect(user2Titles).not.toContain('User 1 Session 1');
    expect(user2Titles).not.toContain('User 1 Session 2');
  });

  it('should handle non-existent user gracefully', async () => {
    const nonExistentUserId = 999999;

    const result = await getChatSessions(nonExistentUserId);

    expect(result).toEqual([]);
  });
});