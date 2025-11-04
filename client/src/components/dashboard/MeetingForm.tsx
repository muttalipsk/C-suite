import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AI_AGENTS } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Users, Lightbulb, ArrowRight, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";

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

export function MeetingForm({ onSubmit, isLoading = false, selectedAgents }: MeetingFormProps) {
  const [refinementSuggestions, setRefinementSuggestions] = useState<string[]>([]);
  const [isRefining, setIsRefining] = useState(false);

  const form = useForm<MeetingFormData>({
    defaultValues: {
      task: "",
      meetingType: "board",
      turns: 1,
      selectedAgents: [],
    },
  });

  // Watch task field for refinement
  const taskValue = form.watch("task");

  useEffect(() => {
    if (!taskValue || taskValue.length < 5) {
      setRefinementSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsRefining(true);
      try {
        // Use first selected agent for context, or default to Sam_Altman
        const agent = selectedAgents[0] || "Sam_Altman";
        
        const response = await fetch("/api/refine-question", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: taskValue,
            agent: agent,
            runId: "meeting-form", // Placeholder run ID for meeting context
          }),
        });

        const result = await response.json();

        if (result.needs_refinement && result.suggestions?.length > 0) {
          setRefinementSuggestions(result.suggestions);
        } else {
          setRefinementSuggestions([]);
        }
      } catch (error) {
        console.error("Refinement error:", error);
        setRefinementSuggestions([]);
      } finally {
        setIsRefining(false);
      }
    }, 1500); // Wait 1.5 seconds after user stops typing

    return () => clearTimeout(timer);
  }, [taskValue, selectedAgents]);

  const handleUseSuggestion = (suggestion: string) => {
    form.setValue("task", suggestion);
    setRefinementSuggestions([]);
  };

  const handleSubmit = (data: MeetingFormData) => {
    console.log("🟢 MeetingForm.handleSubmit called");
    console.log("  - meetingType:", data.meetingType);
    console.log("  - selectedAgents:", selectedAgents);
    console.log("  - task:", data.task?.substring(0, 50) + "...");
    
    const submittedData = { ...data, selectedAgents };
    console.log("🟢 Calling onSubmit with:", {
      meetingType: submittedData.meetingType,
      agentCount: submittedData.selectedAgents.length
    });
    
    onSubmit(submittedData);
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
                  
                  {/* Refinement Suggestions with Animations */}
                  <AnimatePresence mode="wait">
                    {isRefining && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center gap-2 text-sm text-muted-foreground mt-2"
                      >
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="animate-pulse">Analyzing your question...</span>
                      </motion.div>
                    )}
                    
                    {refinementSuggestions.length > 0 && !isRefining && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="mt-3 p-5 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent border-2 border-primary/20 rounded-xl space-y-3 shadow-md backdrop-blur-sm" 
                        data-testid="refinement-suggestions"
                      >
                        <motion.div 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1, duration: 0.2 }}
                          className="flex items-center gap-2 text-sm font-semibold bg-gradient-to-r from-primary to-accent-foreground bg-clip-text text-transparent"
                        >
                          <Lightbulb className="w-5 h-5 animate-pulse text-primary" />
                          <span>AI-Suggested Improvements</span>
                        </motion.div>
                        
                        <div className="space-y-2.5">
                          {refinementSuggestions.map((suggestion, idx) => (
                            <motion.button
                              key={idx}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.15 + idx * 0.1, duration: 0.3, ease: "easeOut" }}
                              whileHover={{ scale: 1.01, x: 4, transition: { duration: 0.2 } }}
                              whileTap={{ scale: 0.98 }}
                              type="button"
                              onClick={() => handleUseSuggestion(suggestion)}
                              className="w-full text-left p-4 bg-gradient-to-r from-background to-primary/5 border-2 border-primary/30 rounded-lg hover:border-primary/50 hover:shadow-md transition-all group"
                              data-testid={`button-suggestion-${idx}`}
                            >
                              <div className="flex items-start gap-3">
                                <ArrowRight className="w-5 h-5 mt-0.5 text-primary shrink-0 group-hover:translate-x-1 transition-transform" />
                                <span className="text-sm text-foreground font-medium leading-relaxed">{suggestion}</span>
                              </div>
                            </motion.button>
                          ))}
                        </div>
                        
                        <motion.p 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.4, duration: 0.2 }}
                          className="text-xs text-muted-foreground"
                        >
                          Click a suggestion to use it, or continue with your original question
                        </motion.p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
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
                disabled={isLoading || selectedAgents.length === 0}
                data-testid="button-run-meeting"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating Recommendations...
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