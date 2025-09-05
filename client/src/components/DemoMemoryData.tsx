import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Lightbulb, Cog, Heart, Target, Star, Clock } from 'lucide-react';
import type { MemoryType } from '../../../server/src/schema';

// Demo memory data to show how the system would work
export const DEMO_MEMORIES = [
  {
    id: 1,
    user_id: 1,
    embedding: [0.1, 0.2, 0.3],
    memory_type: 'episodic' as MemoryType,
    summary: 'User mentioned they had a great vacation in Italy last summer',
    full_text: 'Last summer I went to Italy with my family. We visited Rome, Florence, and Venice. The food was amazing, especially the pasta in Rome. We stayed for two weeks and had perfect weather.',
    details: { keywords: ['Italy', 'vacation', 'family', 'Rome', 'Florence', 'Venice'], emotion: 'positive', duration: '2 weeks' },
    confidence_score: 0.92,
    created_at: new Date('2024-01-15'),
    updated_at: new Date('2024-01-15')
  },
  {
    id: 2,
    user_id: 1,
    embedding: [0.4, 0.5, 0.6],
    memory_type: 'semantic' as MemoryType,
    summary: 'User prefers vegetarian food and is health-conscious',
    full_text: 'I try to eat mostly vegetarian meals because I care about animal welfare and my health. I avoid processed foods and prefer fresh, organic ingredients when possible.',
    details: { preferences: ['vegetarian', 'organic', 'fresh'], avoided: ['processed foods', 'meat'] },
    confidence_score: 0.88,
    created_at: new Date('2024-01-20'),
    updated_at: new Date('2024-01-20')
  },
  {
    id: 3,
    user_id: 1,
    embedding: [0.7, 0.8, 0.9],
    memory_type: 'procedural' as MemoryType,
    summary: 'User follows a morning routine of meditation and exercise',
    full_text: 'Every morning I start with 10 minutes of meditation, followed by a 30-minute workout. This routine helps me stay focused and energized throughout the day.',
    details: { routine: ['meditation', 'exercise'], timing: 'morning', duration: '40 minutes total' },
    confidence_score: 0.85,
    created_at: new Date('2024-01-25'),
    updated_at: new Date('2024-01-25')
  },
  {
    id: 4,
    user_id: 1,
    embedding: [0.2, 0.4, 0.8],
    memory_type: 'emotional' as MemoryType,
    summary: 'User felt anxious about job interview but ultimately successful',
    full_text: 'I was really nervous about the job interview last week. My heart was racing and I couldn\'t sleep the night before. But it went well and I got the position! I felt so relieved and excited.',
    details: { emotions: ['anxiety', 'nervousness', 'relief', 'excitement'], outcome: 'positive', context: 'job interview' },
    confidence_score: 0.95,
    created_at: new Date('2024-01-30'),
    updated_at: new Date('2024-01-30')
  },
  {
    id: 5,
    user_id: 1,
    embedding: [0.3, 0.6, 0.7],
    memory_type: 'value-principle' as MemoryType,
    summary: 'User values work-life balance and family time',
    full_text: 'For me, work-life balance is crucial. No amount of money is worth sacrificing time with my family. I believe in working hard but also making sure to be present for the important moments in life.',
    details: { values: ['work-life balance', 'family', 'presence'], priorities: 'family over money' },
    confidence_score: 0.90,
    created_at: new Date('2024-02-01'),
    updated_at: new Date('2024-02-01')
  }
];

// Demo memory statistics
export const DEMO_STATS = {
  total_memories: 5,
  memories_by_type: {
    episodic: 1,
    semantic: 1,
    procedural: 1,
    emotional: 1,
    'value-principle': 1
  },
  recent_memories: 3,
  avg_confidence_score: 0.90
};

// Memory type configurations
const MEMORY_TYPE_CONFIG: Record<MemoryType, { 
  icon: React.ReactNode; 
  label: string; 
  color: string; 
}> = {
  episodic: { 
    icon: <Calendar className="h-4 w-4" />, 
    label: 'Episodic', 
    color: 'bg-blue-100 text-blue-700 border-blue-200'
  },
  semantic: { 
    icon: <Lightbulb className="h-4 w-4" />, 
    label: 'Semantic', 
    color: 'bg-green-100 text-green-700 border-green-200'
  },
  procedural: { 
    icon: <Cog className="h-4 w-4" />, 
    label: 'Procedural', 
    color: 'bg-orange-100 text-orange-700 border-orange-200'
  },
  emotional: { 
    icon: <Heart className="h-4 w-4" />, 
    label: 'Emotional', 
    color: 'bg-pink-100 text-pink-700 border-pink-200'
  },
  'value-principle': { 
    icon: <Target className="h-4 w-4" />, 
    label: 'Values & Principles', 
    color: 'bg-purple-100 text-purple-700 border-purple-200'
  }
};

export function DemoMemoryData() {
  return (
    <div className="space-y-6">
      <Card className="border-2 border-dashed border-blue-200 bg-blue-100/50">
        <CardHeader>
          <CardTitle className="text-blue-800">🎯 Demo Memory System</CardTitle>
          <CardDescription className="text-blue-700">
            This shows example memories that would be automatically created from your conversations.
            The actual system will learn from your real interactions!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {DEMO_MEMORIES.map((memory) => {
              const config = MEMORY_TYPE_CONFIG[memory.memory_type];
              
              return (
                <Card key={memory.id} className="bg-white/80">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between space-x-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center space-x-2">
                          <Badge className={`${config.color} border`}>
                            {config.icon}
                            <span className="ml-1">{config.label}</span>
                          </Badge>
                          <div className="flex items-center space-x-1">
                            <Star className="h-3 w-3 text-yellow-500" />
                            <span className="text-xs">
                              {(memory.confidence_score * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        
                        <h3 className="font-medium leading-relaxed">
                          {memory.summary}
                        </h3>
                        
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {memory.full_text}
                        </p>
                        
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span className="flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>{memory.created_at.toLocaleDateString()}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}