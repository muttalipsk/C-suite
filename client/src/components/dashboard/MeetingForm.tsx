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
      {selectedAgents.length > 0 && (
        <div className="px-6 pt-6 pb-4 flex flex-wrap gap-2">
          {selectedAgents.map(agentKey => {
            const agent = AI_AGENTS[agentKey as keyof typeof AI_AGENTS];
            return agent ? (
              <Badge key={agentKey} variant="secondary" className="text-xs">
                {agent.name}
              </Badge>
            ) : null;
          })}
        </div>
      )}
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
                  
                  {/* Refinement Suggestions */}
                  {isRefining && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Analyzing your question...</span>
                    </div>
                  )}
                  
                  {refinementSuggestions.length > 0 && !isRefining && (
                    <div className="mt-3 p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-3" data-testid="refinement-suggestions">
                      <div className="flex items-center gap-2 text-sm font-medium text-primary">
                        <Lightbulb className="w-4 h-4" />
                        <span>AI-Suggested Improvements</span>
                      </div>
                      
                      <div className="space-y-2">
                        {refinementSuggestions.map((suggestion, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleUseSuggestion(suggestion)}
                            className="w-full text-left p-3 bg-background border border-border rounded-md hover-elevate active-elevate-2 transition-all"
                            data-testid={`button-suggestion-${idx}`}
                          >
                            <div className="flex items-start gap-2">
                              <ArrowRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                              <span className="text-sm text-foreground">{suggestion}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                      
                      <p className="text-xs text-muted-foreground">
                        Click a suggestion to use it, or continue with your original question
                      </p>
                    </div>
                  )}
                  
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || selectedAgents.length === 0}
              data-testid="button-run-meeting"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {isLoading ? "Generating Recommendations..." : "Submit"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}