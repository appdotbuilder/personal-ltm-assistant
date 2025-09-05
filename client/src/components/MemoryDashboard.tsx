import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/utils/trpc';
import { useState, useEffect, useCallback } from 'react';
import { Search, Brain, Calendar, Star, Trash2, Eye, BarChart3, TrendingUp, Database, Lightbulb, Heart, Target, Cog, Clock } from 'lucide-react';
import type { User, Memory, MemoryType, MemoryStats, SearchMemoriesInput } from '../../../server/src/schema';
import { DemoMemoryData } from '@/components/DemoMemoryData';

interface MemoryDashboardProps {
  user: User;
}

// Memory type configurations
const MEMORY_TYPE_CONFIG: Record<MemoryType, { 
  icon: React.ReactNode; 
  label: string; 
  color: string; 
  description: string; 
}> = {
  episodic: { 
    icon: <Calendar className="h-4 w-4" />, 
    label: 'Episodic', 
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    description: 'Specific events and experiences'
  },
  semantic: { 
    icon: <Lightbulb className="h-4 w-4" />, 
    label: 'Semantic', 
    color: 'bg-green-100 text-green-700 border-green-200',
    description: 'General facts and knowledge'
  },
  procedural: { 
    icon: <Cog className="h-4 w-4" />, 
    label: 'Procedural', 
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    description: 'Routines and behaviors'
  },
  emotional: { 
    icon: <Heart className="h-4 w-4" />, 
    label: 'Emotional', 
    color: 'bg-pink-100 text-pink-700 border-pink-200',
    description: 'Feelings and emotional states'
  },
  'value-principle': { 
    icon: <Target className="h-4 w-4" />, 
    label: 'Values & Principles', 
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    description: 'Core beliefs and values'
  }
};

