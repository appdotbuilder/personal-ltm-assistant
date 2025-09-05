import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, memoriesTable, chatSessionsTable } from '../db/schema';
import { generateResponse, type GenerateResponseInput } from '../handlers/generate_response';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  password_hash: 'hashedpassword123'
};

const testMemories = [
  {
    user_id: 1,
    embedding: new Array(128).fill(0.1).map((_, i) => i % 2 === 0 ? 0.1 : -0.1),
    memory_type: 'episodic' as const,
    summary: 'User likes pizza and Italian food',
    full_text: 'The user mentioned loving pizza, especially margherita, and enjoys Italian cuisine in general.',
    details: { keywords: ['pizza', 'italian', 'food'], emotion: 'positive' },
    confidence_score: 0.9
  },
  {
    user_id: 1,
    embedding: new Array(128).fill(0.05).map((_, i) => i % 3 === 0 ? 0.2 : -0.05),
    memory_type: 'semantic' as const,
    summary: 'Programming knowledge in JavaScript and TypeScript',
    full_text: 'User has experience with JavaScript and TypeScript development, particularly with Node.js applications.',
    details: { skills: ['javascript', 'typescript', 'nodejs'], level: 'intermediate' },
    confidence_score: 0.8
  },
  {
    user_id: 1,
    embedding: new Array(128).fill(0.02).map((_, i) => i % 5 === 0 ? 0.15 : 0.02),
    memory_type: 'emotional' as const,
    summary: 'User expressed stress about work deadlines',
    full_text: 'User mentioned feeling overwhelmed with work deadlines and project management challenges.',
    details: { emotion: 'stressed', context: 'work', intensity: 0.7 },
    confidence_score: 0.7
  }
];

const testSession = {
  user_id: 1,
  title: 'Test Chat Session'
};

const baseInput: GenerateResponseInput = {
  userId: 1,
  sessionId: 1,
  userMessage: 'What do you know about my food preferences?',
  conversationHistory: [
    {
      role: 'user' as const,
      content: 'Hi, I was wondering about some food recommendations',
      timestamp: new Date(Date.now() - 600000) // 10 minutes ago
    },
    {
      role: 'assistant' as const,
      content: 'I can help with food recommendations. What are you in the mood for?',
      timestamp: new Date(Date.now() - 300000) // 5 minutes ago
    }
  ]
};

