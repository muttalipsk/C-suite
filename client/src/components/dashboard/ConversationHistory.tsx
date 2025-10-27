
import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Clock, ChevronRight, Save, ChevronDown, ChevronUp } from "lucide-react";
import { AI_AGENTS } from "@shared/schema";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface SavedRecommendation {
  id: number;
  agent: string;
  content: string;
  createdAt: string;
  runId?: string;
}

interface ConversationHistoryProps {
  onSelectConversation?: (runId: string, agentKey: string) => void;
  onLoadChat?: (runId: string, agentKey: string, recommendation: string) => void;
  selectedConversation?: { runId: string; agentKey: string } | null;
}

interface GroupedConversations {
  [agentKey: string]: SavedRecommendation[];
}

export function ConversationHistory({ onSelectConversation, onLoadChat, selectedConversation }: ConversationHistoryProps) {
  const [savedRecommendations, setSavedRecommendations] = useState<SavedRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());

  const loadSavedRecommendations = async () => {
    try {
      const response = await fetch("/api/agent-memory");
      if (response.ok) {
        const data = await response.json();
        setSavedRecommendations(data.memories || []);
      }
    } catch (error) {
      console.error("Failed to load saved recommendations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSavedRecommendations();

    // Listen for new saves
    const handleSave = () => {
      loadSavedRecommendations();
    };

    window.addEventListener('recommendation-saved', handleSave);
    return () => window.removeEventListener('recommendation-saved', handleSave);
  }, []);

  // Group conversations by agent
  const groupedConversations: GroupedConversations = savedRecommendations.reduce((acc, rec) => {
    if (!acc[rec.agent]) {
      acc[rec.agent] = [];
    }
    acc[rec.agent].push(rec);
    return acc;
  }, {} as GroupedConversations);

  // Sort each agent's conversations by date (most recent first)
  Object.keys(groupedConversations).forEach(agentKey => {
    groupedConversations[agentKey].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  });

  const toggleAgent = (agentKey: string) => {
    setExpandedAgents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(agentKey)) {
        newSet.delete(agentKey);
      } else {
        newSet.add(agentKey);
      }
      return newSet;
    });
  };

  return (
    <div className="w-80 border-l bg-sidebar h-screen flex flex-col">
      <div className="p-6 border-b">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          Recent Conversations
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Chat history by agent</p>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-8 text-center">
            <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50 animate-pulse" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        ) : savedRecommendations.length === 0 ? (
          <div className="p-8 text-center">
            <Save className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-sm text-muted-foreground">
              No saved recommendations yet. Save recommendations to view them here.
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {Object.entries(groupedConversations).map(([agentKey, conversations]) => {
              const agent = AI_AGENTS[agentKey as keyof typeof AI_AGENTS];
              if (!agent) return null;

              const isExpanded = expandedAgents.has(agentKey);
              const conversationCount = conversations.length;

              return (
                <Collapsible
                  key={agentKey}
                  open={isExpanded}
                  onOpenChange={() => toggleAgent(agentKey)}
                >
                  <div className="border rounded-lg bg-card">
                    {/* Agent Header */}
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full p-3 h-auto rounded-lg justify-start hover:bg-accent"
                        data-testid={`agent-group-${agentKey}`}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <Avatar className="w-10 h-10 shrink-0">
                            <AvatarImage 
                              src={agent.avatar} 
                              alt={agent.name}
                              className="object-cover"
                            />
                            <AvatarFallback>{agent.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0 text-left">
                            <p className="font-medium text-sm">{agent.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {conversationCount} {conversationCount === 1 ? 'conversation' : 'conversations'}
                            </p>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 shrink-0" />
                          )}
                        </div>
                      </Button>
                    </CollapsibleTrigger>

                    {/* Conversations List */}
                    <CollapsibleContent>
                      <div className="border-t">
                        {conversations.map((saved, index) => {
                          const runId = saved.runId || saved.id.toString();
                          const isSelected = selectedConversation?.runId === runId && selectedConversation?.agentKey === agentKey;

                          return (
                            <Button
                              key={saved.id}
                              variant="ghost"
                              className={`w-full p-3 h-auto rounded-none justify-start text-left ${
                                isSelected ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-accent'
                              } ${index !== 0 ? 'border-t' : ''}`}
                              onClick={() => {
                                if (onSelectConversation) {
                                  onSelectConversation(runId, agentKey);
                                } else if (onLoadChat) {
                                  onLoadChat(runId, agentKey, saved.content);
                                }
                              }}
                              data-testid={`saved-${saved.id}`}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                  {saved.content.substring(0, 80)}...
                                </p>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(saved.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </Button>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
