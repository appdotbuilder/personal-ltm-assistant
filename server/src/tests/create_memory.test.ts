import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { memoriesTable, usersTable } from '../db/schema';
import { type CreateMemoryInput } from '../schema';
import { createMemory } from '../handlers/create_memory';
import { eq } from 'drizzle-orm';

// Test user for memory creation
const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  password_hash: 'hashedpassword123'
};

// Test memory input
const testMemoryInput: CreateMemoryInput = {
  user_id: 1, // Will be set after user creation
  embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
  memory_type: 'episodic',
  summary: 'User discussed their preference for morning coffee',
  full_text: 'The user mentioned that they prefer to drink coffee in the morning, specifically dark roast with no sugar. This happens every day around 8 AM and helps them start their workday.',
  details: {
    keywords: ['coffee', 'morning', 'dark roast', 'routine'],
    emotions: ['satisfaction', 'comfort'],
    importance: 'high'
  },
  confidence_score: 0.85
};

describe('createMemory', () => {
  let userId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    userId = userResult[0].id;
  });

  afterEach(resetDB);

  it('should create a memory with all fields', async () => {
    const inputWithUserId = { ...testMemoryInput, user_id: userId };
    const result = await createMemory(inputWithUserId);

    // Verify all fields are correctly set
    expect(result.id).toBeDefined();
    expect(result.user_id).toEqual(userId);
    expect(result.embedding).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
    expect(result.memory_type).toEqual('episodic');
    expect(result.summary).toEqual('User discussed their preference for morning coffee');
    expect(result.full_text).toContain('dark roast with no sugar');
    expect(result.details).toEqual({
      keywords: ['coffee', 'morning', 'dark roast', 'routine'],
      emotions: ['satisfaction', 'comfort'],
      importance: 'high'
    });
    expect(result.confidence_score).toEqual(0.85);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a memory with minimal fields', async () => {
    const minimalInput: CreateMemoryInput = {
      user_id: userId,
      embedding: [0.1, 0.2],
      memory_type: 'semantic',
      summary: 'Simple memory',
      full_text: 'This is a simple memory with minimal data.'
    };

    const result = await createMemory(minimalInput);

    expect(result.id).toBeDefined();
    expect(result.user_id).toEqual(userId);
    expect(result.embedding).toEqual([0.1, 0.2]);
    expect(result.memory_type).toEqual('semantic');
    expect(result.summary).toEqual('Simple memory');
    expect(result.full_text).toEqual('This is a simple memory with minimal data.');
    expect(result.details).toBeNull();
    expect(result.confidence_score).toBeNull();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save memory to database correctly', async () => {
    const inputWithUserId = { ...testMemoryInput, user_id: userId };
    const result = await createMemory(inputWithUserId);

    // Verify memory was saved to database
    const savedMemories = await db.select()
      .from(memoriesTable)
      .where(eq(memoriesTable.id, result.id))
      .execute();

    expect(savedMemories).toHaveLength(1);
    const savedMemory = savedMemories[0];
    
    expect(savedMemory.user_id).toEqual(userId);
    expect(savedMemory.embedding).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
    expect(savedMemory.memory_type).toEqual('episodic');
    expect(savedMemory.summary).toEqual('User discussed their preference for morning coffee');
    expect(savedMemory.full_text).toContain('dark roast with no sugar');
    expect(savedMemory.details).toEqual({
      keywords: ['coffee', 'morning', 'dark roast', 'routine'],
      emotions: ['satisfaction', 'comfort'],
      importance: 'high'
    });
    expect(savedMemory.confidence_score).toEqual(0.85);
    expect(savedMemory.created_at).toBeInstanceOf(Date);
    expect(savedMemory.updated_at).toBeInstanceOf(Date);
  });

  it('should handle different memory types', async () => {
    const memoryTypes = ['episodic', 'semantic', 'procedural', 'emotional', 'value-principle'] as const;
    
    for (const memoryType of memoryTypes) {
      const input: CreateMemoryInput = {
        user_id: userId,
        embedding: [0.1, 0.2],
        memory_type: memoryType,
        summary: `Test ${memoryType} memory`,
        full_text: `This is a test ${memoryType} memory.`
      };

      const result = await createMemory(input);
      expect(result.memory_type).toEqual(memoryType);
    }
  });

  it('should handle complex embedding vectors', async () => {
    // Use simpler float values to avoid precision issues with float32 storage
    const complexEmbedding = Array.from({ length: 20 }, (_, i) => Math.round((i * 0.1 - 1) * 100) / 100);
    
    const input: CreateMemoryInput = {
      user_id: userId,
      embedding: complexEmbedding,
      memory_type: 'semantic',
      summary: 'Memory with complex embedding',
      full_text: 'This memory has a high-dimensional embedding vector.'
    };

    const result = await createMemory(input);
    expect(result.embedding).toEqual(complexEmbedding);
    expect(result.embedding).toHaveLength(20);
  });

  it('should handle complex details object', async () => {
    const complexDetails = {
      keywords: ['meeting', 'project', 'deadline'],
      emotions: ['stress', 'urgency'],
      participants: ['Alice', 'Bob'],
      location: 'Conference Room A',
      timestamp: '2024-01-15T10:30:00Z',
      priority: 'high',
      tags: ['work', 'important'],
      related_memories: [42, 73, 156],
      metadata: {
        source: 'conversation',
        confidence: 0.92,
        extracted_by: 'kuration-agent-v1'
      }
    };

    const input: CreateMemoryInput = {
      user_id: userId,
      embedding: [0.1, 0.2, 0.3],
      memory_type: 'episodic',
      summary: 'Important project meeting discussion',
      full_text: 'Had an urgent meeting about the upcoming project deadline with the team.',
      details: complexDetails,
      confidence_score: 0.92
    };

    const result = await createMemory(input);
    expect(result.details).toEqual(complexDetails);
  });

  it('should throw error for non-existent user', async () => {
    const inputWithInvalidUserId = { ...testMemoryInput, user_id: 99999 };
    
    await expect(createMemory(inputWithInvalidUserId))
      .rejects
      .toThrow(/user with id 99999 does not exist/i);
  });

  it('should handle null confidence score and details', async () => {
    const input: CreateMemoryInput = {
      user_id: userId,
      embedding: [0.1, 0.2, 0.3],
      memory_type: 'procedural',
      summary: 'Memory without confidence or details',
      full_text: 'This memory has no confidence score or additional details.',
      details: null,
      confidence_score: null
    };

    const result = await createMemory(input);
    expect(result.details).toBeNull();
    expect(result.confidence_score).toBeNull();
  });
});