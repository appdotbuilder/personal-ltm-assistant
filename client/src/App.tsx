import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useState, useCallback } from 'react';
import type { User } from '../../server/src/schema';
import { AuthForm } from '@/components/AuthForm';
import { ChatInterface } from '@/components/ChatInterface';
import { MemoryDashboard } from '@/components/MemoryDashboard';
import { Brain, MessageCircle, Database, LogOut, Sparkles } from 'lucide-react';
import './App.css';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('chat');

  const handleLogin = useCallback((loggedInUser: User) => {
    setUser(loggedInUser);
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    setActiveTab('chat');
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-100 via-white to-blue-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <div className="relative">
                <Brain className="h-12 w-12 text-violet-600" />
                <Sparkles className="h-6 w-6 text-blue-500 absolute -top-2 -right-2" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Personal Assistant</h1>
            <p className="text-gray-600">Your intelligent companion with long-term memory</p>
          </div>
          <AuthForm onLogin={handleLogin} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-100 via-white to-blue-100">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Brain className="h-8 w-8 text-violet-600" />
                <Sparkles className="h-4 w-4 text-blue-500 absolute -top-1 -right-1" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Personal Assistant</h1>
                <p className="text-sm text-gray-600">Welcome back, {user.username}!</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Badge variant="secondary" className="bg-violet-100 text-violet-700">
                <Brain className="h-3 w-3 mr-1" />
                LTM Enabled
              </Badge>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="chat" className="flex items-center space-x-2">
              <MessageCircle className="h-4 w-4" />
              <span>Chat Interface</span>
            </TabsTrigger>
            <TabsTrigger value="memory" className="flex items-center space-x-2">
              <Database className="h-4 w-4" />
              <span>Memory Dashboard</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MessageCircle className="h-5 w-5 text-blue-600" />
                  <span>Conversation</span>
                </CardTitle>
                <CardDescription>
                  Chat with your personal assistant. All interactions are automatically processed to enhance your long-term memory.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChatInterface user={user} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="memory" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Database className="h-5 w-5 text-violet-600" />
                  <span>Memory System</span>
                </CardTitle>
                <CardDescription>
                  Explore and manage your long-term memories. View insights, search through stored information, and understand how your assistant learns about you.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MemoryDashboard user={user} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default App;