import { useState } from "react";
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
import { Sparkles, Users } from "lucide-react";
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
}

export function MeetingForm({ onSubmit, isLoading = false }: MeetingFormProps) {
  const [selectedAgents, setSelectedAgents] = useState<string[]>(Object.keys(AI_AGENTS));

  const form = useForm<MeetingFormData>({
    defaultValues: {
      task: "",
      meetingType: "board",
      selectedAgents: Object.keys(AI_AGENTS),
      turns: 1,
    },
  });

  const toggleAgent = (agentKey: string) => {
    const newSelection = selectedAgents.includes(agentKey)
      ? selectedAgents.filter(k => k !== agentKey)
      : [...selectedAgents, agentKey];
    setSelectedAgents(newSelection);
    form.setValue("selectedAgents", newSelection);
  };

  const toggleAll = () => {
    if (selectedAgents.length === Object.keys(AI_AGENTS).length) {
      setSelectedAgents([]);
      form.setValue("selectedAgents", []);
    } else {
      const allKeys = Object.keys(AI_AGENTS);
      setSelectedAgents(allKeys);
      form.setValue("selectedAgents", allKeys);
    }
  };

  const handleSubmit = (data: MeetingFormData) => {
    onSubmit({ ...data, selectedAgents });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Run AI Boardroom Meeting
        </CardTitle>
        <CardDescription>
          Get strategic recommendations from AI industry leaders
        </CardDescription>
      </CardHeader>
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
                      defaultValue={field.value}
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
                      className="min-h-32 resize-none"
                      {...field}
                      data-testid="input-task"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Agent Selection */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <FormLabel className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Select AI Leaders
                </FormLabel>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={toggleAll}
                  data-testid="button-toggle-all"
                >
                  {selectedAgents.length === Object.keys(AI_AGENTS).length ? "Deselect All" : "Select All"}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(AI_AGENTS).map(([key, agent]) => (
                  <div
                    key={key}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer hover-elevate ${
                      selectedAgents.includes(key) ? "border-primary bg-primary/5" : "border-border"
                    }`}
                    onClick={() => toggleAgent(key)}
                    data-testid={`agent-card-${key}`}
                  >
                    <Checkbox
                      checked={selectedAgents.includes(key)}
                      onCheckedChange={() => toggleAgent(key)}
                      data-testid={`checkbox-${key}`}
                    />
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={agent.avatar} alt={agent.name} />
                      <AvatarFallback>{agent.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{agent.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{agent.company}</p>
                    </div>
                  </div>
                ))}
              </div>

              {selectedAgents.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm text-muted-foreground">Selected:</span>
                  {selectedAgents.map(key => (
                    <Badge key={key} variant="secondary">
                      {AI_AGENTS[key as keyof typeof AI_AGENTS].name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || selectedAgents.length === 0}
              data-testid="button-run-meeting"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {isLoading ? "Generating Recommendations..." : "Run Meeting"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
