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
  selectedAgents: string[];
}

export function MeetingForm({ onSubmit, isLoading = false, selectedAgents }: MeetingFormProps) {

  const form = useForm<MeetingFormData>({
    defaultValues: {
      task: "",
      meetingType: "board",
      turns: 1,
    },
  });

  const handleSubmit = (data: MeetingFormData) => {
    console.log("MeetingForm handleSubmit - selectedAgents from props:", selectedAgents);
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

            {/* Selected Agents Display */}
            {selectedAgents.length > 0 && (
              <div className="space-y-2">
                <span className="text-sm font-medium text-muted-foreground">Selected Advisors:</span>
                <div className="flex flex-wrap gap-2">
                  {selectedAgents.map(key => {
                    const agent = AI_AGENTS[key as keyof typeof AI_AGENTS];
                    return (
                      <div key={key} className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg border border-primary/20">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={agent.avatar} alt={agent.name} />
                          <AvatarFallback>{agent.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{agent.name}</span>
                        <Badge variant="outline" className="text-xs">{agent.company}</Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
