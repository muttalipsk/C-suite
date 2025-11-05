import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AI_AGENTS } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Users, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";
import { PreMeetingConversation } from "./PreMeetingConversation";

interface MeetingFormData {
  task: string;
  meetingType: "board" | "email" | "chat";
  selectedAgents: string[];
  turns: number;
}

interface MeetingFormProps {
  onSubmit: (data: MeetingFormData) => void;
  isLoading?: boolean;
  selectedAgents: string[];
}

interface PreMeetingSession {
  sessionId: string;
  accuracy: number;
  counterQuestion: string | null;
  isReady: boolean;
}

export function MeetingForm({ onSubmit, isLoading = false, selectedAgents }: MeetingFormProps) {
  const [preMeetingSession, setPreMeetingSession] = useState<PreMeetingSession | null>(null);
  const form = useForm<MeetingFormData>({
    defaultValues: {
      task: "",
      meetingType: "board",
      turns: 1,
      selectedAgents: [],
    },
  });

  const initPreMeetingMutation = useMutation({
    mutationFn: async (data: { question: string; agents: string[]; meetingType: string }) => {
      const response = await apiRequest("POST", "/api/pre-meeting/init", data);
      const result = await response.json();
      return result as PreMeetingSession;
    },
    onSuccess: (data) => {
      setPreMeetingSession(data);
    },
  });

  const handleSubmit = (data: MeetingFormData) => {
    console.log("🟢 MeetingForm.handleSubmit called - Starting pre-meeting conversation");
    console.log("  - meetingType:", data.meetingType);
    console.log("  - selectedAgents:", selectedAgents);
    console.log("  - task:", data.task?.substring(0, 50) + "...");
    
    // Start pre-meeting conversation
    initPreMeetingMutation.mutate({
      question: data.task,
      agents: selectedAgents,
      meetingType: data.meetingType,
    });
  };

  const handlePreMeetingComplete = (runId: string, recommendations: any) => {
    console.log("🟢 Pre-meeting completed, meeting started");
    // Trigger the parent's onSubmit with the recommendations
    // This will update the UI to show the results
    onSubmit({
      task: form.getValues("task"),
      meetingType: form.getValues("meetingType"),
      selectedAgents,
      turns: 1,
    });
  };

  const handleCancelPreMeeting = () => {
    setPreMeetingSession(null);
  };

  // If in pre-meeting mode, show the conversation component
  if (preMeetingSession) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Pre-Meeting Conversation
          </CardTitle>
          <CardDescription>
            Let me ask a few questions to better understand your needs and provide more accurate recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PreMeetingConversation
            sessionId={preMeetingSession.sessionId}
            initialCounterQuestion={preMeetingSession.counterQuestion}
            isReady={preMeetingSession.isReady}
            onComplete={handlePreMeetingComplete}
            onCancel={handleCancelPreMeeting}
          />
        </CardContent>
      </Card>
    );
  }

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
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Meeting Type */}
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

            {/* Task Input */}
            <FormField
              control={form.control}
              name="task"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Strategic Challenge or Question</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Example: We're considering implementing AI across our operations. What strategy should we adopt for the next quarter considering our limited AI expertise?"
                      className="min-h-48 resize-none"
                      {...field}
                      data-testid="input-task"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}