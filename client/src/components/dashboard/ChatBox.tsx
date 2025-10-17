import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AI_AGENTS } from "@shared/schema";

interface Message {
  sender: "user" | "agent";
  content: string;
  timestamp: Date;
}

interface ChatBoxProps {
  agentKey: string;
  agentName: string;
  runId: string;
}

export function ChatBox({ agentKey, agentName, runId }: ChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      sender: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages([...messages, userMessage]);
    setInput("");
    setIsLoading(true);

    // Simulate AI response (will be replaced with actual API call)
    setTimeout(() => {
      const agentMessage: Message = {
        sender: "agent",
        content: "This is a placeholder response. Will be connected to the AI backend in the integration phase.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, agentMessage]);
      setIsLoading(false);
    }, 1000);
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
                  <p className="text-sm leading-relaxed">{msg.content}</p>
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
