import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AI_AGENTS } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { isHtmlContent, parseRecommendation } from "@/lib/parseRecommendation";

interface Message {
  sender: "user" | "agent";
  content: string;
  timestamp: Date;
}

interface ChatBoxProps {
  agentKey: string;
  agentName: string;
  runId: string;
  initialMessages?: Message[];
  onMessagesChange?: (messages: Message[]) => void;
}

interface PendingFollowup {
  originalQuestion: string;
  counterQuestions: string[];
  answers: string[];
}

export function ChatBox({ agentKey, agentName, runId, initialMessages = [], onMessagesChange }: ChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingFollowup, setPendingFollowup] = useState<PendingFollowup | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const awaitingClarification = pendingFollowup !== null && pendingFollowup.answers.length < pendingFollowup.counterQuestions.length;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Notify parent when messages change
  useEffect(() => {
    onMessagesChange?.(messages);
  }, [messages, onMessagesChange]);

  // Load chat history on mount
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const response = await fetch(`/api/chat/${runId}/${agentKey}`);
        if (response.ok) {
          const data = await response.json();
          const loadedMessages: Message[] = data.history.map((h: any) => ({
            sender: h.sender,
            content: h.message,
            timestamp: new Date(h.timestamp),
          }));
          setMessages(loadedMessages);
          // Immediately notify parent of loaded messages
          onMessagesChange?.(loadedMessages);
        }
      } catch (error) {
        console.error("Failed to load chat history:", error);
      }
    };

    if (initialMessages.length === 0) {
      loadChatHistory();
    }
  }, [runId, agentKey, initialMessages.length, onMessagesChange]);


  const sendMessage = async (messageToSend: string) => {
    const userMessage: Message = {
      sender: "user",
      content: messageToSend,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // If awaiting clarification, collect answer
      if (awaitingClarification && pendingFollowup) {
        const updatedAnswers = [...pendingFollowup.answers, messageToSend];
        
        // Check if all counter-questions have been answered
        if (updatedAnswers.length < pendingFollowup.counterQuestions.length) {
          // More questions to answer - show next counter-question
          setPendingFollowup({
            ...pendingFollowup,
            answers: updatedAnswers
          });
          
          const nextQuestionIndex = updatedAnswers.length;
          const nextQuestion: Message = {
            sender: "agent",
            content: pendingFollowup.counterQuestions[nextQuestionIndex],
            timestamp: new Date(),
          };
          
          setMessages(prev => [...prev, nextQuestion]);
          setIsLoading(false);
          return;
        }
        
        // All questions answered - send enriched context to chat endpoint
        const clarifications = pendingFollowup.counterQuestions.map((q, i) => ({
          question: q,
          answer: updatedAnswers[i]
        }));
        
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            runId,
            agent: agentKey,
            message: pendingFollowup.originalQuestion,
            enriched_context: {
              clarifications,
              meeting_type: "chat"
            }
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Chat failed");
        }

        const agentMessage: Message = {
          sender: "agent",
          content: result.response,
          timestamp: new Date(),
        };
        
        setMessages(prev => [...prev, agentMessage]);
        setPendingFollowup(null); // Clear state after successful response
        return;
      }

      // Evaluate if counter-questions are needed (only for top-level messages)
      try {
        const evaluateResponse = await fetch("/api/chat/evaluate-followup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: messageToSend,
            agent: agentKey,
            runId,
            meetingType: "chat"
          }),
        });

        if (evaluateResponse.ok) {
          const evalResult = await evaluateResponse.json();
          
          if (evalResult.needs_counter_questions) {
            // Get counter-question
            const counterResponse = await fetch("/api/chat/counter-question", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                question: messageToSend,
                agent: agentKey,
                runId,
                meetingType: "chat",
                previousCounterQuestions: []
              }),
            });

            if (counterResponse.ok) {
              const counterResult = await counterResponse.json();
              
              // Backend now returns array of questions
              const counterQuestions = counterResult.counter_questions || [];
              
              if (counterQuestions.length === 0) {
                console.error("No counter-questions received");
                // Fall through to direct chat
              } else {
                // Store pending followup state
                setPendingFollowup({
                  originalQuestion: messageToSend,
                  counterQuestions,
                  answers: []
                });

                // Display first counter-question as agent message
                const counterQuestionMessage: Message = {
                  sender: "agent",
                  content: counterQuestions[0],
                  timestamp: new Date(),
                };
                
                setMessages(prev => [...prev, counterQuestionMessage]);
                setIsLoading(false);
                return; // Exit early, waiting for user's clarification
              }
            }
          }
        }
      } catch (evalError) {
        console.log("Evaluation skipped, proceeding with direct chat:", evalError);
        // Fall through to direct chat if evaluation fails
      }

      // No counter-questions needed or evaluation failed - proceed with direct chat
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId,
          agent: agentKey,
          message: messageToSend,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Chat failed");
      }

      const agentMessage: Message = {
        sender: "agent",
        content: result.response,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, agentMessage]);
    } catch (error: any) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        sender: "agent",
        content: "I'm having trouble responding right now. Please try again.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      setPendingFollowup(null); // Clear state on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const currentInput = input;
    setInput("");
    await sendMessage(currentInput);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const agentAvatar = AI_AGENTS[agentKey as keyof typeof AI_AGENTS]?.avatar || "";

  return (
    <div className="space-y-4">
        <div className="max-h-80 overflow-y-auto space-y-4 pr-2">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Start a conversation with {agentName}
          </p>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              data-testid={`message-${msg.sender}-${idx}`}
            >
              {msg.sender === "agent" && (
                <Avatar className="w-8 h-8">
                  <AvatarImage src={agentAvatar} />
                  <AvatarFallback>{agentName[0]}</AvatarFallback>
                </Avatar>
              )}

              <div className={`flex flex-col gap-1 max-w-[80%] ${msg.sender === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`rounded-lg px-4 py-2 ${
                    msg.sender === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card"
                  }`}
                >
                  {msg.sender === "user" ? (
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                  ) : (
                    (() => {
                      const hasHtml = isHtmlContent(msg.content);
                      const sections = !hasHtml ? parseRecommendation(msg.content) : null;
                      
                      if (hasHtml) {
                        return (
                          <div 
                            className="prose prose-sm max-w-none dark:prose-invert
                              prose-p:text-muted-foreground prose-p:leading-relaxed
                              prose-headings:text-foreground prose-headings:font-semibold
                              prose-ul:text-muted-foreground prose-ul:space-y-1
                              prose-li:text-muted-foreground
                              prose-strong:text-foreground prose-strong:font-semibold"
                            dangerouslySetInnerHTML={{ __html: msg.content }}
                          />
                        );
                      } else if (sections && (sections.keyRecommendations.length > 0 || sections.rationale)) {
                        return (
                          <div className="space-y-3">
                            {sections.keyRecommendations.length > 0 && (
                              <div>
                                <h5 className="font-semibold text-xs text-foreground mb-1.5">Key Recommendations</h5>
                                <ul className="space-y-1">
                                  {sections.keyRecommendations.map((rec, i) => (
                                    <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                                      <span className="text-primary">•</span>
                                      <span className="flex-1">{rec}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {sections.rationale && (
                              <div>
                                <h5 className="font-semibold text-xs text-foreground mb-1.5">Rationale & Insights</h5>
                                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{sections.rationale}</p>
                              </div>
                            )}
                            
                            {sections.pitfalls.length > 0 && (
                              <div>
                                <h5 className="font-semibold text-xs text-foreground mb-1.5">Potential Pitfalls & Mitigations</h5>
                                <ul className="space-y-1">
                                  {sections.pitfalls.map((pitfall, i) => (
                                    <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                                      <span className="text-destructive">•</span>
                                      <span className="flex-1">{pitfall}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {sections.nextSteps && (
                              <div>
                                <h5 className="font-semibold text-xs text-foreground mb-1.5">Next Steps & Follow-Up</h5>
                                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{sections.nextSteps}</p>
                              </div>
                            )}
                          </div>
                        );
                      } else {
                        return <p className="text-sm leading-relaxed">{msg.content}</p>;
                      }
                    })()
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {msg.sender === "user" && (
                <Avatar className="w-8 h-8">
                  <AvatarFallback>U</AvatarFallback>
                </Avatar>
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex gap-3 justify-start">
            <Avatar className="w-8 h-8">
              <AvatarImage src={agentAvatar} />
              <AvatarFallback>{agentName[0]}</AvatarFallback>
            </Avatar>
            <div className="bg-card rounded-lg px-4 py-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={`Ask ${agentName} a follow-up question...`}
          className="resize-none min-h-10"
          rows={2}
          data-testid={`input-chat-${agentKey}`}
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          size="icon"
          className="shrink-0"
          data-testid={`button-send-${agentKey}`}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
