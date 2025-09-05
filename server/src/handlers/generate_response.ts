import { db } from '../db';
import { memoriesTable, chatMessagesTable, chatSessionsTable } from '../db/schema';
import { type Memory } from '../schema';
import { eq, desc, and, sql, SQL } from 'drizzle-orm';

// Input type for response generation
export interface GenerateResponseInput {
    userId: number;
    sessionId: number;
    userMessage: string;
    conversationHistory: Array<{
        role: 'user' | 'assistant';
        content: string;
        timestamp: Date;
    }>;
}

// Output type for generated response
export interface GeneratedResponse {
    content: string;
    relevantMemories: Memory[];
    confidence: number;
}

// Helper function to calculate cosine similarity between two vectors
const cosineSimilarity = (a: number[], b: number[]): number => {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

// Helper function to generate a simple embedding for demonstration
// In a real implementation, this would use a proper embedding model
const generateSimpleEmbedding = (text: string): number[] => {
    const words = text.toLowerCase().split(/\s+/);
    const embedding = new Array(128).fill(0);
    
    // Simple hash-based embedding for demonstration
    for (const word of words) {
        let hash = 0;
        for (let i = 0; i < word.length; i++) {
            hash = ((hash << 5) - hash + word.charCodeAt(i)) & 0xffffffff;
        }
        const index = Math.abs(hash) % 128;
        embedding[index] += 1;
        
        // Add some spread to adjacent indices for better similarity matching
        if (index > 0) embedding[index - 1] += 0.3;
        if (index < 127) embedding[index + 1] += 0.3;
    }
    
    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
        for (let i = 0; i < embedding.length; i++) {
            embedding[i] /= norm;
        }
    }
    
    return embedding;
};

// Helper function to extract keywords from text
const extractKeywords = (text: string): string[] => {
    const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with', 'to', 'for', 'of', 'as', 'by']);
    return text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.has(word))
        .slice(0, 10); // Limit to top 10 keywords
};

// Helper function to calculate memory relevance score
const calculateRelevanceScore = (memory: Memory, userEmbedding: number[], keywords: string[], conversationContext: string): number => {
    // Semantic similarity (40% weight)
    const semanticScore = cosineSimilarity(memory.embedding, userEmbedding);
    
    // Keyword matching (30% weight)
    const memoryText = (memory.summary + ' ' + memory.full_text).toLowerCase();
    const keywordMatches = keywords.filter(keyword => memoryText.includes(keyword)).length;
    const keywordScore = keywordMatches / Math.max(keywords.length, 1);
    
    // Context relevance (20% weight)
    const contextWords = conversationContext.toLowerCase().split(/\s+/);
    const contextMatches = contextWords.filter(word => word.length > 2 && memoryText.includes(word)).length;
    const contextScore = contextMatches / Math.max(contextWords.length, 1);
    
    // Memory confidence (10% weight)
    const confidenceScore = memory.confidence_score || 0.5;
    
    return (semanticScore * 0.4) + (keywordScore * 0.3) + (contextScore * 0.2) + (confidenceScore * 0.1);
};

// Helper function to generate response content based on memories
const generateResponseContent = (userMessage: string, relevantMemories: Memory[], conversationHistory: Array<{role: 'user' | 'assistant'; content: string; timestamp: Date}>): string => {
    if (relevantMemories.length === 0) {
        return "I understand your message, but I don't have specific memories that directly relate to this topic. Could you provide more context or ask me something else I might be able to help with based on our previous conversations?";
    }
    
    // Analyze memory types to tailor response
    const memoryTypes = relevantMemories.map(m => m.memory_type);
    const hasEpisodic = memoryTypes.includes('episodic');
    const hasSemantic = memoryTypes.includes('semantic');
    const hasEmotional = memoryTypes.includes('emotional');
    const hasValuePrinciple = memoryTypes.includes('value-principle');
    
    let responsePrefix = "";
    
    if (hasEpisodic) {
        responsePrefix = "Based on what we've discussed before, ";
    } else if (hasSemantic) {
        responsePrefix = "From what I know about this topic, ";
    } else if (hasEmotional) {
        responsePrefix = "Considering the emotional context, ";
    } else if (hasValuePrinciple) {
        responsePrefix = "Given your values and principles, ";
    }
    
    // Create a contextual response
    const memoryContext = relevantMemories
        .slice(0, 3) // Use top 3 most relevant memories
        .map(memory => memory.summary)
        .join(". ");
    
    const response = `${responsePrefix}I recall that ${memoryContext}. This seems relevant to your current question about "${userMessage}". Would you like me to elaborate on any specific aspect, or is there something particular you'd like to know more about?`;
    
    return response;
};

