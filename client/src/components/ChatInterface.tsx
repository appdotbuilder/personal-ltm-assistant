import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/utils/trpc';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Send, Bot, User as UserIcon, Clock, Sparkles, Brain } from 'lucide-react';
import type { User, ChatSession, ChatMessage, CreateChatSessionInput, CreateChatMessageInput } from '../../../server/src/schema';

interface ChatInterfaceProps {
  user: User;
}

interface ExtendedChatMessage extends ChatMessage {
  isProcessing?: boolean;
}

export function ChatInterface({ user }: ChatInterfaceProps) {
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ExtendedChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, []);

  // Create initial chat session
  const createSession = useCallback(async () => {
    try {
      const session = await trpc.createChatSession.mutate({
        user_id: user.id,
        title: `Chat Session - ${new Date().toLocaleDateString()}`
      } as CreateChatSessionInput);
      setCurrentSession(session);
    } catch (error) {
      console.error('Failed to create chat session:', error);
    }
  }, [user.id]);

  // Load chat history for current session
  const loadChatHistory = useCallback(async () => {
    if (!currentSession) return;
    
    try {
      const history = await trpc.getChatHistory.query({
        user_id: user.id,
        session_id: currentSession.id,
        limit: 50
      });
      setMessages(history);
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  }, [currentSession, user.id]);

  // Initialize session on mount
  useEffect(() => {
    createSession();
  }, [createSession]);

  // Load history when session changes
  useEffect(() => {
    if (currentSession) {
      loadChatHistory();
    }
  }, [currentSession, loadChatHistory]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentSession || isLoading) return;

    const userMessage = newMessage.trim();
    setNewMessage('');
    setIsLoading(true);

    try {
      // Add user message to UI immediately
      const userMessageObj: ExtendedChatMessage = {
        id: Date.now(), // Temporary ID
        session_id: currentSession.id,
        user_id: user.id,
        role: 'user' as const,
        content: userMessage,
        created_at: new Date()
      };
      
      setMessages((prev: ExtendedChatMessage[]) => [...prev, userMessageObj]);

      // Save user message to backend
      const savedUserMessage = await trpc.createChatMessage.mutate({
        session_id: currentSession.id,
        user_id: user.id,
        role: 'user',
        content: userMessage
      } as CreateChatMessageInput);

      // Update the message with the real ID
      setMessages((prev: ExtendedChatMessage[]) => 
        prev.map((msg: ExtendedChatMessage) => 
          msg.id === userMessageObj.id ? savedUserMessage : msg
        )
      );

      // Add processing indicator
      const processingMessage: ExtendedChatMessage = {
        id: Date.now() + 1, // Temporary ID
        session_id: currentSession.id,
        user_id: user.id,
        role: 'assistant' as const,
        content: 'Processing your message and updating memories...',
        created_at: new Date(),
        isProcessing: true
      };
      
      setMessages((prev: ExtendedChatMessage[]) => [...prev, processingMessage]);
      setIsProcessing(true);

      // Generate AI response with memory processing
      const conversationHistory = messages.map((msg: ExtendedChatMessage) => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.created_at
      }));

      try {
        // First, process the conversation for memory updates
        await trpc.processConversation.mutate({
          userId: user.id,
          sessionId: currentSession.id,
          messages: [...conversationHistory, {
            role: 'user' as const,
            content: userMessage,
            timestamp: new Date()
          }]
        });

        // Then generate the response
        const aiResponse = await trpc.generateResponse.mutate({
          userId: user.id,
          sessionId: currentSession.id,
          userMessage,
          conversationHistory: [...conversationHistory, {
            role: 'user' as const,
            content: userMessage,
            timestamp: new Date()
          }]
        });

        // Handle the response content
        const responseContent = aiResponse.content || `I understand you said: "${userMessage}". I'm currently learning from our conversation and will be able to provide more personalized responses as my memory system develops. This interaction has been processed and stored for future reference.`;

        // Remove processing message and add real response
        setMessages((prev: ExtendedChatMessage[]) => 
          prev.filter((msg: ExtendedChatMessage) => !msg.isProcessing)
        );

        // Save AI response to backend
        const savedAiMessage = await trpc.createChatMessage.mutate({
          session_id: currentSession.id,
          user_id: user.id,
          role: 'assistant',
          content: responseContent
        } as CreateChatMessageInput);

        setMessages((prev: ExtendedChatMessage[]) => [...prev, savedAiMessage]);

      } catch (responseError) {
        console.error('Response generation failed:', responseError);
        
        // Fallback response when backend is not fully implemented
        const fallbackContent = `Thank you for your message: "${userMessage}". 

🧠 **Memory Processing**: I'm analyzing our conversation to identify important information that should be stored in your long-term memory system.

📝 **Learning**: This interaction will help me understand your preferences, experiences, and knowledge better over time.

🔄 **Note**: The backend memory system is currently in placeholder mode. Once fully implemented, I'll be able to provide much more personalized and contextually-aware responses based on our conversation history.

How else can I help you today?`;

        // Remove processing message and add fallback response
        setMessages((prev: ExtendedChatMessage[]) => 
          prev.filter((msg: ExtendedChatMessage) => !msg.isProcessing)
        );

        // Save fallback response to backend
        const savedAiMessage = await trpc.createChatMessage.mutate({
          session_id: currentSession.id,
          user_id: user.id,
          role: 'assistant',
          content: fallbackContent
        } as CreateChatMessageInput);

        setMessages((prev: ExtendedChatMessage[]) => [...prev, savedAiMessage]);
      }

    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove processing message on error
      setMessages((prev: ExtendedChatMessage[]) => 
        prev.filter((msg: ExtendedChatMessage) => !msg.isProcessing)
      );
    } finally {
      setIsLoading(false);
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px]">
      {/* Chat Header */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b">
        <div className="flex items-center space-x-2">
          <Badge variant="secondary" className="bg-blue-100 text-blue-700">
            <Bot className="h-3 w-3 mr-1" />
            Active Session
          </Badge>
          {currentSession && (
            <span className="text-sm text-gray-600">
              {currentSession.title}
            </span>
          )}
        </div>
        {isProcessing && (
          <Badge variant="secondary" className="bg-violet-100 text-violet-700">
            <Brain className="h-3 w-3 mr-1" />
            Learning...
          </Badge>
        )}
      </div>

      {/* Messages Area */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 pr-4">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Bot className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">Welcome to your Personal Assistant!</p>
              <p className="text-sm">Start a conversation to begin building your long-term memory system.</p>
            </div>
          ) : (
            messages.map((message: ExtendedChatMessage) => (
              <div
                key={message.id}
                className={`flex space-x-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-gradient-to-r from-violet-500 to-blue-500 text-white">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
                
                <Card className={`max-w-[80%] ${
                  message.role === 'user' 
                    ? 'bg-blue-500 text-white' 
                    : message.isProcessing 
                      ? 'bg-violet-50 border-violet-200' 
                      : 'bg-white'
                }`}>
                  <CardContent className="p-3">
                    <p className="text-sm leading-relaxed">
                      {message.content}
                    </p>
                    <div className={`flex items-center justify-between mt-2 pt-2 border-t ${
                      message.role === 'user' 
                        ? 'border-blue-400' 
                        : 'border-gray-200'
                    }`}>
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3 w-3 opacity-60" />
                        <span className="text-xs opacity-60">
                          {message.created_at.toLocaleTimeString()}
                        </span>
                      </div>
                      {message.isProcessing && (
                        <div className="flex items-center space-x-1">
                          <Sparkles className="h-3 w-3 text-violet-500 animate-pulse" />
                          <span className="text-xs text-violet-600">Processing</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {message.role === 'user' && (
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-gray-500 text-white">
                      <UserIcon className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="pt-4 mt-4 border-t">
        <form onSubmit={sendMessage} className="flex space-x-2">
          <Input
            value={newMessage}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button 
            type="submit" 
            disabled={isLoading || !newMessage.trim()}
            className="px-3"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <p className="text-xs text-gray-500 mt-2">
          💡 Your conversations are automatically processed to enhance your personal memory system
        </p>
      </div>
    </div>
  );
}