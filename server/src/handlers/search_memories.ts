import { db } from '../db';
import { memoriesTable } from '../db/schema';
import { type SearchMemoriesInput, type Memory } from '../schema';
import { eq, and, or, ilike, desc, sql, type SQL } from 'drizzle-orm';

export const searchMemories = async (input: SearchMemoriesInput): Promise<Memory[]> => {
  try {
    // Build conditions array
    const conditions: SQL<unknown>[] = [];

    // Always filter by user_id
    conditions.push(eq(memoriesTable.user_id, input.user_id));

    // Filter by memory type if specified
    if (input.memory_type) {
      conditions.push(eq(memoriesTable.memory_type, input.memory_type));
    }

    // Text search in summary and full_text if query provided
    if (input.query && input.query.trim()) {
      const searchTerm = `%${input.query.trim()}%`;
      conditions.push(
        or(
          ilike(memoriesTable.summary, searchTerm),
          ilike(memoriesTable.full_text, searchTerm)
        )!
      );
    }

    // Build the complete query step by step
    const baseQuery = db.select().from(memoriesTable);
    
    const queryWithConditions = conditions.length === 1 
      ? baseQuery.where(conditions[0])
      : baseQuery.where(and(...conditions));

    // Apply ordering
    const orderedQuery = queryWithConditions.orderBy(
      desc(memoriesTable.confidence_score),
      desc(memoriesTable.created_at)
    );

    // Apply pagination and execute
    const results = await orderedQuery
      .limit(input.limit)
      .offset(input.offset)
      .execute();

    // Convert to proper Memory type and handle type casting
    return results.map(memory => ({
      ...memory,
      confidence_score: memory.confidence_score,
      embedding: memory.embedding || [],
      details: memory.details as Record<string, any> | null
    }));
  } catch (error) {
    console.error('Memory search failed:', error);
    throw error;
  }
};