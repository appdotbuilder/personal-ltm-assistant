import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, memoriesTable } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { deleteMemory } from '../handlers/delete_memory';

// Test user data
const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  password_hash: 'hashedpassword123'
};

const anotherUser = {
  username: 'anotheruser',
  email: 'another@example.com',
  password_hash: 'hashedpassword456'
};

// Test memory data
const testMemory = {
  user_id: 0, // Will be set after user creation
  embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
  memory_type: 'episodic' as const,
  summary: 'Test memory summary',
  full_text: 'This is a test memory with full context and details',
  details: { keywords: ['test', 'memory'], location: 'test environment' },
  confidence_score: 0.9
};

describe('deleteMemory', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should successfully delete a memory that belongs to the user', async () => {
    // Create test user
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create test memory
    const [memory] = await db.insert(memoriesTable)
      .values({
        ...testMemory,
        user_id: user.id
      })
      .returning()
      .execute();

    // Delete the memory
    const result = await deleteMemory(memory.id, user.id);

    // Should return true for successful deletion
    expect(result).toBe(true);

    // Verify memory is deleted from database
    const memories = await db.select()
      .from(memoriesTable)
      .where(eq(memoriesTable.id, memory.id))
      .execute();

    expect(memories).toHaveLength(0);
  });

  it('should return false when trying to delete non-existent memory', async () => {
    // Create test user
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Try to delete non-existent memory
    const result = await deleteMemory(99999, user.id);

    // Should return false for non-existent memory
    expect(result).toBe(false);
  });

  it('should return false when trying to delete another user\'s memory', async () => {
    // Create two test users
    const [user1] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const [user2] = await db.insert(usersTable)
      .values(anotherUser)
      .returning()
      .execute();

    // Create memory for user1
    const [memory] = await db.insert(memoriesTable)
      .values({
        ...testMemory,
        user_id: user1.id
      })
      .returning()
      .execute();

    // Try to delete user1's memory as user2
    const result = await deleteMemory(memory.id, user2.id);

    // Should return false (security check prevents deletion)
    expect(result).toBe(false);

    // Verify memory still exists in database
    const memories = await db.select()
      .from(memoriesTable)
      .where(eq(memoriesTable.id, memory.id))
      .execute();

    expect(memories).toHaveLength(1);
    expect(memories[0].user_id).toBe(user1.id);
  });

  it('should only delete the specified memory, not other memories', async () => {
    // Create test user
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create multiple memories for the user
    const memory1Data = {
      ...testMemory,
      user_id: user.id,
      summary: 'First memory'
    };
    
    const memory2Data = {
      ...testMemory,
      user_id: user.id,
      summary: 'Second memory'
    };

    const [memory1] = await db.insert(memoriesTable)
      .values(memory1Data)
      .returning()
      .execute();

    const [memory2] = await db.insert(memoriesTable)
      .values(memory2Data)
      .returning()
      .execute();

    // Delete only the first memory
    const result = await deleteMemory(memory1.id, user.id);

    // Should return true for successful deletion
    expect(result).toBe(true);

    // Verify first memory is deleted
    const deletedMemories = await db.select()
      .from(memoriesTable)
      .where(eq(memoriesTable.id, memory1.id))
      .execute();

    expect(deletedMemories).toHaveLength(0);

    // Verify second memory still exists
    const remainingMemories = await db.select()
      .from(memoriesTable)
      .where(eq(memoriesTable.id, memory2.id))
      .execute();

    expect(remainingMemories).toHaveLength(1);
    expect(remainingMemories[0].summary).toBe('Second memory');
  });

  it('should handle database constraints correctly when user has multiple memories', async () => {
    // Create test user
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create multiple memories with different types
    const episodicMemory = {
      ...testMemory,
      user_id: user.id,
      memory_type: 'episodic' as const,
      summary: 'Episodic memory'
    };

    const semanticMemory = {
      ...testMemory,
      user_id: user.id,
      memory_type: 'semantic' as const,
      summary: 'Semantic memory'
    };

    const [memory1] = await db.insert(memoriesTable)
      .values(episodicMemory)
      .returning()
      .execute();

    const [memory2] = await db.insert(memoriesTable)
      .values(semanticMemory)
      .returning()
      .execute();

    // Delete episodic memory
    const result = await deleteMemory(memory1.id, user.id);

    // Should successfully delete
    expect(result).toBe(true);

    // Verify user still exists and has remaining memory
    const userMemories = await db.select()
      .from(memoriesTable)
      .where(eq(memoriesTable.user_id, user.id))
      .execute();

    expect(userMemories).toHaveLength(1);
    expect(userMemories[0].memory_type).toBe('semantic');
    expect(userMemories[0].summary).toBe('Semantic memory');
  });
});