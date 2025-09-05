import { db } from '../db';
import { memoriesTable } from '../db/schema';
import { type UpdateMemoryInput, type Memory } from '../schema';
import { eq } from 'drizzle-orm';

export const updateMemory = async (input: UpdateMemoryInput): Promise<Memory> => {
  try {
    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date()
    };

    if (input.embedding !== undefined) {
      updateData.embedding = input.embedding;
    }
    if (input.memory_type !== undefined) {
      updateData.memory_type = input.memory_type;
    }
    if (input.summary !== undefined) {
      updateData.summary = input.summary;
    }
    if (input.full_text !== undefined) {
      updateData.full_text = input.full_text;
    }
    if (input.details !== undefined) {
      updateData.details = input.details;
    }
    if (input.confidence_score !== undefined) {
      updateData.confidence_score = input.confidence_score;
    }

    // Update the memory record
    const result = await db.update(memoriesTable)
      .set(updateData)
      .where(eq(memoriesTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Memory with id ${input.id} not found`);
    }

    // Return the updated memory with proper type conversions
    const memory = result[0];
    return {
      ...memory,
      details: memory.details as Record<string, any> | null,
      confidence_score: memory.confidence_score // Already a number or null
    };
  } catch (error) {
    console.error('Memory update failed:', error);
    throw error;
  }
};