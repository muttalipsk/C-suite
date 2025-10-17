import { useState } from "react";
import { SignupForm } from "@/components/auth/SignupForm";
import { LoginForm } from "@/components/auth/LoginForm";
import { Button } from "@/components/ui/button";
import { Brain } from "lucide-react";

interface AuthPageProps {
  onAuthSuccess: () => void;
}

export default function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Brain className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold">AI Leaders C-Suite Boardroom</h1>
          </div>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Get personalized strategy recommendations from digital twins of AI industry leaders.
            Expert advisory for C-suite executives.
          </p>
        </div>

        {/* Auth Forms */}
        <div className="space-y-4">
          {mode === "login" ? (
            <>
              <LoginForm onSuccess={onAuthSuccess} />
              <p className="text-center text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Button
                  variant="link"
                  className="p-0 h-auto"
                  onClick={() => setMode("signup")}
                  data-testid="link-signup"
                >
                  Sign up here
                </Button>
              </p>
            </>
          ) : (
            <>
              <SignupForm onSuccess={onAuthSuccess} />
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Button
                  variant="link"
                  className="p-0 h-auto"
                  onClick={() => setMode("login")}
                  data-testid="link-login"
                >
                  Login here
                </Button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
