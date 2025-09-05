import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, memoriesTable } from '../db/schema';
import { type SearchMemoriesInput } from '../schema';
import { searchMemories } from '../handlers/search_memories';

// Test user and memories data
const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  password_hash: 'hashedpassword123'
};

const testMemories = [
  {
    user_id: 1, // Will be set after user creation
    embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
    memory_type: 'episodic' as const,
    summary: 'Had a great meeting with the team about project planning',
    full_text: 'Today I had an excellent meeting with Sarah, John, and Mike about the Q4 project planning. We discussed timelines, resource allocation, and key milestones.',
    details: { keywords: ['meeting', 'team', 'planning'], emotion: 'positive' },
    confidence_score: 0.9
  },
  {
    user_id: 1,
    embedding: [0.8, 0.1, 0.2, 0.6, 0.3],
    memory_type: 'semantic' as const,
    summary: 'JavaScript async/await patterns for better code organization',
    full_text: 'Learned about advanced JavaScript async/await patterns, including error handling with try/catch blocks and parallel execution with Promise.all.',
    details: { keywords: ['javascript', 'async', 'programming'], category: 'technical' },
    confidence_score: 0.8
  },
  {
    user_id: 1,
    embedding: [0.2, 0.9, 0.1, 0.3, 0.7],
    memory_type: 'emotional' as const,
    summary: 'Felt stressed about upcoming deadline',
    full_text: 'Feeling anxious about the project deadline next week. Need to prioritize tasks and maybe ask for help with the frontend components.',
    details: { emotion: 'stress', intensity: 'high' },
    confidence_score: 0.7
  },
  {
    user_id: 1,
    embedding: [0.5, 0.3, 0.8, 0.2, 0.1],
    memory_type: 'procedural' as const,
    summary: 'Coffee brewing technique using pour-over method',
    full_text: 'Perfected my pour-over coffee technique: 1:16 ratio, 200°F water, 30-second bloom, circular pouring motion, total brew time 4 minutes.',
    details: { skill: 'coffee-making', proficiency: 'intermediate' },
    confidence_score: 0.6
  }
];

