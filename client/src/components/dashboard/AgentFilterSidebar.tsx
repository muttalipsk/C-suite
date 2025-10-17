import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AI_AGENTS } from "@shared/schema";
import { Brain } from "lucide-react";

interface AgentFilterSidebarProps {
  selectedAgents: string[];
  onToggleAgent: (agentKey: string) => void;
}

export function AgentFilterSidebar({ selectedAgents, onToggleAgent }: AgentFilterSidebarProps) {
  return (
    <div className="w-72 border-r bg-sidebar h-screen flex flex-col">
      <div className="p-6 border-b">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          AI Leaders
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Select advisors</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {Object.entries(AI_AGENTS).map(([key, agent]) => (
            <button
              key={key}
              onClick={() => onToggleAgent(key)}
              className={`w-full p-3 rounded-lg border transition-all text-left hover-elevate ${
                selectedAgents.includes(key)
                  ? "border-primary bg-sidebar-accent"
                  : "border-sidebar-border"
              }`}
              data-testid={`sidebar-agent-${key}`}
            >
              <div className="flex items-start gap-3">
                <Avatar className="w-12 h-12 border-2 border-primary/20">
                  <AvatarImage src={agent.avatar} alt={agent.name} />
                  <AvatarFallback>{agent.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{agent.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{agent.company}</p>
                  <Badge variant="outline" className="mt-1 text-xs">
                    {agent.role}
                  </Badge>
                </div>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
