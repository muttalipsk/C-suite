import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Loader2, Send, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface PreMeetingConversationProps {
  sessionId: string;
  initialAccuracy: number;
  initialCounterQuestion: string | null;
  isReady: boolean;
  onComplete: (runId: string, recommendations: any) => void;
  onCancel: () => void;
}

export function PreMeetingConversation({
  sessionId,
  initialAccuracy,
  initialCounterQuestion,
  isReady: initialIsReady,
  onComplete,
  onCancel,
}: PreMeetingConversationProps) {
  const [messages, setMessages] = useState<Message[]>([
    ...(initialCounterQuestion
      ? [{
          role: "assistant" as const,
          content: initialCounterQuestion,
          timestamp: new Date().toISOString(),
        }]
      : []),
  ]);
  const [userInput, setUserInput] = useState("");
  const [accuracy, setAccuracy] = useState(initialAccuracy);
  const [isReady, setIsReady] = useState(initialIsReady);

  const iterateMutation = useMutation({
    mutationFn: async (userResponse: string) => {
      const response = await apiRequest("/api/pre-meeting/iterate", {
        method: "POST",
        body: JSON.stringify({ sessionId, userResponse }),
      });
      const data = await response.json();
      return data as {
        accuracy: number;
        counterQuestion: string | null;
        isReady: boolean;
      };
    },
    onSuccess: (data) => {
      setAccuracy(data.accuracy);
      setIsReady(data.isReady);

      if (data.counterQuestion) {
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
      const response = await apiRequest("/api/pre-meeting/complete", {
        method: "POST",
        body: JSON.stringify({ sessionId }),
      });
      const data = await response.json();
      return data as {
        runId: string;
        recommendations: any;
      };
    },
    onSuccess: (data) => {
      onComplete(data.runId, data.recommendations);
    },
  });

  const handleSendMessage = () => {
    if (!userInput.trim() || iterateMutation.isPending) return;

    const userMessage: Message = {
      role: "user",
      content: userInput,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    iterateMutation.mutate(userInput);
    setUserInput("");
  };

  const handleProceedToMeeting = () => {
    completeMutation.mutate();
  };

  const accuracyPercentage = Math.round(accuracy * 100);

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header with accuracy indicator */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Question Accuracy</span>
            <span className="text-sm font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {accuracyPercentage}%
            </span>
          </div>
          <Progress value={accuracyPercentage} className="h-2" />
          {accuracyPercentage >= 80 && (
            <p className="text-xs text-green-600 mt-1 font-medium">
              ✓ Ready for meeting
            </p>
          )}
        </div>
      </div>

      {/* Chat messages */}
      <Card className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[400px]">
        <AnimatePresence initial={false}>
          {messages.map((message, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === "user"
                    ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white"
                    : "bg-muted"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {iterateMutation.isPending && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="bg-muted rounded-lg p-3">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          </motion.div>
        )}
      </Card>

      {/* Input area */}
      {!isReady && (
        <div className="flex gap-2">
          <Textarea
            data-testid="input-pre-meeting-response"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Type your response..."
            className="resize-none"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={iterateMutation.isPending}
          />
          <Button
            data-testid="button-send-response"
            onClick={handleSendMessage}
            disabled={!userInput.trim() || iterateMutation.isPending}
            className="self-end"
          >
            {iterateMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 justify-end">
        <Button
          data-testid="button-cancel-pre-meeting"
          variant="outline"
          onClick={onCancel}
          disabled={completeMutation.isPending}
        >
          Cancel
        </Button>
        {isReady && (
          <Button
            data-testid="button-proceed-to-meeting"
            onClick={handleProceedToMeeting}
            disabled={completeMutation.isPending}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            {completeMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Starting Meeting...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Proceed to Meeting
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
