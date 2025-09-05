import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, memoriesTable } from '../db/schema';
import { type UpdateMemoryInput, type CreateUserInput, type CreateMemoryInput } from '../schema';
import { updateMemory } from '../handlers/update_memory';
import { eq } from 'drizzle-orm';

// Test data
const testUser: CreateUserInput = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'password123'
};

const testMemory: CreateMemoryInput = {
  user_id: 1, // Will be set after user creation
  embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
  memory_type: 'semantic',
  summary: 'Original summary',
  full_text: 'Original full text content',
  details: { keywords: ['test', 'original'] },
  confidence_score: 0.8
};

describe('updateMemory', () => {
  let userId: number;
  let memoryId: number;

  beforeEach(async () => {
    await createDB();

    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: testUser.username,
        email: testUser.email,
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();
    userId = userResult[0].id;

    // Create test memory
    const memoryResult = await db.insert(memoriesTable)
      .values({
        ...testMemory,
        user_id: userId
      })
      .returning()
      .execute();
    memoryId = memoryResult[0].id;
  });

  afterEach(resetDB);

  it('should update all fields of a memory', async () => {
    const updateInput: UpdateMemoryInput = {
      id: memoryId,
      embedding: [0.6, 0.7, 0.8, 0.9, 1.0],
      memory_type: 'episodic',
      summary: 'Updated summary',
      full_text: 'Updated full text content',
      details: { keywords: ['updated', 'modified'], emotion: 'happy' },
      confidence_score: 0.9
    };

    const result = await updateMemory(updateInput);

    // Verify returned memory has updated fields
    expect(result.id).toEqual(memoryId);
    expect(result.user_id).toEqual(userId);
    expect(result.embedding).toEqual([0.6, 0.7, 0.8, 0.9, 1.0]);
    expect(result.memory_type).toEqual('episodic');
    expect(result.summary).toEqual('Updated summary');
    expect(result.full_text).toEqual('Updated full text content');
    expect(result.details).toEqual({ keywords: ['updated', 'modified'], emotion: 'happy' });
    expect(result.confidence_score).toEqual(0.9);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should update only specified fields', async () => {
    const updateInput: UpdateMemoryInput = {
      id: memoryId,
      summary: 'Partially updated summary',
      confidence_score: 0.95
    };

    const result = await updateMemory(updateInput);

    // Verify only specified fields are updated
    expect(result.summary).toEqual('Partially updated summary');
    expect(result.confidence_score).toEqual(0.95);

    // Verify other fields remain unchanged
    expect(result.memory_type).toEqual('semantic');
    expect(result.full_text).toEqual('Original full text content');
    expect(result.embedding).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
    expect(result.details).toEqual({ keywords: ['test', 'original'] });
  });

  it('should update memory in database', async () => {
    const updateInput: UpdateMemoryInput = {
      id: memoryId,
      summary: 'Database updated summary',
      memory_type: 'procedural'
    };

    await updateMemory(updateInput);

    // Verify database was updated
    const memories = await db.select()
      .from(memoriesTable)
      .where(eq(memoriesTable.id, memoryId))
      .execute();

    expect(memories).toHaveLength(1);
    expect(memories[0].summary).toEqual('Database updated summary');
    expect(memories[0].memory_type).toEqual('procedural');
    expect(memories[0].updated_at).toBeInstanceOf(Date);
  });

  it('should handle null values correctly', async () => {
    const updateInput: UpdateMemoryInput = {
      id: memoryId,
      details: null,
      confidence_score: null
    };

    const result = await updateMemory(updateInput);

    expect(result.details).toBeNull();
    expect(result.confidence_score).toBeNull();
  });

  it('should update embedding array', async () => {
    const newEmbedding = [1.1, 1.2, 1.3, 1.4, 1.5, 1.6];
    const updateInput: UpdateMemoryInput = {
      id: memoryId,
      embedding: newEmbedding
    };

    const result = await updateMemory(updateInput);

    expect(result.embedding).toEqual(newEmbedding);
    expect(result.embedding).toHaveLength(6);
  });

  it('should update complex details object', async () => {
    const complexDetails = {
      keywords: ['complex', 'updated'],
      emotions: { primary: 'joy', secondary: 'excitement' },
      contexts: ['work', 'personal'],
      metadata: { source: 'conversation', priority: 'high' }
    };

    const updateInput: UpdateMemoryInput = {
      id: memoryId,
      details: complexDetails
    };

    const result = await updateMemory(updateInput);

    expect(result.details).toEqual(complexDetails);
  });

  it('should update timestamp correctly', async () => {
    const beforeUpdate = new Date();

    const updateInput: UpdateMemoryInput = {
      id: memoryId,
      summary: 'Timestamp test'
    };

    const result = await updateMemory(updateInput);

    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.created_at.getTime()).toBeLessThan(result.updated_at.getTime());
  });

  it('should throw error for non-existent memory', async () => {
    const updateInput: UpdateMemoryInput = {
      id: 99999, // Non-existent ID
      summary: 'This should fail'
    };

    await expect(updateMemory(updateInput)).rejects.toThrow(/Memory with id 99999 not found/i);
  });

  it('should update confidence score to boundary values', async () => {
    // Test minimum confidence score
    let updateInput: UpdateMemoryInput = {
      id: memoryId,
      confidence_score: 0.0
    };

    let result = await updateMemory(updateInput);
    expect(result.confidence_score).toEqual(0.0);

    // Test maximum confidence score
    updateInput = {
      id: memoryId,
      confidence_score: 1.0
    };

    result = await updateMemory(updateInput);
    expect(result.confidence_score).toEqual(1.0);
  });

  it('should handle all memory types', async () => {
    const memoryTypes = ['episodic', 'semantic', 'procedural', 'emotional', 'value-principle'] as const;

    for (const memoryType of memoryTypes) {
      const updateInput: UpdateMemoryInput = {
        id: memoryId,
        memory_type: memoryType
      };

      const result = await updateMemory(updateInput);
      expect(result.memory_type).toEqual(memoryType);
    }
  });
});