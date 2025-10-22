import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Clock, ChevronRight, Save } from "lucide-react";
import { AI_AGENTS } from "@shared/schema";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
}

export function ConversationHistory({ onSelectConversation, onLoadChat }: ConversationHistoryProps) {
  const [savedRecommendations, setSavedRecommendations] = useState<SavedRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  return (
    <div className="w-80 border-l bg-sidebar h-screen flex flex-col">
      <div className="p-6 border-b">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          Recent Conversations
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Chat history</p>
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
            {savedRecommendations.map((saved) => {
              const agent = AI_AGENTS[saved.agent as keyof typeof AI_AGENTS];
              if (!agent) return null;
              
              return (
                <Button
                  key={saved.id}
                  variant="ghost"
                  className="w-full p-3 h-auto rounded-lg border border-sidebar-border hover-elevate transition-all justify-start"
                  onClick={() => onLoadChat?.(saved.runId || saved.id.toString(), saved.agent, saved.content)}
                  data-testid={`saved-${saved.id}`}
                >
                  <div className="flex items-start gap-3 w-full">
                    <Avatar className="w-10 h-10 shrink-0">
                      <AvatarImage src={agent.avatar} alt={agent.name} />
                      <AvatarFallback>{agent.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="font-medium text-sm truncate">{agent.name}</p>
                        <Save className="w-3 h-3 text-primary shrink-0" />
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {saved.content.substring(0, 100)}...
                      </p>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(saved.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
