import { db } from '../db';
import { memoriesTable, usersTable } from '../db/schema';
import { type CreateMemoryInput, type Memory } from '../schema';
import { eq } from 'drizzle-orm';

export const createMemory = async (input: CreateMemoryInput): Promise<Memory> => {
  try {
    // Verify that the user exists before creating the memory
    const userExists = await db.select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (userExists.length === 0) {
      throw new Error(`User with id ${input.user_id} does not exist`);
    }

    // Insert memory record
    const result = await db.insert(memoriesTable)
      .values({
        user_id: input.user_id,
        embedding: input.embedding,
        memory_type: input.memory_type,
        summary: input.summary,
        full_text: input.full_text,
        details: input.details || null,
        confidence_score: input.confidence_score || null
      })
      .returning()
      .execute();

    const memory = result[0];
    return {
      ...memory,
      details: memory.details as Record<string, any> | null
    };
  } catch (error) {
    console.error('Memory creation failed:', error);
    throw error;
  }
};