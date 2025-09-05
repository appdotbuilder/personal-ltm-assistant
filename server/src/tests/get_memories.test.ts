import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, memoriesTable } from '../db/schema';
import { type SearchMemoriesInput } from '../schema';
import { getMemories } from '../handlers/get_memories';

// Test user data
const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  password_hash: 'hashedpassword'
};

// Test memory data templates (user_id will be set dynamically)
const memoryTemplates = [
  {
    embedding: [0.1, 0.2, 0.3],
    memory_type: 'episodic' as const,
    summary: 'Had lunch with Sarah at the cafe',
    full_text: 'Had a great lunch with Sarah at the local cafe. We discussed her new job and made plans for the weekend.',
    details: { location: 'cafe', people: ['Sarah'], emotion: 'happy' },
    confidence_score: 0.9
  },
  {
    embedding: [0.4, 0.5, 0.6],
    memory_type: 'semantic' as const,
    summary: 'JavaScript is a programming language',
    full_text: 'JavaScript is a high-level, interpreted programming language that conforms to the ECMAScript specification.',
    details: { category: 'programming', language: 'JavaScript' },
    confidence_score: 0.8
  },
  {
    embedding: [0.7, 0.8, 0.9],
    memory_type: 'procedural' as const,
    summary: 'How to make coffee',
    full_text: 'Step 1: Grind coffee beans. Step 2: Heat water to 200°F. Step 3: Pour water over grounds.',
    details: { category: 'recipe', difficulty: 'easy' },
    confidence_score: 0.7
  }
];

