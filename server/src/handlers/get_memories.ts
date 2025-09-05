import { db } from '../db';
import { memoriesTable } from '../db/schema';
import { type Memory, type SearchMemoriesInput } from '../schema';
import { eq, desc, and, ilike } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

// Internal implementation with full search capabilities
const getMemoriesWithSearch = async (input: SearchMemoriesInput): Promise<Memory[]> => {
  try {
    // Build conditions array
    const conditions: SQL<unknown>[] = [];

    // Always filter by user_id
    conditions.push(eq(memoriesTable.user_id, input.user_id));

    // Add optional memory type filter
    if (input.memory_type) {
      conditions.push(eq(memoriesTable.memory_type, input.memory_type));
    }

    // Add optional text search filter
    if (input.query) {
      conditions.push(ilike(memoriesTable.summary, `%${input.query}%`));
    }

    // Build and execute query
    const query = db.select()
      .from(memoriesTable)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(memoriesTable.created_at))
      .limit(input.limit)
      .offset(input.offset);

    const results = await query.execute();

    // Convert and return results with proper typing
    return results.map(memory => ({
      id: memory.id,
      user_id: memory.user_id,
      embedding: memory.embedding,
      memory_type: memory.memory_type,
      summary: memory.summary,
      full_text: memory.full_text,
      details: memory.details as Record<string, any> | null,
      confidence_score: memory.confidence_score ? parseFloat(memory.confidence_score.toString()) : null,
      created_at: memory.created_at,
      updated_at: memory.updated_at
    }));
  } catch (error) {
    console.error('Get memories failed:', error);
    throw error;
  }
};

// Main export - supports both simple userId and full SearchMemoriesInput
export const getMemories = async (input: number | SearchMemoriesInput): Promise<Memory[]> => {
  // If input is just a number (userId), convert to SearchMemoriesInput with defaults
  if (typeof input === 'number') {
    return getMemoriesWithSearch({
      user_id: input,
      limit: 20,
      offset: 0
    });
  }
  
  // Otherwise, use the full input object
  return getMemoriesWithSearch(input);
};