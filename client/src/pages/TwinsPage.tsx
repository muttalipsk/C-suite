import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Plus, MessageSquare, Send, Sparkles, AlertCircle, ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Twin {
  id: string;
  twinName: string;
  companyDomain: string;
  createdAt: string;
  toneStyle: string;
  riskTolerance: string;
}

interface ChatMessage {
  role: "user" | "twin";
  content: string;
  timestamp: string;
}

export default function TwinsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedTwinId, setSelectedTwinId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>({});
  const [currentMessage, setCurrentMessage] = useState("");

  // Fetch twins list
  const { data: twinsData, isLoading } = useQuery<{ twins: Twin[] }>({
    queryKey: ["/api/twins"],
  });

  const twins: Twin[] = twinsData?.twins || [];
  const selectedTwin = twins.find(t => t.id === selectedTwinId);

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: async ({ twinId, message }: { twinId: string; message: string }) => {
      const response = await fetch(`/api/twins/${twinId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send message");
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      const { twinId, message } = variables;
      
      // Add user message
      const userMessage: ChatMessage = {
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
      };

      // Add twin response
      const twinMessage: ChatMessage = {
        role: "twin",
        content: data.response,
        timestamp: new Date().toISOString(),
      };

      setChatMessages(prev => ({
        ...prev,
        [twinId]: [...(prev[twinId] || []), userMessage, twinMessage],
      }));

      setCurrentMessage("");

      if (data.escalated) {
        toast({
          title: "Limited Information",
          description: "Twin provided general guidance based on available data.",
          variant: "default",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Chat Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!currentMessage.trim() || !selectedTwinId) return;

    chatMutation.mutate({
      twinId: selectedTwinId,
      message: currentMessage,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading twins...</p>
        </div>
      </div>
    );
  }

  if (selectedTwin) {
    // Chat view
    const messages = chatMessages[selectedTwin.id] || [];

    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Chat Header */}
        <div className="border-b bg-card">
          <div className="container max-w-6xl mx-auto py-4 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedTwinId(null)}
                  data-testid="button-back-to-list"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <div>
                  <h2 className="text-xl font-semibold">{selectedTwin.twinName}</h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedTwin.toneStyle} • {selectedTwin.riskTolerance} Risk
                  </p>
                </div>
              </div>
              <Badge variant="secondary">{selectedTwin.companyDomain}</Badge>
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 container max-w-4xl mx-auto py-6 px-4 flex flex-col">
          <ScrollArea className="flex-1 pr-4">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">Start a conversation</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Ask your digital twin for advice, strategic insights, or general guidance.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-4 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-card border"
                      }`}
                      data-testid={`message-${message.role}-${index}`}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      <p className="text-xs mt-2 opacity-70">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Chat Input */}
          <div className="border-t pt-4 mt-4">
            <div className="flex gap-2">
              <Textarea
                placeholder="Ask your twin for advice..."
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                className="min-h-[80px]"
                disabled={chatMutation.isPending}
                data-testid="textarea-chat-message"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!currentMessage.trim() || chatMutation.isPending}
                size="icon"
                className="h-[80px]"
                data-testid="button-send-message"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Twins list view
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="w-8 h-8 text-primary" />
              <h1 className="text-3xl font-bold">Digital Twins</h1>
            </div>
            <p className="text-muted-foreground">
              Interact with AI-powered digital twins from your organization
            </p>
          </div>
          <Button
            onClick={() => navigate("/create-twin")}
            data-testid="button-create-new-twin"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Twin
          </Button>
        </div>

        {twins.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <AlertCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No twins yet</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Create your first digital twin to get started. Your twin will learn from your
                  communication style and provide personalized advice.
                </p>
                <Button
                  onClick={() => navigate("/create-twin")}
                  data-testid="button-create-first-twin"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Twin
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {twins.map((twin) => (
              <Card
                key={twin.id}
                className="hover-elevate cursor-pointer transition-all"
                onClick={() => setSelectedTwinId(twin.id)}
                data-testid={`card-twin-${twin.id}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <CardTitle className="text-lg">{twin.twinName}</CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {twin.companyDomain}
                    </Badge>
                  </div>
                  <CardDescription>
                    Created {new Date(twin.createdAt).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Style:</span>
                      <span className="font-medium">{twin.toneStyle}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Risk:</span>
                      <span className="font-medium">{twin.riskTolerance}</span>
                    </div>
                  </div>
                  <Separator className="my-4" />
                  <Button
                    variant="outline"
                    className="w-full"
                    data-testid={`button-chat-${twin.id}`}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Start Conversation
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
