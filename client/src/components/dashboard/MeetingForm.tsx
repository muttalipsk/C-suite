import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { AI_AGENTS } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Send, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";

interface MeetingFormData {
  task: string;
  meetingType: "board" | "email" | "chat";
  selectedAgents: string[];
  turns: number;
  // Optional fields for pre-meeting completion
  runId?: string;
  recommendations?: any;
}

interface MeetingFormProps {
  onSubmit: (data: MeetingFormData) => void;
  isLoading?: boolean;
  selectedAgents: string[];
}

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface PreMeetingSession {
  sessionId: string;
  counterQuestion: string | null;
  isReady: boolean;
}

export function MeetingForm({ onSubmit, isLoading = false, selectedAgents }: MeetingFormProps) {
  const [preMeetingSession, setPreMeetingSession] = useState<PreMeetingSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState("");
  const [initialQuestion, setInitialQuestion] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const form = useForm<MeetingFormData>({
    defaultValues: {
      task: "",
      meetingType: "board",
      turns: 1,
      selectedAgents: [],
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initPreMeetingMutation = useMutation({
    mutationFn: async (data: { question: string; agents: string[]; meetingType: string }) => {
      const response = await apiRequest("POST", "/api/pre-meeting/init", data);
      const result = await response.json();
      return result as PreMeetingSession;
    },
    onSuccess: (data) => {
      setPreMeetingSession(data);
      // Add AI's first counter-question to messages
      if (data.counterQuestion) {
        setMessages(prev => [...prev, {
          role: "assistant" as const,
          content: data.counterQuestion as string,
          timestamp: new Date().toISOString(),
        }]);
      }
    },
  });

  const iterateMutation = useMutation({
    mutationFn: async (userResponse: string) => {
      const response = await apiRequest("POST", "/api/pre-meeting/iterate", {
        sessionId: preMeetingSession!.sessionId,
        userResponse,
      });
      const data = await response.json();
      return data as {
        counterQuestion: string | null;
        isReady: boolean;
      };
    },
    onSuccess: (data) => {
      if (data.counterQuestion) {
        setMessages(prev => [...prev, {
          role: "assistant" as const,
          content: data.counterQuestion as string,
          timestamp: new Date().toISOString(),
        }]);
      }

      if (data.isReady) {
        completeMutation.mutate();
      }
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/pre-meeting/complete", {
        sessionId: preMeetingSession!.sessionId,
      });
      const data = await response.json();
      return data;
    },
    onSuccess: (data) => {
      // Meeting complete - pass the runId and recommendations to parent
      onSubmit({
        task: initialQuestion,
        meetingType: form.getValues("meetingType"),
        selectedAgents,
        turns: 1,
        // Include the completed meeting data
        runId: data.runId,
        recommendations: data.recommendations,
      });
    },
  });

  const handleInitialSubmit = (data: MeetingFormData) => {
    if (!data.task.trim()) return;

    console.log("🟢 Starting chat-style pre-meeting conversation");
    
    // Save initial question
    setInitialQuestion(data.task);

    // Add user's first message to chat
    setMessages([{
      role: "user",
      content: data.task,
      timestamp: new Date().toISOString(),
    }]);

    // Clear the input
    setUserInput("");
    
    // Start pre-meeting conversation
    initPreMeetingMutation.mutate({
      question: data.task,
      agents: selectedAgents,
      meetingType: data.meetingType,
    });
  };

  const handleSendMessage = () => {
    if (!userInput.trim() || iterateMutation.isPending || !preMeetingSession) return;

    const userMessage: Message = {
      role: "user",
      content: userInput,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    iterateMutation.mutate(userInput);
    setUserInput("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && preMeetingSession) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCancelConversation = () => {
    setPreMeetingSession(null);
    setMessages([]);
    setUserInput("");
    setInitialQuestion("");
    form.reset();
  };

  return (
    <Card>
      <AnimatePresence>
        {selectedAgents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="px-6 pt-6 pb-4 flex flex-wrap gap-2"
          >
            {selectedAgents.map((agentKey, idx) => {
              const agent = AI_AGENTS[agentKey as keyof typeof AI_AGENTS];
              return agent ? (
                <motion.div
                  key={agentKey}
                  initial={{ opacity: 0, scale: 0.8, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: -10 }}
                  transition={{ delay: idx * 0.05, duration: 0.2 }}
                >
                  <Badge
                    variant="secondary"
                    className="text-xs bg-gradient-to-r from-primary/90 to-accent-foreground/90 text-white border-0 shadow-sm"
                  >
                    {agent.name}
                  </Badge>
                </motion.div>
              ) : null;
            })}
          </motion.div>
        )}
      </AnimatePresence>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleInitialSubmit)} className="space-y-6">
            {/* Meeting Type - only show when not in conversation */}
            {!preMeetingSession && (
              <FormField
                control={form.control}
                name="meetingType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Context Type</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="board" id="board" data-testid="radio-board" />
                          <Label htmlFor="board" className="cursor-pointer">Board Meeting</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="email" id="email" data-testid="radio-email" />
                          <Label htmlFor="email" className="cursor-pointer">Email / Chat</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="chat" id="chat" data-testid="radio-chat" />
                          <Label htmlFor="chat" className="cursor-pointer">General Strategy</Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Chat Messages - shown when conversation is active */}
            {preMeetingSession && messages.length > 0 && (
              <div className="space-y-4">
                <div className="max-h-96 overflow-y-auto space-y-3 p-4 bg-muted/30 rounded-lg border">
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {msg.role === "assistant" && (
                        <Avatar className="w-8 h-8 shrink-0">
                          <AvatarFallback className="bg-primary text-primary-foreground">AI</AvatarFallback>
                        </Avatar>
                      )}

                      <div className={`flex flex-col gap-1 max-w-[85%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                        <div
                          className={`rounded-lg px-4 py-2 ${
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-card border"
                          }`}
                        >
                          <p className="text-sm leading-relaxed">{msg.content}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {msg.role === "user" && (
                        <Avatar className="w-8 h-8 shrink-0">
                          <AvatarFallback>U</AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}

                  {iterateMutation.isPending && (
                    <div className="flex gap-3 justify-start">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-primary text-primary-foreground">AI</AvatarFallback>
                      </Avatar>
                      <div className="bg-card border rounded-lg px-4 py-2">
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
              </div>
            )}

            {/* Input Area - changes based on conversation state */}
            <FormField
              control={form.control}
              name="task"
              render={({ field }) => (
                <FormItem>
                  {!preMeetingSession && (
                    <>
                      <FormLabel className="text-base font-semibold">Your Strategic Challenge or Question</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., What steps should a company take today to prepare for the emergence of AGI within the next decade?"
                          className="min-h-32 resize-none text-base"
                          {...field}
                          data-testid="textarea-task"
                        />
                      </FormControl>
                    </>
                  )}
                  {preMeetingSession && (
                    <div className="flex gap-2 items-end">
                      <Textarea
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="Type your response..."
                        className="resize-none min-h-16"
                        rows={2}
                        disabled={iterateMutation.isPending || completeMutation.isPending}
                        data-testid="textarea-response"
                      />
                      <div className="flex flex-col gap-2">
                        <Button
                          type="button"
                          onClick={handleSendMessage}
                          disabled={!userInput.trim() || iterateMutation.isPending || completeMutation.isPending}
                          size="icon"
                          className="shrink-0"
                          data-testid="button-send"
                        >
                          {iterateMutation.isPending || completeMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          onClick={handleCancelConversation}
                          variant="outline"
                          size="icon"
                          className="shrink-0"
                          disabled={iterateMutation.isPending || completeMutation.isPending}
                          data-testid="button-cancel"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit Button - only show for initial question */}
            {!preMeetingSession && (
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <Button
                  type="submit"
                  className="w-full"
                  disabled={initPreMeetingMutation.isPending || isLoading || selectedAgents.length === 0}
                  data-testid="button-run-meeting"
                >
                  {initPreMeetingMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Starting Conversation...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Submit
                    </>
                  )}
                </Button>
              </motion.div>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
