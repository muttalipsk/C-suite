import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, ChevronDown, ChevronUp, Save } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChatBox } from "./ChatBox";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface AgentCardProps {
  agentKey: string;
  agentName: string;
  company: string;
  avatar: string;
  recommendation: string;
  runId: string;
  autoOpenChat?: boolean;
  savedChatHistory?: any[];
}

interface ChatMessage {
  sender: "user" | "agent";
  content: string;
  timestamp: Date;
}

export function AgentCard({
  agentKey,
  agentName,
  company,
  avatar,
  recommendation,
  runId,
  autoOpenChat = false,
  savedChatHistory = [],
}: AgentCardProps) {
  const [showChat, setShowChat] = useState(autoOpenChat);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const { toast } = useToast();

  // Update chat state when autoOpenChat changes
  useEffect(() => {
    setShowChat(autoOpenChat);
  }, [autoOpenChat]);

  // Initialize chat messages from saved history
  useEffect(() => {
    if (savedChatHistory && savedChatHistory.length > 0) {
      const parsedMessages = savedChatHistory.map((msg: any) => ({
        sender: msg.sender,
        content: msg.content,
        timestamp: new Date(msg.timestamp),
      }));
      setChatMessages(parsedMessages);
    }
  }, [savedChatHistory]);

  // Check if recommendation contains HTML tags
  const isHtmlContent = (text: string) => {
    return /<\/?[a-z][\s\S]*>/i.test(text);
  };

  // Parse recommendation into structured sections (for markdown/plain text)
  const parseRecommendation = (text: string) => {
    console.log(`[${agentKey}] Parsing recommendation:`, text.substring(0, 200));
    
    const sections = {
      keyRecommendations: [] as string[],
      rationale: "",
      pitfalls: [] as string[],
      nextSteps: "",
    };

    // More flexible patterns - handle variations in formatting
    const keyRecsMatch = text.match(/\*\*Key Recommendations\*\*:?\s*(.*?)(?=\*\*[A-Z]|$)/s);
    const rationaleMatch = text.match(/\*\*Rationale\s*[&and]*\s*Insights\*\*:?\s*(.*?)(?=\*\*[A-Z]|$)/s);
    const pitfallsMatch = text.match(/\*\*Potential Pitfalls\s*[&and]*\s*Mitigations\*\*:?\s*(.*?)(?=\*\*[A-Z]|$)/s);
    const nextStepsMatch = text.match(/\*\*Next Steps\s*[&and]*\s*Follow-Up\*\*:?\s*(.*?)(?=\*\*[A-Z]|$)/s);

    console.log(`[${agentKey}] Pattern matches:`, {
      keyRecs: !!keyRecsMatch,
      rationale: !!rationaleMatch,
      pitfalls: !!pitfallsMatch,
      nextSteps: !!nextStepsMatch
    });

    if (keyRecsMatch) {
      const bullets = keyRecsMatch[1].match(/[-•]\s*(.+?)(?=\n[-•]|\n\n|$)/gs);
      sections.keyRecommendations = bullets?.map(b => b.replace(/^[-•]\s*/, '').trim()) || [];
      console.log(`[${agentKey}] Found ${sections.keyRecommendations.length} key recommendations`);
    }
    if (rationaleMatch) sections.rationale = rationaleMatch[1].trim();
    if (pitfallsMatch) {
      const bullets = pitfallsMatch[1].match(/[-•]\s*(.+?)(?=\n[-•]|\n\n|$)/gs);
      sections.pitfalls = bullets?.map(b => b.replace(/^[-•]\s*/, '').trim()) || [];
    }
    if (nextStepsMatch) sections.nextSteps = nextStepsMatch[1].trim();

    return sections;
  };

  const hasHtmlContent = isHtmlContent(recommendation);
  const sections = !hasHtmlContent ? parseRecommendation(recommendation) : {
    keyRecommendations: [],
    rationale: "",
    pitfalls: [],
    nextSteps: "",
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save both recommendation AND chat history
      const response = await fetch("/api/save-recommendation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId,
          agent: agentKey,
          recommendation,
          chatHistory: chatMessages.length > 0 ? chatMessages.map(m => ({
            sender: m.sender,
            content: m.content,
            timestamp: m.timestamp.toISOString(),
          })) : null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save conversation");
      }

      setIsSaved(true);
      toast({
        title: "Conversation Saved",
        description: `${agentName}'s recommendation${chatMessages.length > 0 ? ' and chat history' : ''} has been saved.`,
      });

      // Trigger a custom event to notify conversation history
      window.dispatchEvent(new CustomEvent('recommendation-saved', {
        detail: { runId, agent: agentKey, agentName }
      }));
    } catch (error: any) {
      console.error("Save error:", error);
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save conversation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <Card className="hover-elevate transition-all w-full border-2 shadow-lg hover:shadow-xl" data-agent-card={agentKey}>
      <CardHeader className="space-y-4 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pb-6">
        <div className="flex items-start gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent-foreground/30 rounded-full blur-md"></div>
            <Avatar className="w-16 h-16 border-3 border-white shadow-md relative">
              <AvatarImage 
                src={avatar} 
                alt={agentName}
                className="object-cover"
              />
              <AvatarFallback className="bg-gradient-to-br from-primary to-accent-foreground text-white font-semibold">
                {agentName.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">{agentName}</CardTitle>
            <Badge variant="secondary" className="mt-2 bg-gradient-to-r from-primary/80 to-accent-foreground/80 text-white border-0 shadow-sm">
              {company}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between p-0 h-auto font-semibold text-sm"
              data-testid={`button-toggle-${agentKey}`}
            >
              Recommendation Details
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-4 mt-4">
            {hasHtmlContent ? (
              <div 
                className="prose prose-sm max-w-none dark:prose-invert
                  prose-p:text-muted-foreground prose-p:leading-relaxed
                  prose-headings:text-foreground prose-headings:font-semibold
                  prose-ul:text-muted-foreground prose-ul:space-y-1
                  prose-li:text-muted-foreground
                  prose-strong:text-foreground prose-strong:font-semibold
                  prose-a:text-primary hover:prose-a:text-primary/80"
                dangerouslySetInnerHTML={{ __html: recommendation }}
                data-testid={`recommendation-content-${agentKey}`}
              />
            ) : (
              <>
                {sections.keyRecommendations.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm text-foreground mb-2">Key Recommendations</h4>
                    <ul className="space-y-2">
                      {sections.keyRecommendations.map((rec, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground flex gap-2">
                          <span className="text-primary">•</span>
                          <span className="flex-1">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {sections.rationale && (
                  <div>
                    <h4 className="font-semibold text-sm text-foreground mb-2">Rationale & Insights</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{sections.rationale}</p>
                  </div>
                )}

                {sections.pitfalls.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm text-foreground mb-2">Potential Pitfalls & Mitigations</h4>
                    <ul className="space-y-2">
                      {sections.pitfalls.map((pitfall, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground flex gap-2">
                          <span className="text-destructive">•</span>
                          <span className="flex-1">{pitfall}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {sections.nextSteps && (
                  <div>
                    <h4 className="font-semibold text-sm text-foreground mb-2">Next Steps & Follow-Up</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{sections.nextSteps}</p>
                  </div>
                )}

                {!sections.keyRecommendations.length && !sections.rationale && (
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{recommendation}</p>
                )}
              </>
            )}
          </CollapsibleContent>
        </Collapsible>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 border-2 hover:border-primary/50 transition-all shadow-sm hover:shadow-md"
            onClick={handleSave}
            disabled={isSaving || isSaved}
            data-testid={`button-save-${agentKey}`}
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaved ? "Conversation Saved" : isSaving ? "Saving..." : "Save Conversation"}
          </Button>

          <Button
            variant={showChat ? "secondary" : "default"}
            className="flex-1 bg-gradient-to-r from-primary to-accent-foreground hover:from-primary/90 hover:to-accent-foreground/90 shadow-md hover:shadow-lg transition-all"
            onClick={() => setShowChat(!showChat)}
            data-testid={`button-chat-${agentKey}`}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            {showChat ? "Hide Chat" : "Ask Follow-up"}
          </Button>
        </div>

        {showChat && runId && (
          <div className="pt-4 border-t">
            <ChatBox 
              agentKey={agentKey} 
              agentName={agentName} 
              runId={runId}
              initialMessages={chatMessages.length > 0 ? chatMessages : undefined}
              onMessagesChange={setChatMessages}
            />
          </div>
        )}
      </CardContent>
    </Card>
    </motion.div>
  );
}