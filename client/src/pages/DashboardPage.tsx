import { useState, useCallback, useRef } from "react";
import { Route, Switch, Link, useLocation } from "wouter";
import { MeetingForm } from "@/components/dashboard/MeetingForm";
import { AgentCard } from "@/components/dashboard/AgentCard";
import { AgentFilterSidebar } from "@/components/dashboard/AgentFilterSidebar";
import { ConversationHistory } from "@/components/dashboard/ConversationHistory";
import { UserProfileButton } from "@/components/dashboard/UserProfileButton";
import { AI_AGENTS } from "@shared/schema";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, Sparkles, Home } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import TwinsPage from "./TwinsPage";
import CreateTwinPage from "./CreateTwinPage";

interface DashboardPageProps {
  onLogout: () => void;
}

export default function DashboardPage({ onLogout }: DashboardPageProps) {
  const [location] = useLocation();
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
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedUser, setEditedUser] = useState<any>(null);


  const handleEditProfile = () => {
    setEditedUser({ ...user });
    setIsEditMode(true);
  };

  const handleSaveProfile = async () => {
    try {
      const response = await fetch("/api/auth/update-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editedUser),
      });

      if (response.ok) {
        const updatedUser = await response.json();
        setUser(updatedUser);
        setIsEditMode(false);
        setEditedUser(null);
      } else {
        alert("Failed to update profile");
      }
    } catch (error) {
      console.error("Failed to save profile:", error);
      alert("Failed to update profile");
    }
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditedUser(null);
  };

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

  // Abort controller to cancel duplicate requests
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastSubmitTimeRef = useRef<number>(0);

  const handleRunMeeting = useCallback(async (data: any) => {
    console.log("🔵 handleRunMeeting called with data:", {
      meetingType: data.meetingType,
      agents: data.selectedAgents,
      task: data.task?.substring(0, 50) + "..."
    });

    const now = Date.now();
    
    // Debounce: Ignore if submitted within last 2 seconds
    if (now - lastSubmitTimeRef.current < 2000) {
      console.log("⚠️ Duplicate submission ignored (debounced within 2s)");
      return;
    }
    
    lastSubmitTimeRef.current = now;

    // Prevent double execution
    if (isLoading) {
      console.log("⚠️ Meeting already in progress, ignoring duplicate request");
      return;
    }

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsLoading(true);
    // Clear previous conversation state
    setSelectedConversation(null);
    setResults(null);
    setRecommendations({});
    setCurrentRunId("");
    
    try {
      const requestBody = {
        task: data.task,
        agents: data.selectedAgents,
        turns: data.turns || 1,
        meetingType: data.meetingType || "board",
      };
      
      console.log("📤 Full request body:", requestBody);

      const response = await fetch("/api/meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: abortController.signal,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to run meeting");
      }

      console.log("Meeting results:", Object.keys(result.recommendations));
      setRecommendations(result.recommendations);
      setCurrentRunId(result.runId);
      setResults({
        runId: result.runId,
        recommendations: result.recommendations,
        selectedAgents: data.selectedAgents,
      });

      // Scroll to results after a brief delay
      setTimeout(() => {
        const resultsSection = document.querySelector('[data-results-section]');
        resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (error: any) {
      // Ignore abort errors (these are intentional cancellations)
      if (error.name === 'AbortError') {
        console.log("Request was cancelled");
        return;
      }
      
      console.error("Meeting error:", error);
      alert(error.message || "Failed to run meeting. Please try again.");
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [isLoading, selectedAgents]);

  const handleSelectConversation = async (runId: string, agentKey: string) => {
    try {
      // First try to fetch from agent memory (saved recommendations)
      const memoryResponse = await fetch(`/api/agent-memory`);
      if (memoryResponse.ok) {
        const memoryData = await memoryResponse.json();
        const savedItem = memoryData.memories?.find((m: any) => 
          (m.runId === runId || m.id.toString() === runId) && m.agent === agentKey
        );

        if (savedItem) {
          const useRunId = savedItem.runId || savedItem.id.toString();
          
          // Set the results to show the agent card
          setResults({
            runId: useRunId,
            recommendations: { [agentKey]: savedItem.content },
            selectedAgents: [agentKey],
            selectedAgentKey: agentKey
          });

          setCurrentRunId(useRunId);
          setRecommendations({ [agentKey]: savedItem.content });
          setSelectedConversation({ runId: useRunId, agentKey });

          // Scroll to the results section and the specific agent card
          setTimeout(() => {
            const resultsSection = document.querySelector('[data-results-section]');
            resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });

            setTimeout(() => {
              const agentCard = document.querySelector(`[data-agent-card="${agentKey}"]`);
              if (agentCard) {
                agentCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, 300);
          }, 100);
          return;
        }
      }

      // Fallback: try to fetch from runs if not found in memory
      const runsResponse = await fetch(`/api/runs`);
      if (!runsResponse.ok) throw new Error("Failed to fetch runs");

      const runs = await runsResponse.json();
      const selectedRun = runs.find((r: any) => r.id === runId);

      if (selectedRun) {
        setResults({
          runId: selectedRun.id,
          recommendations: selectedRun.recommendations,
          selectedAgents: selectedRun.agents,
          selectedAgentKey: agentKey
        });

        setCurrentRunId(selectedRun.id);
        setRecommendations(selectedRun.recommendations);
        setSelectedConversation({ runId: selectedRun.id, agentKey });

        setTimeout(() => {
          const resultsSection = document.querySelector('[data-results-section]');
          resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });

          setTimeout(() => {
            const agentCard = document.querySelector(`[data-agent-card="${agentKey}"]`);
            if (agentCard) {
              agentCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 300);
        }, 100);
      }
    } catch (error) {
      console.error("Failed to load conversation:", error);
    }
  };

  const handleAgentToggle = useCallback((agentKey: string) => {
    setSelectedAgents(prev =>
      prev.includes(agentKey)
        ? prev.filter(a => a !== agentKey)
        : [...prev, agentKey]
    );
  }, []);

  const handleLoadChat = useCallback((runId: string, agentKey: string, recommendation: string) => {
    // Set the current run ID
    setCurrentRunId(runId);

    // Set recommendations with the saved content
    setRecommendations({
      [agentKey]: recommendation
    });

    // Scroll to results
    setTimeout(() => {
      document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);


  // Mock AGENT_DATA and results for the changes to apply correctly
  // In a real scenario, these would be fetched or defined elsewhere.
  const AGENT_DATA = AI_AGENTS;

  return (
    <div className="flex h-screen bg-background">
      {/* Left Sidebar - Agent Filter (only show on meeting page) */}
      {location === "/" && (
        <AgentFilterSidebar
          selectedAgents={selectedAgents}
          onToggleAgent={toggleAgent}
          onToggleAll={toggleAll}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header with Gradient */}
        <header className="border-b-2 bg-gradient-to-r from-primary/5 via-accent/5 to-transparent px-6 py-5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-gradient-to-br from-primary/90 to-accent-foreground/90 rounded-xl shadow-md">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent-foreground bg-clip-text text-transparent">
                Ask the Expert
              </h1>
              <p className="text-sm text-muted-foreground font-medium">Strategic Advisory Platform</p>
            </div>
          </div>
          <UserProfileButton
            user={user}
            onLogout={onLogout}
            onViewProfile={() => setShowProfile(true)}
          />
        </header>

        {/* Main Content Area with Routing */}
        <Switch>
          <Route path="/">
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
                      <div className="space-y-6" data-results-section id="results-section">
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
          </Route>

          <Route path="/twins">
            <TwinsPage />
          </Route>

          <Route path="/create-twin">
            <CreateTwinPage />
          </Route>
        </Switch>
      </div>

      {/* Right Sidebar - Conversation History (only show on meeting page) */}
      {location === "/" && (
        <ConversationHistory 
          onSelectConversation={handleSelectConversation} 
          onLoadChat={handleLoadChat}
          selectedConversation={selectedConversation}
        />
      )}

      {/* Profile Dialog */}
      {showProfile && user && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowProfile(false); setIsEditMode(false); }}>
          <div className="bg-card border border-card-border rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold">Your Profile</h2>
              <div className="flex gap-2">
                {!isEditMode ? (
                  <Button variant="outline" size="sm" onClick={handleEditProfile}>Edit</Button>
                ) : (
                  <>
                    <Button variant="outline" size="sm" onClick={handleCancelEdit}>Cancel</Button>
                    <Button variant="default" size="sm" onClick={handleSaveProfile}>Save</Button>
                  </>
                )}
                <Button variant="ghost" size="sm" onClick={() => { setShowProfile(false); setIsEditMode(false); }}>×</Button>
              </div>
            </div>

            <div className="space-y-6">
              {(user.photo || isEditMode) && (
                <div className="flex justify-center">
                  {user.photo && <img src={user.photo} alt={user.name} className="w-32 h-32 rounded-full object-cover border-4 border-primary/20" />}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Name</label>
                  {isEditMode ? (
                    <Input 
                      value={editedUser?.name || ""} 
                      onChange={(e) => setEditedUser({...editedUser, name: e.target.value})}
                      className="mt-1"
                    />
                  ) : (
                    <p className="font-medium mt-1">{user.name}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="font-medium mt-1">{user.email}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Company Name</label>
                  {isEditMode ? (
                    <Input 
                      value={editedUser?.companyName || ""} 
                      onChange={(e) => setEditedUser({...editedUser, companyName: e.target.value})}
                      className="mt-1"
                    />
                  ) : (
                    <p className="font-medium mt-1">{user.companyName || "Not provided"}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Designation</label>
                  {isEditMode ? (
                    <Input 
                      value={editedUser?.designation || ""} 
                      onChange={(e) => setEditedUser({...editedUser, designation: e.target.value})}
                      className="mt-1"
                    />
                  ) : (
                    <p className="font-medium mt-1">{user.designation || "Not provided"}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Role Description</label>
                  {isEditMode ? (
                    <Textarea 
                      value={editedUser?.roleDescription || ""} 
                      onChange={(e) => setEditedUser({...editedUser, roleDescription: e.target.value})}
                      className="mt-1 min-h-20"
                    />
                  ) : (
                    <p className="mt-1">{user.roleDescription || "Not provided"}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Company Website</label>
                  {isEditMode ? (
                    <Input 
                      value={editedUser?.companyWebsite || ""} 
                      onChange={(e) => setEditedUser({...editedUser, companyWebsite: e.target.value})}
                      className="mt-1"
                    />
                  ) : (
                    <p className="mt-1">{user.companyWebsite || "Not provided"}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Role Details</label>
                  {isEditMode ? (
                    <Input 
                      value={editedUser?.roleDetails || ""} 
                      onChange={(e) => setEditedUser({...editedUser, roleDetails: e.target.value})}
                      className="mt-1"
                    />
                  ) : (
                    <p className="mt-1">{user.roleDetails || "Not provided"}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Product Expectations</label>
                  {isEditMode ? (
                    <Textarea 
                      value={editedUser?.productExpectations || ""} 
                      onChange={(e) => setEditedUser({...editedUser, productExpectations: e.target.value})}
                      className="mt-1 min-h-20"
                    />
                  ) : (
                    <p className="mt-1">{user.productExpectations || "Not provided"}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">1-Year Goals</label>
                  {isEditMode ? (
                    <Textarea 
                      value={editedUser?.goalOneYear || ""} 
                      onChange={(e) => setEditedUser({...editedUser, goalOneYear: e.target.value})}
                      className="mt-1 min-h-20"
                    />
                  ) : (
                    <p className="mt-1">{user.goalOneYear || "Not provided"}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">5-Year Goals</label>
                  {isEditMode ? (
                    <Textarea 
                      value={editedUser?.goalFiveYears || ""} 
                      onChange={(e) => setEditedUser({...editedUser, goalFiveYears: e.target.value})}
                      className="mt-1 min-h-20"
                    />
                  ) : (
                    <p className="mt-1">{user.goalFiveYears || "Not provided"}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}