import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Clock, ChevronRight } from "lucide-react";
import { AI_AGENTS } from "@shared/schema";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Conversation {
  id: string;
  agent: string;
  task: string;
  timestamp: Date;
  messageCount: number;
}

interface ConversationHistoryProps {
  onSelectConversation?: (id: string) => void;
}

export function ConversationHistory({ onSelectConversation }: ConversationHistoryProps) {
  // Placeholder data - will be loaded from API
  const [conversations] = useState<Conversation[]>([]);

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
        {conversations.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-sm text-muted-foreground">
              No conversations yet. Run a meeting to get started.
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {conversations.map((conv) => {
              const agent = AI_AGENTS[conv.agent as keyof typeof AI_AGENTS];
              return (
                <button
                  key={conv.id}
                  onClick={() => onSelectConversation?.(conv.id)}
                  className="w-full p-3 rounded-lg border border-sidebar-border hover-elevate transition-all text-left group"
                  data-testid={`conversation-${conv.id}`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={agent?.avatar} alt={agent?.name} />
                      <AvatarFallback>{agent?.name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="font-medium text-sm truncate">{agent?.name}</p>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {conv.task}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {conv.messageCount} messages
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {conv.timestamp.toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