describe('getMemories', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should retrieve all memories for a user', async () => {
    // Create test user
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create another user to test isolation
    const [otherUser] = await db.insert(usersTable)
      .values({
        username: 'otheruser',
        email: 'other@example.com',
        password_hash: 'hashedpassword2'
      })
      .returning()
      .execute();

    // Create test memories for main user
    const memoriesForUser = memoryTemplates.map(memory => ({
      ...memory,
      user_id: user.id
    }));

    await db.insert(memoriesTable)
      .values(memoriesForUser)
      .execute();

    // Create one memory for other user
    await db.insert(memoriesTable)
      .values({
        user_id: otherUser.id,
        embedding: [0.2, 0.3, 0.4],
        memory_type: 'episodic' as const,
        summary: 'Went to the movies',
        full_text: 'Watched the latest action movie at the cinema.',
        details: { activity: 'movies' },
        confidence_score: 0.6
      })
      .execute();

    const input: SearchMemoriesInput = {
      user_id: user.id,
      limit: 20,
      offset: 0
    };

    const result = await getMemories(input);

    // Should only return memories for this user (3 out of 4 total)
    expect(result).toHaveLength(3);
    
    // Verify all returned memories belong to the user
    result.forEach(memory => {
      expect(memory.user_id).toEqual(user.id);
      expect(memory.id).toBeDefined();
      expect(memory.created_at).toBeInstanceOf(Date);
      expect(memory.updated_at).toBeInstanceOf(Date);
    });

    // Verify numeric conversion
    expect(typeof result[0].confidence_score).toBe('number');
  });

  it('should retrieve memories with simple userId parameter', async () => {
    // Create test user
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create test memories for main user
    const memoriesForUser = memoryTemplates.map(memory => ({
      ...memory,
      user_id: user.id
    }));

    await db.insert(memoriesTable)
      .values(memoriesForUser)
      .execute();

    // Test simple userId interface (for backward compatibility)
    const result = await getMemories(user.id);

    expect(result).toHaveLength(3);
    result.forEach(memory => {
      expect(memory.user_id).toEqual(user.id);
      expect(memory.id).toBeDefined();
      expect(memory.created_at).toBeInstanceOf(Date);
      expect(memory.updated_at).toBeInstanceOf(Date);
    });
  });

  it('should filter memories by memory type', async () => {
    // Create test user
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create test memories with proper user_id
    const memoriesWithUserId = memoryTemplates.map(memory => ({
      ...memory,
      user_id: user.id
    }));

    await db.insert(memoriesTable)
      .values(memoriesWithUserId)
      .execute();

    const input: SearchMemoriesInput = {
      user_id: user.id,
      memory_type: 'episodic',
      limit: 20,
      offset: 0
    };

    const result = await getMemories(input);

    // Should only return episodic memories (1 out of 3)
    expect(result).toHaveLength(1);
    expect(result[0].memory_type).toEqual('episodic');
    expect(result[0].summary).toEqual('Had lunch with Sarah at the cafe');
  });

  it('should filter memories by query text', async () => {
    // Create test user
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create test memories with proper user_id
    const memoriesWithUserId = memoryTemplates.map(memory => ({
      ...memory,
      user_id: user.id
    }));

    await db.insert(memoriesTable)
      .values(memoriesWithUserId)
      .execute();

    const input: SearchMemoriesInput = {
      user_id: user.id,
      query: 'JavaScript',
      limit: 20,
      offset: 0
    };

    const result = await getMemories(input);

    // Should only return memories containing "JavaScript" in summary
    expect(result).toHaveLength(1);
    expect(result[0].summary).toContain('JavaScript');
    expect(result[0].memory_type).toEqual('semantic');
  });

  it('should apply pagination correctly', async () => {
    // Create test user
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create test memories with proper user_id
    const memoriesWithUserId = memoryTemplates.map(memory => ({
      ...memory,
      user_id: user.id
    }));

    await db.insert(memoriesTable)
      .values(memoriesWithUserId)
      .execute();

    // Test first page
    const firstPage: SearchMemoriesInput = {
      user_id: user.id,
      limit: 2,
      offset: 0
    };

    const firstResult = await getMemories(firstPage);
    expect(firstResult).toHaveLength(2);

    // Test second page
    const secondPage: SearchMemoriesInput = {
      user_id: user.id,
      limit: 2,
      offset: 2
    };

    const secondResult = await getMemories(secondPage);
    expect(secondResult).toHaveLength(1); // Only 1 remaining memory

    // Ensure different results
    expect(firstResult[0].id).not.toEqual(secondResult[0].id);
  });

  it('should order memories by created_at descending', async () => {
    // Create test user
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create memories one by one to ensure different timestamps
    const memory1 = await db.insert(memoriesTable)
      .values({
        user_id: user.id,
        embedding: [0.1, 0.2, 0.3],
        memory_type: 'episodic',
        summary: 'First memory',
        full_text: 'This is the first memory',
        confidence_score: 0.9
      })
      .returning()
      .execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 1));

    const memory2 = await db.insert(memoriesTable)
      .values({
        user_id: user.id,
        embedding: [0.4, 0.5, 0.6],
        memory_type: 'semantic',
        summary: 'Second memory',
        full_text: 'This is the second memory',
        confidence_score: 0.8
      })
      .returning()
      .execute();

    const input: SearchMemoriesInput = {
      user_id: user.id,
      limit: 20,
      offset: 0
    };

    const result = await getMemories(input);

    expect(result).toHaveLength(2);
    // Most recent memory should be first
    expect(result[0].created_at.getTime()).toBeGreaterThanOrEqual(result[1].created_at.getTime());
  });

  it('should return empty array when no memories found', async () => {
    // Create test user
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const input: SearchMemoriesInput = {
      user_id: user.id,
      limit: 20,
      offset: 0
    };

    const result = await getMemories(input);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle combined filters correctly', async () => {
    // Create test user
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create test memories with proper user_id
    const memoriesWithUserId = memoryTemplates.map(memory => ({
      ...memory,
      user_id: user.id
    }));

    await db.insert(memoriesTable)
      .values(memoriesWithUserId)
      .execute();

    const input: SearchMemoriesInput = {
      user_id: user.id,
      memory_type: 'procedural',
      query: 'coffee',
      limit: 20,
      offset: 0
    };

    const result = await getMemories(input);

    // Should return the procedural memory about coffee
    expect(result).toHaveLength(1);
    expect(result[0].memory_type).toEqual('procedural');
    expect(result[0].summary).toContain('coffee');
  });
});