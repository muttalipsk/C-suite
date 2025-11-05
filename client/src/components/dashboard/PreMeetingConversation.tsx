
import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";
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
  onComplete: (runId: string, recommendations: any) => void;
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

      if (data.counterQuestion && data.counterQuestion.length > 0) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.counterQuestion,
            timestamp: new Date().toISOString(),
          },
        ]);
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
      onComplete(data.runId, data.recommendations);
    },
  });

  const handleSendResponse = async () => {
    if (!userInput.trim() || iterateMutation.isPending) return;

    const currentInput = userInput;
    setUserInput("");

    // Add user message to chat
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: currentInput,
        timestamp: new Date().toISOString(),
      },
    ]);

    // Send to backend
    await iterateMutation.mutateAsync(currentInput);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendResponse();
    }
  };

  // Auto-complete when ready
  useEffect(() => {
    if (isReady && !completeMutation.isPending) {
      completeMutation.mutate();
    }
  }, [isReady]);

  return (
    <div className="space-y-4">
      {/* Messages Area */}
      <div className="max-h-96 overflow-y-auto space-y-4 pr-2 border rounded-lg p-4 bg-muted/20">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Starting conversation...
          </p>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              data-testid={`message-${msg.role}-${idx}`}
            >
              {msg.role === "assistant" && (
                <Avatar className="w-8 h-8">
                  <AvatarFallback>AI</AvatarFallback>
                </Avatar>
              )}

              <div className={`flex flex-col gap-1 max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
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
                <Avatar className="w-8 h-8">
                  <AvatarFallback>U</AvatarFallback>
                </Avatar>
              )}
            </div>
          ))
        )}
        {iterateMutation.isPending && (
          <div className="flex gap-3 justify-start">
            <Avatar className="w-8 h-8">
              <AvatarFallback>AI</AvatarFallback>
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

      {/* Input Area */}
      {!isReady && (
        <div className="flex gap-2">
          <Textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your response..."
            className="resize-none min-h-10"
            rows={2}
            disabled={iterateMutation.isPending || completeMutation.isPending}
            data-testid="input-pre-meeting-response"
          />
          <Button
            onClick={handleSendResponse}
            disabled={!userInput.trim() || iterateMutation.isPending || completeMutation.isPending}
            size="icon"
            className="shrink-0"
            data-testid="button-send-response"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Status Message */}
      {completeMutation.isPending && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Starting your meeting...</span>
        </div>
      )}

      {/* Cancel Button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={completeMutation.isPending}
          data-testid="button-cancel-pre-meeting"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
