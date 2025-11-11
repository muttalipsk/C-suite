import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface PreMeetingConversationProps {
  sessionId: string;
  initialCounterQuestion: string | null;
  isReady: boolean;
  onComplete: (runId: string, recommendations: any, preMeetingConversation?: any[]) => void;
  onCancel: () => void;
}

export function PreMeetingConversation({
  sessionId,
  initialCounterQuestion,
  isReady: initialIsReady,
  onComplete,
  onCancel,
}: PreMeetingConversationProps) {
  const [messages, setMessages] = useState<Message[]>(
    initialCounterQuestion
      ? [{
          role: "assistant" as const,
          content: initialCounterQuestion,
          timestamp: new Date().toISOString(),
        }]
      : []
  );
  const [userInput, setUserInput] = useState("");
  const [isReady, setIsReady] = useState(initialIsReady);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const iterateMutation = useMutation({
    mutationFn: async (userResponse: string) => {
      const response = await apiRequest("POST", "/api/pre-meeting/iterate", {
        sessionId,
        userResponse,
      });
      const data = await response.json();
      return data as {
        counterQuestion: string | null;
        isReady: boolean;
      };
    },
    onSuccess: (data) => {
      setIsReady(data.isReady);

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
        sessionId,
      });
      const data = await response.json();
      return data;
    },
    onSuccess: (data) => {
      onComplete(data.runId, data.recommendations, data.preMeetingConversation);
    },
  });

  const handleSendMessage = () => {
    if (!userInput.trim() || iterateMutation.isPending) return;

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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="space-y-4">
      {/* Messages */}
      <div className="space-y-3">
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

      {/* Input area */}
      <div className="flex gap-2 items-end">
        <Textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Type your response..."
          className="resize-none min-h-16"
          rows={2}
          disabled={iterateMutation.isPending || completeMutation.isPending}
        />
        <div className="flex flex-col gap-2">
          <Button
            onClick={handleSendMessage}
            disabled={!userInput.trim() || iterateMutation.isPending || completeMutation.isPending}
            size="icon"
            className="shrink-0"
          >
            {iterateMutation.isPending || completeMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
          <Button
            onClick={onCancel}
            variant="outline"
            size="icon"
            className="shrink-0"
            disabled={iterateMutation.isPending || completeMutation.isPending}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}