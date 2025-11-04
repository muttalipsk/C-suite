import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lightbulb, ArrowRight } from "lucide-react";

interface QuestionRefinementDialogProps {
  open: boolean;
  onClose: (open: boolean) => void;
  originalQuestion: string;
  suggestions: string[];
  onSelectQuestion: (question: string) => void;
}

export function QuestionRefinementDialog({
  open,
  onClose,
  originalQuestion,
  suggestions,
  onSelectQuestion,
}: QuestionRefinementDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" data-testid="dialog-question-refinement">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-primary" />
            Refine Your Question
          </DialogTitle>
          <DialogDescription>
            Based on the AI expert's knowledge, here are some suggested ways to rephrase your question for better results:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Your Original Question:</h4>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">{originalQuestion}</p>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Suggested Refinements:</h4>
            {suggestions.map((suggestion, idx) => (
              <Button
                key={idx}
                variant="outline"
                className="w-full justify-start text-left h-auto p-4 hover-elevate"
                onClick={() => {
                  onSelectQuestion(suggestion);
                  onClose(false);
                }}
                data-testid={`button-suggestion-${idx}`}
              >
                <div className="flex items-start gap-3 w-full">
                  <ArrowRight className="w-4 h-4 mt-1 text-primary shrink-0" />
                  <p className="text-sm flex-1">{suggestion}</p>
                </div>
              </Button>
            ))}
          </div>

          <div className="pt-4 border-t">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                onSelectQuestion(originalQuestion);
                onClose(false);
              }}
              data-testid="button-use-original"
            >
              Continue with Original Question
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
