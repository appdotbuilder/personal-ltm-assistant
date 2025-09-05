import { db } from '../db';
import { memoriesTable } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export const deleteMemory = async (memoryId: number, userId: number): Promise<boolean> => {
  try {
    // Delete memory only if it belongs to the requesting user (security check)
    const result = await db.delete(memoriesTable)
      .where(
        and(
          eq(memoriesTable.id, memoryId),
          eq(memoriesTable.user_id, userId)
        )
      )
      .execute();

    // Check if any row was actually deleted
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('Memory deletion failed:', error);
    throw error;
  }
};