describe('searchMemories', () => {
  let userId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    userId = userResult[0].id;

    // Create test memories with correct user_id
    const memoriesWithUserId = testMemories.map(memory => ({
      ...memory,
      user_id: userId
    }));

    await db.insert(memoriesTable)
      .values(memoriesWithUserId)
      .execute();
  });

  afterEach(resetDB);

  it('should search all memories for a user when no filters applied', async () => {
    const input: SearchMemoriesInput = {
      user_id: userId,
      limit: 20,
      offset: 0
    };

    const result = await searchMemories(input);

    expect(result).toHaveLength(4);
    // Should be ordered by confidence_score desc, then created_at desc
    expect(result[0].confidence_score).toBe(0.9);
    expect(result[1].confidence_score).toBe(0.8);
    expect(result[2].confidence_score).toBe(0.7);
    expect(result[3].confidence_score).toBe(0.6);
  });

  it('should filter memories by memory type', async () => {
    const input: SearchMemoriesInput = {
      user_id: userId,
      memory_type: 'semantic',
      limit: 20,
      offset: 0
    };

    const result = await searchMemories(input);

    expect(result).toHaveLength(1);
    expect(result[0].memory_type).toBe('semantic');
    expect(result[0].summary).toContain('JavaScript async/await patterns');
  });

  it('should perform text search in summary and full_text', async () => {
    const input: SearchMemoriesInput = {
      user_id: userId,
      query: 'meeting',
      limit: 20,
      offset: 0
    };

    const result = await searchMemories(input);

    expect(result).toHaveLength(1);
    expect(result[0].summary).toContain('meeting');
    expect(result[0].memory_type).toBe('episodic');
  });

  it('should search in full_text when query not found in summary', async () => {
    const input: SearchMemoriesInput = {
      user_id: userId,
      query: 'Promise.all',
      limit: 20,
      offset: 0
    };

    const result = await searchMemories(input);

    expect(result).toHaveLength(1);
    expect(result[0].full_text).toContain('Promise.all');
    expect(result[0].memory_type).toBe('semantic');
  });

  it('should handle case-insensitive text search', async () => {
    const input: SearchMemoriesInput = {
      user_id: userId,
      query: 'JAVASCRIPT',
      limit: 20,
      offset: 0
    };

    const result = await searchMemories(input);

    expect(result).toHaveLength(1);
    expect(result[0].summary.toLowerCase()).toContain('javascript');
  });

  it('should combine memory type and text search filters', async () => {
    const input: SearchMemoriesInput = {
      user_id: userId,
      memory_type: 'emotional',
      query: 'deadline',
      limit: 20,
      offset: 0
    };

    const result = await searchMemories(input);

    expect(result).toHaveLength(1);
    expect(result[0].memory_type).toBe('emotional');
    expect(result[0].full_text).toContain('deadline');
  });

  it('should apply pagination correctly', async () => {
    const input: SearchMemoriesInput = {
      user_id: userId,
      limit: 2,
      offset: 0
    };

    const firstPage = await searchMemories(input);
    expect(firstPage).toHaveLength(2);

    const input2: SearchMemoriesInput = {
      user_id: userId,
      limit: 2,
      offset: 2
    };

    const secondPage = await searchMemories(input2);
    expect(secondPage).toHaveLength(2);

    // Should not overlap
    expect(firstPage[0].id).not.toBe(secondPage[0].id);
    expect(firstPage[1].id).not.toBe(secondPage[1].id);
  });

  it('should return empty array when no memories match filters', async () => {
    const input: SearchMemoriesInput = {
      user_id: userId,
      query: 'nonexistent term',
      limit: 20,
      offset: 0
    };

    const result = await searchMemories(input);
    expect(result).toHaveLength(0);
  });

  it('should return empty array for non-existent user', async () => {
    const input: SearchMemoriesInput = {
      user_id: 99999, // Non-existent user
      limit: 20,
      offset: 0
    };

    const result = await searchMemories(input);
    expect(result).toHaveLength(0);
  });

  it('should handle empty query string gracefully', async () => {
    const input: SearchMemoriesInput = {
      user_id: userId,
      query: '',
      limit: 20,
      offset: 0
    };

    const result = await searchMemories(input);
    expect(result).toHaveLength(4); // Should return all memories (no text filtering)
  });

  it('should handle whitespace-only query gracefully', async () => {
    const input: SearchMemoriesInput = {
      user_id: userId,
      query: '   ',
      limit: 20,
      offset: 0
    };

    const result = await searchMemories(input);
    expect(result).toHaveLength(4); // Should return all memories (no text filtering)
  });

  it('should include all required fields in results', async () => {
    const input: SearchMemoriesInput = {
      user_id: userId,
      limit: 1,
      offset: 0
    };

    const result = await searchMemories(input);
    expect(result).toHaveLength(1);

    const memory = result[0];
    expect(memory.id).toBeDefined();
    expect(memory.user_id).toBe(userId);
    expect(memory.embedding).toBeDefined();
    expect(Array.isArray(memory.embedding)).toBe(true);
    expect(memory.memory_type).toBeDefined();
    expect(memory.summary).toBeDefined();
    expect(memory.full_text).toBeDefined();
    expect(memory.created_at).toBeInstanceOf(Date);
    expect(memory.updated_at).toBeInstanceOf(Date);
    expect(typeof memory.confidence_score).toBe('number');
  });

  it('should handle embedding input and maintain ordering', async () => {
    // Provide an embedding vector (simulating semantic search input)
    const queryEmbedding = [0.15, 0.25, 0.35, 0.45, 0.55];
    
    const input: SearchMemoriesInput = {
      user_id: userId,
      embedding: queryEmbedding,
      limit: 20,
      offset: 0
    };

    const result = await searchMemories(input);
    expect(result).toHaveLength(4);

    // Should still be ordered by confidence score (since we're simulating semantic search)
    expect(result[0].confidence_score).toBe(0.9);
    expect(result[1].confidence_score).toBe(0.8);
    
    // Verify embedding field is preserved
    expect(Array.isArray(result[0].embedding)).toBe(true);
    expect(result[0].embedding.length).toBeGreaterThan(0);
  });
});