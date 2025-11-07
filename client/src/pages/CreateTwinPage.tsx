import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Sparkles, Send, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";

interface Question {
  category: string;
  question: string;
}

interface QuestionAnswer {
  question: string;
  answer: string;
  category: string;
}

export default function CreateTwinPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  // Interview state
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [answers, setAnswers] = useState<QuestionAnswer[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Fetch user profile and generate personalized questions
  useEffect(() => {
    const generateQuestions = async () => {
      try {
        setIsLoadingQuestions(true);
        
        // Get user profile
        const userResponse = await fetch("/api/auth/me");
        if (!userResponse.ok) {
          throw new Error("Failed to fetch user profile");
        }
        const userData = await userResponse.json();
        
        // Generate 20 personalized questions based on user profile
        const questionResponse = await fetch("/api/persona-interview/generate-questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_profile: {
              name: userData.name || "",
              company: userData.companyName || "",  // Fixed: use companyName
              title: userData.designation || "",    // Fixed: use designation
              industry: userData.industry || "",
              goalOneYear: userData.goalOneYear || "",
              goalFiveYears: userData.goalFiveYears || "",
            }
          }),
        });
        
        if (!questionResponse.ok) {
          throw new Error("Failed to generate questions");
        }
        
        const data = await questionResponse.json();
        setQuestions(data.questions || []);
        
        toast({
          title: "Questions Generated",
          description: `${data.questions?.length || 0} personalized questions are ready for you.`,
        });
      } catch (error: any) {
        console.error("Error generating questions:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to generate questions",
          variant: "destructive",
        });
        navigate("/dashboard");
      } finally {
        setIsLoadingQuestions(false);
      }
    };
    
    generateQuestions();
  }, [toast, navigate]);
  
  const handleNextQuestion = () => {
    if (!currentAnswer.trim()) {
      toast({
        title: "Answer Required",
        description: "Please provide an in-depth answer before proceeding.",
        variant: "destructive",
      });
      return;
    }
    
    // Save current answer
    const questionAnswer: QuestionAnswer = {
      question: questions[currentQuestionIndex].question,
      answer: currentAnswer,
      category: questions[currentQuestionIndex].category,
    };
    setAnswers(prev => [...prev, questionAnswer]);
    
    // Move to next question
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setCurrentAnswer("");
    }
  };
  
  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      // Restore previous answer
      const previousAnswer = answers[currentQuestionIndex - 1];
      if (previousAnswer) {
        setCurrentAnswer(previousAnswer.answer);
        // Remove the previous answer from the list
        setAnswers(prev => prev.slice(0, -1));
      }
    }
  };
  
  const handleFinishInterview = async () => {
    if (!currentAnswer.trim()) {
      toast({
        title: "Answer Required",
        description: "Please provide an in-depth answer before finishing.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Save final answer
      const finalAnswer: QuestionAnswer = {
        question: questions[currentQuestionIndex].question,
        answer: currentAnswer,
        category: questions[currentQuestionIndex].category,
      };
      const allAnswers = [...answers, finalAnswer];
      
      // Create persona from all 20 answers
      const response = await fetch("/api/persona-interview/create-persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: allAnswers,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create persona");
      }
      
      toast({
        title: "Persona Created Successfully",
        description: "Your digital twin has been created from your 20 in-depth answers.",
      });
      
      navigate("/twins");
    } catch (error: any) {
      console.error("Error creating persona:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create persona",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  
  if (isLoadingQuestions) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl border-2 shadow-2xl">
          <CardContent className="flex flex-col items-center justify-center p-12">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Generating Your Personalized Questions</h3>
            <p className="text-sm text-muted-foreground text-center">
              AI is analyzing your profile to create 20 in-depth questions tailored just for you...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl border-2 shadow-2xl">
          <CardContent className="flex flex-col items-center justify-center p-12">
            <p className="text-muted-foreground">No questions generated. Please try again.</p>
            <Button onClick={() => navigate("/dashboard")} className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="max-w-4xl mx-auto py-8">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="mb-4"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent-foreground bg-clip-text text-transparent">
                Create Your Digital Twin
              </h1>
              <p className="text-muted-foreground mt-2">
                Answer 20 in-depth questions to create a personalized AI persona
              </p>
            </div>
            <Badge variant="secondary" className="text-lg px-4 py-2">
              Question {currentQuestionIndex + 1} of {questions.length}
            </Badge>
          </div>
          
          <Progress value={progress} className="mt-4 h-2" />
        </div>
        
        {/* Question Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestionIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-2 shadow-2xl hover:shadow-3xl transition-all">
              <CardHeader className="bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pb-6">
                <div className="flex items-start gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent-foreground/30 rounded-full blur-md"></div>
                    <div className="relative w-12 h-12 bg-gradient-to-br from-primary to-accent-foreground rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                      {currentQuestionIndex + 1}
                    </div>
                  </div>
                  <div className="flex-1">
                    <Badge variant="outline" className="mb-2">
                      {currentQuestion?.category || "General"}
                    </Badge>
                    <CardTitle className="text-xl leading-relaxed">
                      {currentQuestion?.question}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Please provide an in-depth, detailed answer. The more comprehensive your response, the better your digital twin will represent you.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-6">
                <Textarea
                  value={currentAnswer}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  placeholder="Type your in-depth answer here... (minimum 50 characters recommended)"
                  className="min-h-[200px] text-base resize-none"
                  data-testid="input-answer"
                  autoFocus
                />
                
                <div className="mt-4 text-sm text-muted-foreground">
                  Character count: {currentAnswer.length}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
        
        {/* Navigation Buttons */}
        <div className="mt-6 flex items-center justify-between gap-4">
          <Button
            variant="outline"
            onClick={handlePreviousQuestion}
            disabled={currentQuestionIndex === 0 || isSubmitting}
            className="flex-1"
            data-testid="button-previous"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous Question
          </Button>
          
          {!isLastQuestion ? (
            <Button
              onClick={handleNextQuestion}
              disabled={!currentAnswer.trim() || isSubmitting}
              className="flex-1 bg-gradient-to-r from-primary to-accent-foreground hover:from-primary/90 hover:to-accent-foreground/90"
              data-testid="button-next"
            >
              Next Question
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleFinishInterview}
              disabled={!currentAnswer.trim() || isSubmitting}
              className="flex-1 bg-gradient-to-r from-primary to-accent-foreground hover:from-primary/90 hover:to-accent-foreground/90"
              data-testid="button-finish"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Persona...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Finish & Create Persona
                </>
              )}
            </Button>
          )}
        </div>
        
        {/* Answered Questions Summary */}
        {answers.length > 0 && (
          <Card className="mt-6 border">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Answered Questions ({answers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {answers.map((qa, index) => (
                    <div key={index} className="text-sm p-3 bg-muted/30 rounded-md">
                      <div className="font-medium text-foreground mb-1">
                        Q{index + 1}: {qa.question.substring(0, 80)}...
                      </div>
                      <div className="text-muted-foreground text-xs">
                        A: {qa.answer.substring(0, 100)}...
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
