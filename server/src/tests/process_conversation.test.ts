import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, memoriesTable, chatSessionsTable } from '../db/schema';
import { processConversation, type ProcessConversationInput } from '../handlers/process_conversation';
import { eq, and } from 'drizzle-orm';

// Test data
const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  password_hash: 'hashedpassword123'
};

const testChatSession = {
  title: 'Test Conversation Session'
};

describe('processConversation', () => {
  let userId: number;
  let sessionId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    userId = userResult[0].id;

    // Create test chat session
    const sessionResult = await db.insert(chatSessionsTable)
      .values({
        user_id: userId,
        ...testChatSession
      })
      .returning()
      .execute();
    sessionId = sessionResult[0].id;
  });

  afterEach(resetDB);

  it('should process semantic memories from preferences', async () => {
    const input: ProcessConversationInput = {
      userId,
      sessionId,
      messages: [
        {
          role: 'user',
          content: 'I love playing guitar and I prefer acoustic over electric. My favorite genre is folk music.',
          timestamp: new Date()
        },
        {
          role: 'assistant',
          content: 'That sounds wonderful! Folk music has such rich storytelling.',
          timestamp: new Date()
        }
      ]
    };

    const memories = await processConversation(input);

    // Should extract semantic memories about preferences
    expect(memories.length).toBeGreaterThan(0);
    
    const semanticMemories = memories.filter(m => m.memory_type === 'semantic');
    expect(semanticMemories.length).toBeGreaterThan(0);
    
    // Check that preferences are captured
    const guitarMemory = semanticMemories.find(m => 
      m.summary.toLowerCase().includes('guitar') || m.summary.toLowerCase().includes('prefer')
    );
    expect(guitarMemory).toBeDefined();
    expect(guitarMemory?.user_id).toBe(userId);
    expect(typeof guitarMemory?.confidence_score).toBe('number');
    expect(guitarMemory?.details).toEqual({
      session_id: sessionId,
      extracted_at: expect.any(String),
      confidence_reason: 'pattern_match',
      source: 'conversation'
    });
  });

  it('should process episodic memories from events', async () => {
    const input: ProcessConversationInput = {
      userId,
      sessionId,
      messages: [
        {
          role: 'user',
          content: 'Yesterday I went to the concert hall and saw an amazing performance. Last week I also visited the art museum.',
          timestamp: new Date()
        }
      ]
    };

    const memories = await processConversation(input);

    const episodicMemories = memories.filter(m => m.memory_type === 'episodic');
    expect(episodicMemories.length).toBeGreaterThan(0);

    const concertMemory = episodicMemories.find(m => 
      m.summary.toLowerCase().includes('yesterday') || m.summary.toLowerCase().includes('concert')
    );
    expect(concertMemory).toBeDefined();
    expect(concertMemory?.memory_type).toBe('episodic');
  });

  it('should process procedural memories from routines', async () => {
    const input: ProcessConversationInput = {
      userId,
      sessionId,
      messages: [
        {
          role: 'user',
          content: 'My routine is to wake up early, then I usually have coffee and read the news. The way I prepare coffee is first grinding the beans.',
          timestamp: new Date()
        }
      ]
    };

    const memories = await processConversation(input);

    const proceduralMemories = memories.filter(m => m.memory_type === 'procedural');
    expect(proceduralMemories.length).toBeGreaterThan(0);

    const routineMemory = proceduralMemories.find(m => 
      m.summary.toLowerCase().includes('routine') || m.summary.toLowerCase().includes('usually')
    );
    expect(routineMemory).toBeDefined();
    expect(routineMemory?.memory_type).toBe('procedural');
  });

  it('should process emotional memories from feelings', async () => {
    const input: ProcessConversationInput = {
      userId,
      sessionId,
      messages: [
        {
          role: 'user',
          content: 'I feel really excited about the upcoming trip. The news made me worried about the weather though.',
          timestamp: new Date()
        }
      ]
    };

    const memories = await processConversation(input);

    const emotionalMemories = memories.filter(m => m.memory_type === 'emotional');
    expect(emotionalMemories.length).toBeGreaterThan(0);

    const feelingMemory = emotionalMemories.find(m => 
      m.summary.toLowerCase().includes('feel') || m.summary.toLowerCase().includes('excited')
    );
    expect(feelingMemory).toBeDefined();
    expect(feelingMemory?.memory_type).toBe('emotional');
  });

  it('should process value-principle memories from beliefs', async () => {
    const input: ProcessConversationInput = {
      userId,
      sessionId,
      messages: [
        {
          role: 'user',
          content: 'I believe in treating everyone with respect. It\'s important to be honest and what matters to me is family.',
          timestamp: new Date()
        }
      ]
    };

    const memories = await processConversation(input);

    const valueMemories = memories.filter(m => m.memory_type === 'value-principle');
    expect(valueMemories.length).toBeGreaterThan(0);

    const beliefMemory = valueMemories.find(m => 
      m.summary.toLowerCase().includes('believe') || m.summary.toLowerCase().includes('important')
    );
    expect(beliefMemory).toBeDefined();
    expect(beliefMemory?.memory_type).toBe('value-principle');
  });

  it('should ignore assistant messages', async () => {
    const input: ProcessConversationInput = {
      userId,
      sessionId,
      messages: [
        {
          role: 'assistant',
          content: 'I love helping users with their questions and I believe in being helpful.',
          timestamp: new Date()
        }
      ]
    };

    const memories = await processConversation(input);

    // Should not create memories from assistant messages
    expect(memories.length).toBe(0);
  });

  it('should return empty array for no user messages', async () => {
    const input: ProcessConversationInput = {
      userId,
      sessionId,
      messages: []
    };

    const memories = await processConversation(input);
    expect(memories).toEqual([]);
  });

  it('should avoid creating duplicate memories', async () => {
    const input: ProcessConversationInput = {
      userId,
      sessionId,
      messages: [
        {
          role: 'user',
          content: 'I love playing guitar music every evening.',
          timestamp: new Date()
        }
      ]
    };

    // Process the same conversation twice
    const firstBatch = await processConversation(input);
    const secondBatch = await processConversation(input);

    expect(firstBatch.length).toBeGreaterThan(0);
    // Second batch should be empty or smaller due to duplicate detection
    expect(secondBatch.length).toBeLessThanOrEqual(firstBatch.length);
    
    // Check database to ensure no duplicates
    const allMemories = await db.select()
      .from(memoriesTable)
      .where(eq(memoriesTable.user_id, userId))
      .execute();

    // Should not have created many duplicate memories
    expect(allMemories.length).toBeLessThan(firstBatch.length * 2);
  });

  it('should store proper memory details and metadata', async () => {
    const input: ProcessConversationInput = {
      userId,
      sessionId,
      messages: [
        {
          role: 'user',
          content: 'I prefer working in quiet environments because it helps me focus better.',
          timestamp: new Date()
        }
      ]
    };

    const memories = await processConversation(input);
    
    expect(memories.length).toBeGreaterThan(0);
    
    const memory = memories[0];
    expect(memory.user_id).toBe(userId);
    expect(memory.embedding).toBeInstanceOf(Array);
    expect(memory.embedding.length).toBe(128); // Should have 128-dimensional embedding
    expect(typeof memory.confidence_score).toBe('number');
    expect(memory.confidence_score).toBeGreaterThanOrEqual(0);
    expect(memory.confidence_score).toBeLessThanOrEqual(1);
    expect(memory.summary).toBeTruthy();
    expect(memory.full_text).toBeTruthy();
    expect(memory.details).toEqual({
      session_id: sessionId,
      extracted_at: expect.any(String),
      confidence_reason: 'pattern_match',
      source: 'conversation'
    });
    expect(memory.created_at).toBeInstanceOf(Date);
  });

  it('should handle multiple memory types in single conversation', async () => {
    const input: ProcessConversationInput = {
      userId,
      sessionId,
      messages: [
        {
          role: 'user',
          content: 'Yesterday I went hiking and I felt amazing. I believe in staying active and my routine is to exercise daily. I prefer outdoor activities.',
          timestamp: new Date()
        }
      ]
    };

    const memories = await processConversation(input);
    
    // Should extract multiple types of memories
    expect(memories.length).toBeGreaterThan(1);
    
    const memoryTypes = memories.map(m => m.memory_type);
    const uniqueTypes = [...new Set(memoryTypes)];
    
    // Should have extracted multiple different memory types
    expect(uniqueTypes.length).toBeGreaterThan(1);
    expect(uniqueTypes).toContain('episodic'); // "yesterday I went"
    expect(uniqueTypes).toContain('semantic'); // "I prefer"
  });

  it('should persist memories to database correctly', async () => {
    const input: ProcessConversationInput = {
      userId,
      sessionId,
      messages: [
        {
          role: 'user',
          content: 'I enjoy reading science fiction novels in my spare time.',
          timestamp: new Date()
        }
      ]
    };

    const memories = await processConversation(input);
    expect(memories.length).toBeGreaterThan(0);
    
    // Verify memories are actually in the database
    const dbMemories = await db.select()
      .from(memoriesTable)
      .where(eq(memoriesTable.user_id, userId))
      .execute();

    expect(dbMemories.length).toBe(memories.length);
    
    const dbMemory = dbMemories[0];
    expect(dbMemory.user_id).toBe(userId);
    expect(parseFloat(dbMemory.confidence_score?.toString() || '0')).toBeGreaterThan(0);
    expect(dbMemory.embedding).toBeInstanceOf(Array);
    expect(dbMemory.created_at).toBeInstanceOf(Date);
  });
});