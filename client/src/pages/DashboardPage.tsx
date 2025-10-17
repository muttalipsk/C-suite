import { useState } from "react";
import { MeetingForm } from "@/components/dashboard/MeetingForm";
import { AgentCard } from "@/components/dashboard/AgentCard";
import { AgentFilterSidebar } from "@/components/dashboard/AgentFilterSidebar";
import { ConversationHistory } from "@/components/dashboard/ConversationHistory";
import { UserProfileButton } from "@/components/dashboard/UserProfileButton";
import { AI_AGENTS } from "@shared/schema";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain } from "lucide-react";

interface DashboardPageProps {
  onLogout: () => void;
}

export default function DashboardPage({ onLogout }: DashboardPageProps) {
  const [selectedAgents, setSelectedAgents] = useState<string[]>(Object.keys(AI_AGENTS));
  const [recommendations, setRecommendations] = useState<Record<string, string>>({});
  const [currentRunId, setCurrentRunId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const toggleAgent = (agentKey: string) => {
    if (selectedAgents.includes(agentKey)) {
      setSelectedAgents(selectedAgents.filter(k => k !== agentKey));
    } else {
      setSelectedAgents([...selectedAgents, agentKey]);
    }
  };

  const handleRunMeeting = async (data: any) => {
    setIsLoading(true);
    // Simulate API call - will be implemented in integration phase
    setTimeout(() => {
      const mockRecommendations: Record<string, string> = {};
      data.selectedAgents.forEach((agent: string) => {
        mockRecommendations[agent] = `**Summary**: Based on your query about "${data.task}", here's my strategic recommendation tailored to your role and context.

**Key Recommendations**:
- Implement a phased approach starting with pilot projects in controlled environments
- Build internal AI expertise through training programs and strategic hiring
- Establish clear governance frameworks and ethical guidelines
- Partner with established AI providers to accelerate implementation
- Monitor industry developments and adjust strategy quarterly

**Rationale and Balance**: This approach balances innovation with risk management, ensuring sustainable AI adoption while building organizational capabilities.

**Next Steps or Considerations**: Schedule a follow-up session to discuss specific implementation timelines and resource allocation.`;
      });
      setRecommendations(mockRecommendations);
      setCurrentRunId("mock-run-" + Date.now());
      setIsLoading(false);
    }, 2000);
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Left Sidebar - Agent Filter */}
      <AgentFilterSidebar
        selectedAgents={selectedAgents}
        onToggleAgent={toggleAgent}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="border-b bg-background px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">AI Leaders Boardroom</h1>
              <p className="text-sm text-muted-foreground">Strategic Advisory Platform</p>
            </div>
          </div>
          <UserProfileButton
            onLogout={onLogout}
            onViewProfile={() => console.log("View profile")}
          />
        </header>

        {/* Main Content Area */}
        <ScrollArea className="flex-1">
          <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Meeting Form */}
            <MeetingForm onSubmit={handleRunMeeting} isLoading={isLoading} />

            {/* Results */}
            {Object.keys(recommendations).length > 0 && (
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold">Strategic Recommendations</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Object.entries(recommendations).map(([agentKey, recommendation]) => {
                    const agent = AI_AGENTS[agentKey as keyof typeof AI_AGENTS];
                    return (
                      <AgentCard
                        key={agentKey}
                        agentKey={agentKey}
                        agentName={agent.name}
                        company={agent.company}
                        avatar={agent.avatar}
                        recommendation={recommendation}
                        runId={currentRunId}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right Sidebar - Conversation History */}
      <ConversationHistory />
    </div>
  );
}
