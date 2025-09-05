import { db } from '../db';
import { memoriesTable } from '../db/schema';
import { type Memory, type MemoryType } from '../schema';
import { eq, and, sql } from 'drizzle-orm';

// Input type for conversation processing
export interface ProcessConversationInput {
    userId: number;
    sessionId: number;
    messages: Array<{
        role: 'user' | 'assistant';
        content: string;
        timestamp: Date;
    }>;
}

// Memory extraction patterns
const MEMORY_PATTERNS = {
  semantic: [
    /i like|i love|i enjoy|i prefer|i hate|i dislike/i,
    /my favorite|my preferred|i always|i never/i,
    /i am|i'm a|i work as|i study/i,
    /i believe|i think that|in my opinion/i
  ],
  episodic: [
    /yesterday|today|last week|last month|when i was/i,
    /i went to|i visited|i met|i did|i saw/i,
    /it happened|that time when|i remember when/i,
    /at \d|on monday|on tuesday|on wednesday|on thursday|on friday|on saturday|on sunday/i
  ],
  procedural: [
    /how to|the way i|i usually|my routine|my process/i,
    /step by step|first i|then i|finally i/i,
    /my habit|i typically|i normally/i,
    /the best way to|my approach is/i
  ],
  emotional: [
    /i feel|i felt|i'm feeling|i was feeling/i,
    /made me happy|made me sad|frustrated|excited|nervous|anxious/i,
    /i'm worried|i'm concerned|i'm thrilled|i'm disappointed/i,
    /emotional|feelings|mood/i
  ],
  'value-principle': [
    /i believe in|it's important to|i value|my principle/i,
    /i stand for|i care about|what matters to me/i,
    /my philosophy|my values|morally|ethically/i,
    /right thing to do|wrong to|should always|should never/i
  ]
};

// Simple embedding generation (mock implementation)
// In a real system, this would use a proper embedding model
const generateEmbedding = (text: string): number[] => {
  // Simple hash-based pseudo-embedding for testing
  const hash = text.toLowerCase().split('').reduce((acc, char) => {
    acc = ((acc << 5) - acc) + char.charCodeAt(0);
    return acc & acc; // Convert to 32-bit integer
  }, 0);
  
  // Generate a 128-dimensional vector
  const embedding = [];
  let seed = Math.abs(hash);
  for (let i = 0; i < 128; i++) {
    seed = (seed * 9301 + 49297) % 233280;
    embedding.push((seed / 233280) - 0.5); // Normalize to [-0.5, 0.5]
  }
  return embedding;
};

// Extract memories from conversation content
const extractMemories = (content: string, memoryType: MemoryType): Array<{
  type: MemoryType;
  summary: string;
  fullText: string;
  confidence: number;
}> => {
  const patterns = MEMORY_PATTERNS[memoryType];
  const memories: Array<{
    type: MemoryType;
    summary: string;
    fullText: string;
    confidence: number;
  }> = [];

  // Split content into sentences
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (trimmed.length < 10) continue;

    for (const pattern of patterns) {
      if (pattern.test(trimmed)) {
        // Generate summary (first 100 chars + ellipsis if longer)
        const summary = trimmed.length > 100 
          ? trimmed.substring(0, 97) + '...'
          : trimmed;

        memories.push({
          type: memoryType,
          summary,
          fullText: trimmed,
          confidence: 0.7 + Math.random() * 0.3 // Random confidence between 0.7-1.0
        });
        break; // Don't double-match the same sentence
      }
    }
  }

  return memories;
};

export const processConversation = async (input: ProcessConversationInput): Promise<Memory[]> => {
  try {
    const createdMemories: Memory[] = [];
    
    // Process only user messages for memory extraction
    const userMessages = input.messages.filter(msg => msg.role === 'user');
    
    if (userMessages.length === 0) {
      return [];
    }

    // Combine all user messages into conversation context
    const conversationText = userMessages.map(msg => msg.content).join(' ');
    
    // Extract potential memories for each type
    const allPotentialMemories: Array<{
      type: MemoryType;
      summary: string;
      fullText: string;
      confidence: number;
    }> = [];

    // Check each memory type
    const memoryTypes: MemoryType[] = ['semantic', 'episodic', 'procedural', 'emotional', 'value-principle'];
    
    for (const memoryType of memoryTypes) {
      const extracted = extractMemories(conversationText, memoryType);
      allPotentialMemories.push(...extracted);
    }

    // Create memories in database
    for (const potentialMemory of allPotentialMemories) {
      const embedding = generateEmbedding(potentialMemory.fullText);
      
      // Check for similar existing memories to avoid duplicates
      const existingMemories = await db.select()
        .from(memoriesTable)
        .where(
          and(
            eq(memoriesTable.user_id, input.userId),
            eq(memoriesTable.memory_type, potentialMemory.type)
          )
        )
        .limit(100)
        .execute();

      // Simple duplicate detection based on text similarity
      const isDuplicate = existingMemories.some(existing => {
        const similarity = calculateTextSimilarity(existing.summary, potentialMemory.summary);
        return similarity > 0.8; // 80% similarity threshold
      });

      if (!isDuplicate) {
        const result = await db.insert(memoriesTable)
          .values({
            user_id: input.userId,
            embedding,
            memory_type: potentialMemory.type,
            summary: potentialMemory.summary,
            full_text: potentialMemory.fullText,
            details: {
              session_id: input.sessionId,
              extracted_at: new Date().toISOString(),
              confidence_reason: 'pattern_match',
              source: 'conversation'
            },
            confidence_score: potentialMemory.confidence
          })
          .returning()
          .execute();

        const memory = result[0];
        createdMemories.push({
          ...memory,
          details: memory.details as Record<string, any> | null,
          confidence_score: memory.confidence_score ? parseFloat(memory.confidence_score.toString()) : null
        });
      }
    }

    return createdMemories;
  } catch (error) {
    console.error('Conversation processing failed:', error);
    throw error;
  }
};

// Simple text similarity calculation
const calculateTextSimilarity = (text1: string, text2: string): number => {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(word => words2.has(word)));
  const union = new Set([...words1, ...words2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
};