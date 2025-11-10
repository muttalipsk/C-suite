import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";

type MCQQuestion = {
  id: number;
  category: string;
  question: string;
  choices: string[];
};

type MCQAnswer = {
  question_id: number;
  question: string;
  selected_choice: string;
};

export default function CreateDigitalTwinPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  // Multi-step state
  const [step, setStep] = useState(1); // 1: Scrape, 2: MCQs, 3: Email (optional), 4: Create
  const [companyData, setCompanyData] = useState<any>(null);
  const [questions, setQuestions] = useState<MCQQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [emailSamples, setEmailSamples] = useState("");
  
  // Step 1: Scrape company website
  const scrapeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/digital-twin/scrape");
      return await res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setCompanyData(data.company_data);
        generateMCQMutation.mutate(data.company_data);
      } else {
        toast({
          title: "Website scraping incomplete",
          description: "Proceeding with limited context. Generating questions...",
          variant: "default"
        });
        generateMCQMutation.mutate({});
      }
    },
    onError: (error: any) => {
      toast({
        title: "Scraping failed",
        description: "Continuing anyway. Generating questions...",
        variant: "default"
      });
      generateMCQMutation.mutate({});
    }
  });
  
  // Step 2: Generate MCQ questions
  const generateMCQMutation = useMutation({
    mutationFn: async (companyDataParam: any) => {
      const res = await apiRequest("POST", "/api/digital-twin/generate-mcq", { company_data: companyDataParam });
      return await res.json();
    },
    onSuccess: (data) => {
      if (data.success && data.questions) {
        setQuestions(data.questions);
        setStep(2);
        toast({
          title: "Questions generated!",
          description: `${data.questions.length} personalized questions ready.`,
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to generate questions. Please try again.",
          variant: "destructive"
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate questions",
        variant: "destructive"
      });
    }
  });
  
  // Step 4: Create digital twin
  const createTwinMutation = useMutation({
    mutationFn: async () => {
      const mcqAnswers: MCQAnswer[] = Object.entries(answers).map(([questionId, choice]) => {
        const question = questions.find(q => q.id === parseInt(questionId));
        return {
          question_id: parseInt(questionId),
          question: question?.question || "",
          selected_choice: choice
        };
      });
      
      const res = await apiRequest("POST", "/api/digital-twin/create", {
        mcq_answers: mcqAnswers,
        email_samples: emailSamples.trim() || null
      });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "🎉 Digital Twin Created!",
        description: `${data.twin.twinName} is now available for your team.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/twins'] });
      navigate("/dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create digital twin",
        variant: "destructive"
      });
    }
  });
  
  // Handle answer selection
  const handleAnswerChange = (questionId: number, choice: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: choice }));
  };
  
  // Start the process
  const handleStart = () => {
    scrapeMutation.mutate();
  };
  
  // Navigate to email step
  const handleContinueToEmail = () => {
    if (Object.keys(answers).length < 50) {
      toast({
        title: "Incomplete answers",
        description: `Please answer all 50 questions. ${50 - Object.keys(answers).length} remaining.`,
        variant: "destructive"
      });
      return;
    }
    setStep(3);
  };
  
  // Skip email and create
  const handleSkipEmail = () => {
    createTwinMutation.mutate();
  };
  
  // Create with email
  const handleCreateWithEmail = () => {
    createTwinMutation.mutate();
  };
  
  // Group questions by category
  const groupedQuestions = questions.reduce((acc, q) => {
    if (!acc[q.category]) {
      acc[q.category] = [];
    }
    acc[q.category].push(q);
    return acc;
  }, {} as Record<string, MCQQuestion[]>);
  
  const categories = Object.keys(groupedQuestions);
  const answeredCount = Object.keys(answers).length;
  const progressPercent = (answeredCount / 50) * 100;
  
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
          Create Your Digital Twin
        </h1>
        <p className="text-muted-foreground">
          Answer 50 personalized questions to create an AI replica of your decision-making style
        </p>
      </div>
      
      {/* Step Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              {step > 1 ? <CheckCircle2 className="w-5 h-5" /> : "1"}
            </div>
            <span className="text-sm font-medium">Generate</span>
          </div>
          <div className="flex-1 h-px bg-border mx-4" />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              {step > 2 ? <CheckCircle2 className="w-5 h-5" /> : "2"}
            </div>
            <span className="text-sm font-medium">Answer</span>
          </div>
          <div className="flex-1 h-px bg-border mx-4" />
          <div className={`flex items-center gap-2 ${step >= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              {step > 3 ? <CheckCircle2 className="w-5 h-5" /> : "3"}
            </div>
            <span className="text-sm font-medium">Create</span>
          </div>
        </div>
      </div>
      
      {/* Step 1: Initial scraping */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Ready to Create Your Digital Twin?
            </CardTitle>
            <CardDescription>
              We'll analyze your company website and profile to generate 50 personalized questions.
              This takes about 30 seconds.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleStart}
              disabled={scrapeMutation.isPending || generateMCQMutation.isPending}
              className="w-full"
              size="lg"
              data-testid="button-start-digital-twin"
            >
              {(scrapeMutation.isPending || generateMCQMutation.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {scrapeMutation.isPending ? "Analyzing company website..." : 
               generateMCQMutation.isPending ? "Generating questions..." : 
               "Start Creating My Digital Twin"}
            </Button>
          </CardContent>
        </Card>
      )}
      
      {/* Step 2: MCQ Questions */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Progress */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  Answer 50 Questions
                </CardTitle>
                <span className="text-sm font-medium text-muted-foreground">
                  {answeredCount} / 50 completed
                </span>
              </div>
              <Progress value={progressPercent} className="mt-2" />
            </CardHeader>
          </Card>
          
          {/* Questions by Category */}
          {categories.map((category, idx) => (
            <Card key={idx}>
              <CardHeader>
                <CardTitle className="text-base">{category}</CardTitle>
                <CardDescription>
                  {groupedQuestions[category].filter(q => answers[q.id]).length} / {groupedQuestions[category].length} answered
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {groupedQuestions[category].map((q, qIdx) => (
                  <div key={q.id} className="space-y-3">
                    <Label className="text-sm font-medium">
                      {qIdx + 1}. {q.question}
                    </Label>
                    <RadioGroup
                      value={answers[q.id] || ""}
                      onValueChange={(value) => handleAnswerChange(q.id, value)}
                      data-testid={`mcq-question-${q.id}`}
                    >
                      {q.choices.map((choice, cIdx) => (
                        <div key={cIdx} className="flex items-center space-x-2">
                          <RadioGroupItem 
                            value={choice} 
                            id={`q${q.id}-c${cIdx}`}
                            data-testid={`mcq-choice-${q.id}-${cIdx}`}
                          />
                          <Label 
                            htmlFor={`q${q.id}-c${cIdx}`}
                            className="font-normal cursor-pointer"
                          >
                            {choice}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
          
          {/* Continue Button */}
          <Card>
            <CardContent className="pt-6">
              <Button 
                onClick={handleContinueToEmail}
                disabled={answeredCount < 50}
                className="w-full"
                size="lg"
                data-testid="button-continue-to-email"
              >
                Continue to Optional Email Analysis
              </Button>
              {answeredCount < 50 && (
                <p className="text-sm text-muted-foreground text-center mt-2">
                  Please answer all 50 questions to continue
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Step 3: Optional Email Samples */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Email Writing Style (Optional)</CardTitle>
            <CardDescription>
              Paste 10-20 sample emails to improve your digital twin's communication style.
              This step is optional - you can skip it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Paste your email samples here (optional)..."
              value={emailSamples}
              onChange={(e) => setEmailSamples(e.target.value)}
              rows={10}
              data-testid="input-email-samples"
            />
            <div className="flex gap-3">
              <Button 
                onClick={handleSkipEmail}
                variant="outline"
                className="flex-1"
                disabled={createTwinMutation.isPending}
                data-testid="button-skip-email"
              >
                Skip & Create Twin
              </Button>
              <Button 
                onClick={handleCreateWithEmail}
                className="flex-1"
                disabled={createTwinMutation.isPending}
                data-testid="button-create-with-email"
              >
                {createTwinMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Create Digital Twin
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
