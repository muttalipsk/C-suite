import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { AI_AGENTS } from "@shared/schema";
import { Brain, CheckCircle2 } from "lucide-react";

interface AgentFilterSidebarProps {
  selectedAgents: string[];
  onToggleAgent: (agentKey: string) => void;
  onToggleAll: () => void;
}

export function AgentFilterSidebar({ selectedAgents, onToggleAgent, onToggleAll }: AgentFilterSidebarProps) {
  const allSelected = selectedAgents.length === Object.keys(AI_AGENTS).length;

  return (
    <aside className="w-64 border-r bg-sidebar h-screen flex flex-col">
      <div className="p-6 border-b">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          Digital Twin
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Select advisors</p>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onToggleAll}
          className="mt-3 w-full"
          data-testid="button-toggle-all-agents"
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {Object.entries(AI_AGENTS).map(([key, agent]) => {
            const isSelected = selectedAgents.includes(key);
            return (
              <button
                key={key}
                onClick={() => onToggleAgent(key)}
                className={`w-full p-3 rounded-lg border transition-all text-left hover-elevate ${
                  isSelected
                    ? "border-primary bg-sidebar-accent"
                    : "border-sidebar-border opacity-60"
                }`}
                data-testid={`sidebar-agent-${key}`}
              >
                <div className="flex items-start gap-3">
                  <Avatar className="w-12 h-12 border-2 border-primary/20">
                    <AvatarImage 
                      src={agent.avatar} 
                      alt={agent.name}
                      className="object-cover"
                      onError={(e) => {
                        console.error(`Failed to load avatar for ${agent.name}:`, agent.avatar);
                      }}
                    />
                    <AvatarFallback>{agent.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{agent.name}</p>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{agent.company}</p>
                    <Badge variant="outline" className="mt-1 text-xs">
                      {agent.role}
                    </Badge>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </aside>
  );
}