export function MemoryDashboard({ user }: MemoryDashboardProps) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [filteredMemories, setFilteredMemories] = useState<Memory[]>([]);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<MemoryType | 'all'>('all');
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [showDemo, setShowDemo] = useState(false);

  // Load memories and stats
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [memoriesData, statsData] = await Promise.all([
        trpc.getMemories.query({ userId: user.id }),
        trpc.getMemoryStats.query({ user_id: user.id })
      ]);
      
      setMemories(memoriesData);
      setFilteredMemories(memoriesData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load memory data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user.id]);

  // Initialize data
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter memories based on search and type
  useEffect(() => {
    let filtered = memories;

    // Filter by type
    if (selectedType !== 'all') {
      filtered = filtered.filter((memory: Memory) => memory.memory_type === selectedType);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((memory: Memory) =>
        memory.summary.toLowerCase().includes(query) ||
        memory.full_text.toLowerCase().includes(query)
      );
    }

    setFilteredMemories(filtered);
  }, [memories, selectedType, searchQuery]);

  // Advanced search functionality
  const handleAdvancedSearch = async () => {
    if (!searchQuery.trim()) {
      setFilteredMemories(memories);
      return;
    }

    try {
      setIsLoading(true);
      const searchResults = await trpc.searchMemories.query({
        user_id: user.id,
        query: searchQuery,
        memory_type: selectedType === 'all' ? undefined : selectedType,
        limit: 50
      } as SearchMemoriesInput);

      setFilteredMemories(searchResults);
    } catch (error) {
      console.error('Search failed:', error);
      setFilteredMemories([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete memory
  const deleteMemory = async (memoryId: number) => {
    try {
      await trpc.deleteMemory.mutate({ memoryId, userId: user.id });
      setMemories((prev: Memory[]) => prev.filter((m: Memory) => m.id !== memoryId));
      setSelectedMemory(null);
    } catch (error) {
      console.error('Failed to delete memory:', error);
    }
  };



  return (
    <div className="space-y-6">
      {/* Memory Statistics Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Memories</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_memories}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Memories</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recent_memories}</div>
              <p className="text-xs text-muted-foreground">Last 7 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Confidence</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.avg_confidence_score ? `${(stats.avg_confidence_score * 100).toFixed(1)}%` : 'N/A'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Memory Types</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Object.keys(stats.memories_by_type).length}</div>
              <p className="text-xs text-muted-foreground">Different categories</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Memory Type Distribution */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-violet-600" />
              <span>Memory Distribution</span>
            </CardTitle>
            <CardDescription>Breakdown of your memories by type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(stats.memories_by_type).map(([type, count]) => {
                const config = MEMORY_TYPE_CONFIG[type as MemoryType];
                const percentage = stats.total_memories > 0 ? (count / stats.total_memories) * 100 : 0;
                
                return (
                  <div key={type} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {config.icon}
                        <span className="font-medium">{config.label}</span>
                        <span className="text-sm text-gray-500">({count})</span>
                      </div>
                      <span className="text-sm font-medium">{percentage.toFixed(1)}%</span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Filter Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Search className="h-5 w-5 text-blue-600" />
            <span>Memory Search & Filter</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
            <div className="flex-1">
              <Input
                placeholder="Search memories..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={selectedType} onValueChange={(value: MemoryType | 'all') => setSelectedType(value)}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Memory type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(MEMORY_TYPE_CONFIG).map(([type, config]) => (
                  <SelectItem key={type} value={type}>
                    <div className="flex items-center space-x-2">
                      {config.icon}
                      <span>{config.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAdvancedSearch} disabled={isLoading}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Memory List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Brain className="h-5 w-5 text-violet-600" />
              <span>Your Memories</span>
              <Badge variant="secondary">{filteredMemories.length}</Badge>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading memories...</p>
            </div>
          ) : filteredMemories.length === 0 ? (
            <div className="space-y-4">
              <Alert>
                <Brain className="h-4 w-4" />
                <AlertDescription>
                  {memories.length === 0 
                    ? "No memories stored yet. Your memory system will populate as you chat with the assistant!"
                    : "No memories match your search criteria."
                  }
                </AlertDescription>
              </Alert>
              
              {/* Show placeholder/demo memories when backend is not fully implemented */}
              {memories.length === 0 && (
                <div className="mt-6">
                  <h4 className="font-medium text-gray-700 mb-4">💡 Example Memory Types</h4>
                  <div className="grid gap-3">
                    {Object.entries(MEMORY_TYPE_CONFIG).map(([type, config]) => (
                      <div key={type} className="p-3 border rounded-lg bg-gray-50">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge className={`${config.color} border`}>
                            {config.icon}
                            <span className="ml-1">{config.label}</span>
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">{config.description}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-4 bg-blue-100 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-blue-800 mb-2">
                          <strong>🚀 Getting Started:</strong> Switch to the Chat Interface tab and start a conversation.
                        </p>
                        <p className="text-xs text-blue-600">
                          Your assistant will automatically identify and store important information from your interactions.
                        </p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setShowDemo(true)}
                        className="border-blue-300 text-blue-700 hover:bg-blue-100"
                      >
                        View Demo
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-4">
                {filteredMemories.map((memory: Memory) => {
                  const config = MEMORY_TYPE_CONFIG[memory.memory_type];
                  
                  return (
                    <Card key={memory.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between space-x-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center space-x-2">
                              <Badge className={`${config.color} border`}>
                                {config.icon}
                                <span className="ml-1">{config.label}</span>
                              </Badge>
                              {memory.confidence_score && (
                                <div className="flex items-center space-x-1">
                                  <Star className="h-3 w-3 text-yellow-500" />
                                  <span className="text-xs">
                                    {(memory.confidence_score * 100).toFixed(0)}%
                                  </span>
                                </div>
                              )}
                            </div>
                            
                            <h3 className="font-medium leading-relaxed">
                              {memory.summary}
                            </h3>
                            
                            <p className="text-sm text-gray-600 line-clamp-2">
                              {memory.full_text}
                            </p>
                            
                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                              <span>Created: {memory.created_at.toLocaleDateString()}</span>
                              <span>Updated: {memory.updated_at.toLocaleDateString()}</span>
                            </div>
                          </div>
                          
                          <div className="flex flex-col space-y-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedMemory(memory)}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => deleteMemory(memory.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Memory Detail Modal */}
      {selectedMemory && (
        <Card className="fixed inset-4 z-50 bg-white shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Brain className="h-5 w-5" />
              <span>Memory Details</span>
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedMemory(null)}
            >
              Close
            </Button>
          </CardHeader>
          <CardContent className="overflow-auto max-h-[70vh]">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Badge className={`${MEMORY_TYPE_CONFIG[selectedMemory.memory_type].color} border`}>
                  {MEMORY_TYPE_CONFIG[selectedMemory.memory_type].icon}
                  <span className="ml-1">{MEMORY_TYPE_CONFIG[selectedMemory.memory_type].label}</span>
                </Badge>
                {selectedMemory.confidence_score && (
                  <Badge variant="secondary">
                    <Star className="h-3 w-3 mr-1" />
                    Confidence: {(selectedMemory.confidence_score * 100).toFixed(1)}%
                  </Badge>
                )}
              </div>

              <div>
                <h3 className="font-semibold mb-2">Summary</h3>
                <p className="text-gray-700">{selectedMemory.summary}</p>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold mb-2">Full Content</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{selectedMemory.full_text}</p>
              </div>

              {selectedMemory.details && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold mb-2">Additional Details</h3>
                    <pre className="bg-gray-50 p-3 rounded-md text-sm overflow-auto">
                      {JSON.stringify(selectedMemory.details, null, 2)}
                    </pre>
                  </div>
                </>
              )}

              <Separator />

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Created:</span>
                  <p className="text-gray-600">{selectedMemory.created_at.toLocaleString()}</p>
                </div>
                <div>
                  <span className="font-medium">Last Updated:</span>
                  <p className="text-gray-600">{selectedMemory.updated_at.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Demo Memory Data Modal */}
      {showDemo && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold">Demo: How Your Memory System Works</h2>
              <Button variant="outline" onClick={() => setShowDemo(false)}>
                Close Demo
              </Button>
            </div>
            <div className="p-6 overflow-auto max-h-[calc(90vh-120px)]">
              <DemoMemoryData />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}