describe('generateResponse', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should generate response with relevant memories', async () => {
    // Create user
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create chat session
    const [session] = await db.insert(chatSessionsTable)
      .values({ ...testSession, user_id: user.id })
      .returning()
      .execute();

    // Create memories
    await db.insert(memoriesTable)
      .values(testMemories.map(memory => ({ ...memory, user_id: user.id })))
      .execute();

    const input = {
      ...baseInput,
      userId: user.id,
      sessionId: session.id
    };

    const result = await generateResponse(input);

    // Verify response structure
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(typeof result.content).toBe('string');
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.relevantMemories).toBeDefined();
    expect(Array.isArray(result.relevantMemories)).toBe(true);
    expect(typeof result.confidence).toBe('number');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('should find food-related memories for food questions', async () => {
    // Create user
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create chat session
    const [session] = await db.insert(chatSessionsTable)
      .values({ ...testSession, user_id: user.id })
      .returning()
      .execute();

    // Create memories
    await db.insert(memoriesTable)
      .values(testMemories.map(memory => ({ ...memory, user_id: user.id })))
      .execute();

    const input = {
      ...baseInput,
      userId: user.id,
      sessionId: session.id,
      userMessage: 'What kind of food do I like?'
    };

    const result = await generateResponse(input);

    // Should find food-related memory
    expect(result.relevantMemories.length).toBeGreaterThan(0);
    
    // Should contain the pizza memory
    const foodMemory = result.relevantMemories.find(m => m.summary.includes('pizza'));
    expect(foodMemory).toBeDefined();
    expect(foodMemory?.memory_type).toBe('episodic');
    
    // Response should mention food preferences
    expect(result.content.toLowerCase()).toMatch(/food|pizza|italian/);
  });

  it('should find programming memories for technical questions', async () => {
    // Create user
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create chat session
    const [session] = await db.insert(chatSessionsTable)
      .values({ ...testSession, user_id: user.id })
      .returning()
      .execute();

    // Create memories
    await db.insert(memoriesTable)
      .values(testMemories.map(memory => ({ ...memory, user_id: user.id })))
      .execute();

    const input = {
      ...baseInput,
      userId: user.id,
      sessionId: session.id,
      userMessage: 'What programming languages do I know?'
    };

    const result = await generateResponse(input);

    // Should find programming-related memory
    expect(result.relevantMemories.length).toBeGreaterThan(0);
    
    // Should contain the programming memory
    const techMemory = result.relevantMemories.find(m => m.summary.includes('JavaScript'));
    expect(techMemory).toBeDefined();
    expect(techMemory?.memory_type).toBe('semantic');
    
    // Response should mention programming knowledge
    expect(result.content.toLowerCase()).toMatch(/javascript|typescript|programming/);
  });

  it('should handle no relevant memories gracefully', async () => {
    // Create user
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create chat session
    const [session] = await db.insert(chatSessionsTable)
      .values({ ...testSession, user_id: user.id })
      .returning()
      .execute();

    // Don't create any memories

    const input = {
      ...baseInput,
      userId: user.id,
      sessionId: session.id,
      userMessage: 'Tell me about quantum physics'
    };

    const result = await generateResponse(input);

    // Should handle gracefully
    expect(result.relevantMemories).toHaveLength(0);
    expect(result.confidence).toBeLessThan(0.5);
    expect(result.content).toMatch(/don't have specific memories|provide more context/i);
  });

  it('should throw error for invalid session', async () => {
    // Create user but no session
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const input = {
      ...baseInput,
      userId: user.id,
      sessionId: 999, // Non-existent session
    };

    await expect(generateResponse(input)).rejects.toThrow(/session not found/i);
  });

  it('should throw error for wrong user session access', async () => {
    // Create two users
    const [user1] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const [user2] = await db.insert(usersTable)
      .values({ ...testUser, username: 'user2', email: 'user2@example.com' })
      .returning()
      .execute();

    // Create session for user2
    const [session] = await db.insert(chatSessionsTable)
      .values({ ...testSession, user_id: user2.id })
      .returning()
      .execute();

    // Try to access user2's session as user1
    const input = {
      ...baseInput,
      userId: user1.id,
      sessionId: session.id,
    };

    await expect(generateResponse(input)).rejects.toThrow(/session not found|access denied/i);
  });

  it('should calculate confidence based on memory relevance', async () => {
    // Create user
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create chat session
    const [session] = await db.insert(chatSessionsTable)
      .values({ ...testSession, user_id: user.id })
      .returning()
      .execute();

    // Create multiple highly relevant memories with good embeddings
    await db.insert(memoriesTable)
      .values([
        {
          user_id: user.id,
          embedding: new Array(128).fill(0).map((_, i) => 
            ['pizza', 'food', 'eat', 'like', 'preferences'].some(word => {
              let hash = 0;
              for (let j = 0; j < word.length; j++) {
                hash = ((hash << 5) - hash + word.charCodeAt(j)) & 0xffffffff;
              }
              return Math.abs(hash) % 128 === i;
            }) ? 0.3 : 0.05
          ),
          memory_type: 'episodic' as const,
          summary: 'User likes pizza and food preferences eating',
          full_text: 'The user mentioned loving pizza and likes to eat Italian food preferences.',
          details: { keywords: ['pizza', 'food', 'eat', 'preferences'], emotion: 'positive' },
          confidence_score: 0.95
        },
        {
          user_id: user.id,
          embedding: new Array(128).fill(0).map((_, i) => 
            ['pizza', 'eat', 'like'].some(word => {
              let hash = 0;
              for (let j = 0; j < word.length; j++) {
                hash = ((hash << 5) - hash + word.charCodeAt(j)) & 0xffffffff;
              }
              return Math.abs(hash) % 128 === i;
            }) ? 0.25 : 0.03
          ),
          memory_type: 'semantic' as const,
          summary: 'Food preferences and eating habits',
          full_text: 'User has specific food preferences and likes to eat certain things.',
          details: { keywords: ['food', 'preferences', 'eat'], category: 'food' },
          confidence_score: 0.9
        }
      ])
      .execute();

    const input = {
      ...baseInput,
      userId: user.id,
      sessionId: session.id,
      userMessage: 'What do I like to eat? Pizza food preferences?'
    };

    const result = await generateResponse(input);

    // Should have moderate to high confidence due to multiple relevant memories
    expect(result.confidence).toBeGreaterThan(0.25);
    expect(result.relevantMemories.length).toBeGreaterThan(0);
  });

  it('should handle conversation history context', async () => {
    // Create user
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create chat session
    const [session] = await db.insert(chatSessionsTable)
      .values({ ...testSession, user_id: user.id })
      .returning()
      .execute();

    // Create memories
    await db.insert(memoriesTable)
      .values(testMemories.map(memory => ({ ...memory, user_id: user.id })))
      .execute();

    const input = {
      ...baseInput,
      userId: user.id,
      sessionId: session.id,
      conversationHistory: [
        {
          role: 'user' as const,
          content: 'I was talking about Italian restaurants earlier',
          timestamp: new Date(Date.now() - 1200000)
        },
        {
          role: 'assistant' as const,
          content: 'Yes, you mentioned liking pizza',
          timestamp: new Date(Date.now() - 900000)
        },
        {
          role: 'user' as const,
          content: 'What was that restaurant name?',
          timestamp: new Date(Date.now() - 600000)
        }
      ]
    };

    const result = await generateResponse(input);

    // Should use conversation context to find relevant memories
    expect(result.relevantMemories.length).toBeGreaterThan(0);
    expect(result.content.toLowerCase()).toMatch(/pizza|italian/);
  });

  it('should limit number of relevant memories returned', async () => {
    // Create user
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create chat session
    const [session] = await db.insert(chatSessionsTable)
      .values({ ...testSession, user_id: user.id })
      .returning()
      .execute();

    // Create many memories with similar content
    const manyMemories = Array.from({ length: 10 }, (_, i) => ({
      user_id: user.id,
      embedding: new Array(128).fill(0.1),
      memory_type: 'episodic' as const,
      summary: `Memory ${i} about food preferences`,
      full_text: `User mentioned food preference number ${i}`,
      details: { index: i },
      confidence_score: 0.8
    }));

    await db.insert(memoriesTable)
      .values(manyMemories)
      .execute();

    const input = {
      ...baseInput,
      userId: user.id,
      sessionId: session.id,
      userMessage: 'Tell me about food'
    };

    const result = await generateResponse(input);

    // Should limit to max 5 relevant memories
    expect(result.relevantMemories.length).toBeLessThanOrEqual(5);
  });
});