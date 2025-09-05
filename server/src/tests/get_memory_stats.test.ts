import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, memoriesTable } from '../db/schema';
import { type GetMemoryStatsInput } from '../schema';
import { getMemoryStats } from '../handlers/get_memory_stats';

describe('getMemoryStats', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;

  beforeEach(async () => {
    // Create test user directly in database
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

  it('should return empty stats for user with no memories', async () => {
    const input: GetMemoryStatsInput = {
      user_id: testUserId
    };

    const result = await getMemoryStats(input);

    expect(result.total_memories).toEqual(0);
    expect(result.memories_by_type).toEqual({
      episodic: 0,
      semantic: 0,
      procedural: 0,
      emotional: 0,
      'value-principle': 0
    });
    expect(result.recent_memories).toEqual(0);
    expect(result.avg_confidence_score).toBeNull();
  });

  it('should return correct total memories count', async () => {
    // Create multiple memories directly in database
    await db.insert(memoriesTable)
      .values([
        {
          user_id: testUserId,
          embedding: [0.1, 0.2, 0.3],
          memory_type: 'episodic',
          summary: 'Memory 1',
          full_text: 'Full text 1',
          confidence_score: 0.8
        },
        {
          user_id: testUserId,
          embedding: [0.4, 0.5, 0.6],
          memory_type: 'semantic',
          summary: 'Memory 2',
          full_text: 'Full text 2',
          confidence_score: 0.9
        }
      ])
      .execute();

    const input: GetMemoryStatsInput = {
      user_id: testUserId
    };

    const result = await getMemoryStats(input);

    expect(result.total_memories).toEqual(2);
  });

  it('should return correct memories count by type', async () => {
    // Create memories of different types
    await db.insert(memoriesTable)
      .values([
        {
          user_id: testUserId,
          embedding: [0.1, 0.2, 0.3],
          memory_type: 'episodic',
          summary: 'Episodic memory 1',
          full_text: 'Full text',
          confidence_score: 0.8
        },
        {
          user_id: testUserId,
          embedding: [0.4, 0.5, 0.6],
          memory_type: 'episodic',
          summary: 'Episodic memory 2',
          full_text: 'Full text',
          confidence_score: 0.7
        },
        {
          user_id: testUserId,
          embedding: [0.7, 0.8, 0.9],
          memory_type: 'semantic',
          summary: 'Semantic memory',
          full_text: 'Full text',
          confidence_score: 0.9
        },
        {
          user_id: testUserId,
          embedding: [0.1, 0.3, 0.5],
          memory_type: 'procedural',
          summary: 'Procedural memory',
          full_text: 'Full text',
          confidence_score: 0.6
        }
      ])
      .execute();

    const input: GetMemoryStatsInput = {
      user_id: testUserId
    };

    const result = await getMemoryStats(input);

    expect(result.total_memories).toEqual(4);
    expect(result.memories_by_type).toEqual({
      episodic: 2,
      semantic: 1,
      procedural: 1,
      emotional: 0,
      'value-principle': 0
    });
  });

  it('should return correct recent memories count', async () => {
    const now = new Date();
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    // Create recent and old memories
    await db.insert(memoriesTable)
      .values([
        {
          user_id: testUserId,
          embedding: [0.1, 0.2, 0.3],
          memory_type: 'episodic',
          summary: 'Recent memory',
          full_text: 'Full text',
          confidence_score: 0.8,
          created_at: now,
          updated_at: now
        },
        {
          user_id: testUserId,
          embedding: [0.4, 0.5, 0.6],
          memory_type: 'semantic',
          summary: 'Old memory',
          full_text: 'Full text',
          confidence_score: 0.7,
          created_at: tenDaysAgo,
          updated_at: tenDaysAgo
        }
      ])
      .execute();

    const input: GetMemoryStatsInput = {
      user_id: testUserId
    };

    const result = await getMemoryStats(input);

    expect(result.total_memories).toEqual(2);
    expect(result.recent_memories).toEqual(1); // Only the recent one
  });

  it('should calculate correct average confidence score', async () => {
    // Create memories with different confidence scores
    await db.insert(memoriesTable)
      .values([
        {
          user_id: testUserId,
          embedding: [0.1, 0.2, 0.3],
          memory_type: 'episodic',
          summary: 'Memory 1',
          full_text: 'Full text',
          confidence_score: 0.8
        },
        {
          user_id: testUserId,
          embedding: [0.4, 0.5, 0.6],
          memory_type: 'semantic',
          summary: 'Memory 2',
          full_text: 'Full text',
          confidence_score: 0.6
        },
        {
          user_id: testUserId,
          embedding: [0.7, 0.8, 0.9],
          memory_type: 'procedural',
          summary: 'Memory 3',
          full_text: 'Full text',
          confidence_score: 1.0
        }
      ])
      .execute();

    const input: GetMemoryStatsInput = {
      user_id: testUserId
    };

    const result = await getMemoryStats(input);

    // Average of 0.8, 0.6, 1.0 = 2.4/3 = 0.8
    expect(result.avg_confidence_score).toBeCloseTo(0.8, 2);
  });

  it('should handle memories without confidence scores', async () => {
    // Create memories with and without confidence scores
    await db.insert(memoriesTable)
      .values([
        {
          user_id: testUserId,
          embedding: [0.1, 0.2, 0.3],
          memory_type: 'episodic',
          summary: 'Memory with confidence',
          full_text: 'Full text',
          confidence_score: 0.8
        },
        {
          user_id: testUserId,
          embedding: [0.4, 0.5, 0.6],
          memory_type: 'semantic',
          summary: 'Memory without confidence',
          full_text: 'Full text',
          confidence_score: null
        }
      ])
      .execute();

    const input: GetMemoryStatsInput = {
      user_id: testUserId
    };

    const result = await getMemoryStats(input);

    expect(result.total_memories).toEqual(2);
    // Average should only consider memories with confidence scores
    expect(result.avg_confidence_score).toBeCloseTo(0.8, 2);
  });

  it('should return null average confidence when no memories have confidence scores', async () => {
    // Create memory without confidence score
    await db.insert(memoriesTable)
      .values({
        user_id: testUserId,
        embedding: [0.1, 0.2, 0.3],
        memory_type: 'episodic',
        summary: 'Memory without confidence',
        full_text: 'Full text',
        confidence_score: null
      })
      .execute();

    const input: GetMemoryStatsInput = {
      user_id: testUserId
    };

    const result = await getMemoryStats(input);

    expect(result.total_memories).toEqual(1);
    expect(result.avg_confidence_score).toBeNull();
  });

  it('should only return stats for the specified user', async () => {
    // Create second user
    const secondUserResult = await db.insert(usersTable)
      .values({
        username: 'testuser2',
        email: 'test2@example.com',
        password_hash: 'hashed_password2'
      })
      .returning()
      .execute();
    
    const secondUserId = secondUserResult[0].id;

    // Create memories for both users
    await db.insert(memoriesTable)
      .values([
        {
          user_id: testUserId,
          embedding: [0.1, 0.2, 0.3],
          memory_type: 'episodic',
          summary: 'User 1 memory',
          full_text: 'Full text',
          confidence_score: 0.8
        },
        {
          user_id: secondUserId,
          embedding: [0.4, 0.5, 0.6],
          memory_type: 'semantic',
          summary: 'User 2 memory',
          full_text: 'Full text',
          confidence_score: 0.9
        }
      ])
      .execute();

    const input: GetMemoryStatsInput = {
      user_id: testUserId
    };

    const result = await getMemoryStats(input);

    // Should only count first user's memories
    expect(result.total_memories).toEqual(1);
    expect(result.memories_by_type['episodic']).toEqual(1);
    expect(result.memories_by_type['semantic']).toEqual(0);
    expect(result.avg_confidence_score).toBeCloseTo(0.8, 2);
  });

  it('should handle all memory types correctly', async () => {
    // Create one memory of each type
    await db.insert(memoriesTable)
      .values([
        {
          user_id: testUserId,
          embedding: [0.1, 0.2, 0.3],
          memory_type: 'episodic',
          summary: 'Episodic memory',
          full_text: 'Full text',
          confidence_score: 0.8
        },
        {
          user_id: testUserId,
          embedding: [0.1, 0.2, 0.3],
          memory_type: 'semantic',
          summary: 'Semantic memory',
          full_text: 'Full text',
          confidence_score: 0.8
        },
        {
          user_id: testUserId,
          embedding: [0.1, 0.2, 0.3],
          memory_type: 'procedural',
          summary: 'Procedural memory',
          full_text: 'Full text',
          confidence_score: 0.8
        },
        {
          user_id: testUserId,
          embedding: [0.1, 0.2, 0.3],
          memory_type: 'emotional',
          summary: 'Emotional memory',
          full_text: 'Full text',
          confidence_score: 0.8
        },
        {
          user_id: testUserId,
          embedding: [0.1, 0.2, 0.3],
          memory_type: 'value-principle',
          summary: 'Value-principle memory',
          full_text: 'Full text',
          confidence_score: 0.8
        }
      ])
      .execute();

    const input: GetMemoryStatsInput = {
      user_id: testUserId
    };

    const result = await getMemoryStats(input);

    expect(result.total_memories).toEqual(5);
    expect(result.memories_by_type).toEqual({
      episodic: 1,
      semantic: 1,
      procedural: 1,
      emotional: 1,
      'value-principle': 1
    });
  });

  it('should handle edge case with very recent memories', async () => {
    const now = new Date();
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    // Create memories within the 7-day window
    await db.insert(memoriesTable)
      .values([
        {
          user_id: testUserId,
          embedding: [0.1, 0.2, 0.3],
          memory_type: 'episodic',
          summary: 'Very recent memory',
          full_text: 'Full text',
          confidence_score: 0.8,
          created_at: now,
          updated_at: now
        },
        {
          user_id: testUserId,
          embedding: [0.4, 0.5, 0.6],
          memory_type: 'semantic',
          summary: 'Recent memory',
          full_text: 'Full text',
          confidence_score: 0.7,
          created_at: threeDaysAgo,
          updated_at: threeDaysAgo
        }
      ])
      .execute();

    const input: GetMemoryStatsInput = {
      user_id: testUserId
    };

    const result = await getMemoryStats(input);

    expect(result.total_memories).toEqual(2);
    expect(result.recent_memories).toEqual(2); // Both should be considered recent
  });
});