export const generateResponse = async (input: GenerateResponseInput): Promise<GeneratedResponse> => {
    try {
        // 1. Validate session exists and belongs to user
        const session = await db.select()
            .from(chatSessionsTable)
            .where(and(
                eq(chatSessionsTable.id, input.sessionId),
                eq(chatSessionsTable.user_id, input.userId)
            ))
            .limit(1)
            .execute();
        
        if (session.length === 0) {
            throw new Error('Chat session not found or access denied');
        }
        
        // 2. Generate embedding for user message
        const userEmbedding = generateSimpleEmbedding(input.userMessage);
        
        // 3. Extract keywords from user message
        const keywords = extractKeywords(input.userMessage);
        
        // 4. Build conversation context
        const conversationContext = input.conversationHistory
            .slice(-5) // Last 5 messages for context
            .map(msg => msg.content)
            .join(' ');
        
        // 5. Retrieve user's memories
        const memories = await db.select()
            .from(memoriesTable)
            .where(eq(memoriesTable.user_id, input.userId))
            .orderBy(desc(memoriesTable.updated_at))
            .limit(50) // Limit to recent memories for performance
            .execute();
        
        // 6. Calculate relevance scores and sort memories
        const memoriesWithScores = memories.map(memory => ({
            ...memory,
            embedding: memory.embedding as number[], // Type assertion for embedding array
            details: memory.details as Record<string, any> | null,
            relevanceScore: calculateRelevanceScore(
                { 
                    ...memory, 
                    embedding: memory.embedding as number[],
                    details: memory.details as Record<string, any> | null
                }, 
                userEmbedding, 
                keywords, 
                conversationContext
            )
        }));
        
        // Sort by relevance score descending
        memoriesWithScores.sort((a, b) => b.relevanceScore - a.relevanceScore);
        
        // 7. Select top relevant memories (threshold: > 0.1 relevance score)
        const relevantMemories = memoriesWithScores
            .filter(memory => memory.relevanceScore > 0.1)
            .slice(0, 5) // Top 5 most relevant
            .map(({ relevanceScore, ...memory }) => ({
                ...memory,
                details: memory.details as Record<string, any> | null
            })); // Remove relevanceScore from result and ensure proper typing
        
        // 8. Calculate overall confidence based on memory relevance and quantity
        const topRelevantMemories = memoriesWithScores.filter(m => m.relevanceScore > 0.1).slice(0, 5);
        const avgRelevanceScore = topRelevantMemories.length > 0 
            ? topRelevantMemories.reduce((sum, m) => sum + m.relevanceScore, 0) / topRelevantMemories.length
            : 0;
        
        const memoryQuantityFactor = Math.min(relevantMemories.length / 3, 1); // Scale based on number of relevant memories
        const confidence = Math.min((avgRelevanceScore * 0.8) + (memoryQuantityFactor * 0.2), 1);
        
        // 9. Generate response content
        const responseContent = generateResponseContent(input.userMessage, relevantMemories, input.conversationHistory);
        
        return {
            content: responseContent,
            relevantMemories: relevantMemories,
            confidence: parseFloat(confidence.toFixed(3))
        };
    } catch (error) {
        console.error('Response generation failed:', error);
        throw error;
    }
};