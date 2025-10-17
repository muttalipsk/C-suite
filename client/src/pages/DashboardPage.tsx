import { useState, useCallback } from "react";
import { MeetingForm } from "@/components/dashboard/MeetingForm";
import { AgentCard } from "@/components/dashboard/AgentCard";
import { AgentFilterSidebar } from "@/components/dashboard/AgentFilterSidebar";
import { ConversationHistory } from "@/components/dashboard/ConversationHistory";
import { UserProfileButton } from "@/components/dashboard/UserProfileButton";
import { AI_AGENTS } from "@shared/schema";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DashboardPageProps {
  onLogout: () => void;
}

export default function DashboardPage({ onLogout }: DashboardPageProps) {
  const [selectedAgents, setSelectedAgents] = useState<string[]>(Object.keys(AI_AGENTS));
  const [recommendations, setRecommendations] = useState<Record<string, string>>({});
  const [currentRunId, setCurrentRunId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<{runId: string, agentKey: string} | null>(null);

  // Fetch user data
  useState(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch("/api/auth/me");
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        }
      } catch (error) {
        console.error("Failed to fetch user:", error);
      }
    };
    fetchUser();
  });
  const [results, setResults] = useState<{
    runId: string;
    recommendations: Record<string, string>;
    selectedAgents: string[];
    selectedAgentKey?: string;
  } | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [user, setUser] = useState<any>(null);


  const toggleAgent = useCallback((agentKey: string) => {
    setSelectedAgents(prev => {
      if (prev.includes(agentKey)) {
        return prev.filter(k => k !== agentKey);
      } else {
        return [...prev, agentKey];
      }
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedAgents(prev => {
      if (prev.length === Object.keys(AI_AGENTS).length) {
        return [];
      } else {
        return Object.keys(AI_AGENTS);
      }
    });
  }, []);

  const handleRunMeeting = async (data: any) => {
    setIsLoading(true);
    try {
      console.log("Running meeting with agents:", data.selectedAgents);
      console.log("Current selectedAgents state:", selectedAgents);

      const response = await fetch("/api/meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: data.task,
          agents: data.selectedAgents,
          turns: data.turns || 1,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to run meeting");
      }

      console.log("Meeting results:", Object.keys(result.recommendations));
      setRecommendations(result.recommendations);
      setCurrentRunId(result.runId);
      setSelectedConversation(null);
      setResults({
        runId: result.runId,
        recommendations: result.recommendations,
        selectedAgents: data.selectedAgents,
      });
    } catch (error: any) {
      console.error("Meeting error:", error);
      alert(error.message || "Failed to run meeting. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectConversation = async (runId: string, agentKey: string) => {
    try {
      // Fetch the run data
      const response = await fetch(`/api/runs`);
      if (!response.ok) throw new Error("Failed to fetch runs");

      const runs = await response.json();
      const selectedRun = runs.find((r: any) => r.id === runId);

      if (selectedRun) {
        // Clear previous state first to force re-render
        setResults(null);
        
        // Set the results to show the agent cards with a slight delay
        setTimeout(() => {
          setResults({
            runId: selectedRun.id,
            recommendations: selectedRun.recommendations,
            selectedAgents: selectedRun.agents,
            selectedAgentKey: agentKey // Track which agent was clicked
          });
          
          setCurrentRunId(selectedRun.id);
          setRecommendations(selectedRun.recommendations);
          setSelectedConversation({ runId, agentKey });

          // Scroll to the results section and the specific agent card
          setTimeout(() => {
            const resultsSection = document.querySelector('[data-results-section]');
            resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            // Scroll to the specific agent card after a brief delay
            setTimeout(() => {
              const agentCard = document.querySelector(`[data-agent-card="${agentKey}"]`);
              if (agentCard) {
                agentCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, 300);
          }, 100);
        }, 50);
      }
    } catch (error) {
      console.error("Failed to load conversation:", error);
    }
  };

  // Mock AGENT_DATA and results for the changes to apply correctly
  // In a real scenario, these would be fetched or defined elsewhere.
  const AGENT_DATA = AI_AGENTS;

  return (
    <div className="flex h-screen bg-background">
      {/* Left Sidebar - Agent Filter */}
      <AgentFilterSidebar
        selectedAgents={selectedAgents}
        onToggleAgent={toggleAgent}
        onToggleAll={toggleAll}
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
            user={user}
            onLogout={onLogout}
            onViewProfile={() => setShowProfile(true)}
          />
        </header>

        {/* Main Content Area */}
        <ScrollArea className="flex-1">
          <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Meeting Form */}
            <MeetingForm
              onSubmit={handleRunMeeting}
              isLoading={isLoading}
              selectedAgents={selectedAgents}
            />

            {/* Results */}
            {results && (
                  <div className="space-y-6" data-results-section>
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-bold">AI Leaders' Recommendations</h2>
                      <Badge variant="outline" className="text-sm">
                        {results.selectedAgents.length} {results.selectedAgents.length === 1 ? 'Agent' : 'Agents'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
                      {Object.entries(results.recommendations).map(([agentKey, recommendation]) => {
                        const agent = AGENT_DATA[agentKey as keyof typeof AGENT_DATA];
                        if (!agent) return null;

                        return (
                          <AgentCard
                            key={agentKey}
                            agentKey={agentKey}
                            agentName={agent.name}
                            company={agent.company}
                            avatar={agent.avatar}
                            recommendation={recommendation}
                            runId={results.runId}
                            autoOpenChat={results.selectedAgentKey === agentKey}
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
      <ConversationHistory onSelectConversation={handleSelectConversation} />

      {/* Profile Dialog */}
      {showProfile && user && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowProfile(false)}>
          <div className="bg-card border border-card-border rounded-xl p-6 max-w-2xl w-full m-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold">Your Profile</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowProfile(false)}>×</Button>
            </div>
            
            <div className="space-y-4">
              {user.photo && (
                <div className="flex justify-center">
                  <img src={user.photo} alt={user.name} className="w-32 h-32 rounded-full object-cover" />
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Name</label>
                  <p className="font-medium">{user.name}</p>
                </div>
                
                <div>
                  <label className="text-sm text-muted-foreground">Email</label>
                  <p className="font-medium">{user.email}</p>
                </div>
                
                {user.company && (
                  <div>
                    <label className="text-sm text-muted-foreground">Company</label>
                    <p className="font-medium">{user.company}</p>
                  </div>
                )}
                
                {user.role && (
                  <div>
                    <label className="text-sm text-muted-foreground">Role</label>
                    <p className="font-medium">{user.role}</p>
                  </div>
                )}
              </div>
              
              {user.goals && (
                <div>
                  <label className="text-sm text-muted-foreground">Goals</label>
                  <p className="mt-1">{user.goals}</p>
                </div>
              )}
              
              {user.challenges && (
                <div>
                  <label className="text-sm text-muted-foreground">Challenges</label>
                  <p className="mt-1">{user.challenges}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}