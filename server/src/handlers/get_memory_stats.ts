import { db } from '../db';
import { memoriesTable } from '../db/schema';
import { type GetMemoryStatsInput, type MemoryStats } from '../schema';
import { eq, count, avg, gte, and, SQL } from 'drizzle-orm';

export const getMemoryStats = async (input: GetMemoryStatsInput): Promise<MemoryStats> => {
  try {
    // Get total memories count
    const totalResult = await db.select({
      count: count()
    })
      .from(memoriesTable)
      .where(eq(memoriesTable.user_id, input.user_id))
      .execute();

    const total_memories = totalResult[0]?.count || 0;

    // Get memories count by type
    const typeResults = await db.select({
      memory_type: memoriesTable.memory_type,
      count: count()
    })
      .from(memoriesTable)
      .where(eq(memoriesTable.user_id, input.user_id))
      .groupBy(memoriesTable.memory_type)
      .execute();

    // Initialize memories_by_type with all types set to 0
    const memories_by_type: Record<string, number> = {
      episodic: 0,
      semantic: 0,
      procedural: 0,
      emotional: 0,
      'value-principle': 0
    };

    // Populate with actual counts
    typeResults.forEach(result => {
      memories_by_type[result.memory_type] = result.count;
    });

    // Get recent memories count (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentResult = await db.select({
      count: count()
    })
      .from(memoriesTable)
      .where(
        and(
          eq(memoriesTable.user_id, input.user_id),
          gte(memoriesTable.created_at, sevenDaysAgo)
        )
      )
      .execute();

    const recent_memories = recentResult[0]?.count || 0;

    // Get average confidence score (only for memories that have confidence scores)
    const avgResult = await db.select({
      avg_confidence: avg(memoriesTable.confidence_score)
    })
      .from(memoriesTable)
      .where(eq(memoriesTable.user_id, input.user_id))
      .execute();

    // Convert the string result to number or null
    const avgConfidenceStr = avgResult[0]?.avg_confidence;
    const avg_confidence_score = avgConfidenceStr ? parseFloat(avgConfidenceStr) : null;

    return {
      total_memories,
      memories_by_type,
      recent_memories,
      avg_confidence_score
    };
  } catch (error) {
    console.error('Failed to get memory stats:', error);
    throw error;
  }
};