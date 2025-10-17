import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, type InsertUser } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, User, Building, Briefcase, Target } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface SignupFormProps {
  onSuccess: () => void;
}

export function SignupForm({ onSuccess }: SignupFormProps) {
  const [step, setStep] = useState(1);
  const [photoPreview, setPhotoPreview] = useState<string>("");

  const form = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      email: "",
      password: "",
      name: "",
      photo: "",
      companyName: "",
      designation: "",
      roleDescription: "",
      productExpectations: "",
      companyWebsite: "",
      roleDetails: "",
      goalOneYear: "",
      goalFiveYears: "",
    },
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPhotoPreview(result);
        form.setValue("photo", result);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: InsertUser) => {
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Signup failed");
      }

      onSuccess();
    } catch (error: any) {
      form.setError("root", {
        message: error.message || "Signup failed. Please try again.",
      });
    }
  };

  const nextStep = async () => {
    const fields = step === 1 
      ? ["email", "password", "name", "photo"] as const
      : step === 2 
      ? ["companyName", "designation", "roleDescription", "productExpectations", "companyWebsite", "roleDetails"] as const
      : [];

    const isValid = await form.trigger(fields);
    if (isValid) setStep(step + 1);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl">Join AI Leaders Boardroom</CardTitle>
        <CardDescription>Step {step} of 3 - {
          step === 1 ? "Personal Information" : 
          step === 2 ? "Professional Details" : 
          "Your Goals"
        }</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Progress indicator */}
        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {step === 1 && (
              <div className="space-y-4">
                {/* Photo Upload */}
                <div className="flex flex-col items-center gap-4">
                  <Avatar className="w-32 h-32">
                    <AvatarImage src={photoPreview} />
                    <AvatarFallback>
                      <User className="w-16 h-16 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                  <FormField
                    control={form.control}
                    name="photo"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handlePhotoChange}
                              className="hidden"
                              id="photo-upload"
                              data-testid="input-photo"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => document.getElementById("photo-upload")?.click()}
                              data-testid="button-upload-photo"
                            >
                              <Upload className="w-4 h-4 mr-2" />
                              Upload Photo
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} data-testid="input-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="john@company.com" {...field} data-testid="input-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} data-testid="input-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="button" onClick={nextStep} className="w-full" data-testid="button-next-step-1">
                  Continue
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Inc." {...field} data-testid="input-company" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="designation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Designation</FormLabel>
                      <FormControl>
                        <Input placeholder="Chief Technology Officer" {...field} data-testid="input-designation" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="roleDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brief Description About Your Role</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe your current role and responsibilities..." 
                          className="min-h-20"
                          {...field} 
                          data-testid="input-role-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="productExpectations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What Are You Looking From This Product?</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Share your expectations and what you hope to achieve..." 
                          className="min-h-20"
                          {...field} 
                          data-testid="input-expectations"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="companyWebsite"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Website URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://www.company.com" {...field} data-testid="input-website" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="roleDetails"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Details About Your Current Role</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Provide more details about your responsibilities and challenges..." 
                          className="min-h-20"
                          {...field} 
                          data-testid="input-role-details"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1" data-testid="button-back-step-2">
                    Back
                  </Button>
                  <Button type="button" onClick={nextStep} className="flex-1" data-testid="button-next-step-2">
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="goalOneYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4" />
                          Professional Goal for Next 1 Year
                        </div>
                      </FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="What do you want to achieve in the next year?" 
                          className="min-h-24"
                          {...field} 
                          data-testid="input-goal-1year"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="goalFiveYears"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4" />
                          Professional Goal for Next 5 Years
                        </div>
                      </FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="What is your long-term vision?" 
                          className="min-h-24"
                          {...field} 
                          data-testid="input-goal-5years"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setStep(2)} className="flex-1" data-testid="button-back-step-3">
                      Back
                    </Button>
                    <Button 
                      type="submit" 
                      className="flex-1" 
                      disabled={form.formState.isSubmitting}
                      data-testid="button-signup"
                    >
                      {form.formState.isSubmitting ? "Creating Account..." : "Create Account"}
                    </Button>
                  </div>
                  {form.formState.errors.root && (
                    <p className="text-sm text-destructive text-center">{form.formState.errors.root.message}</p>
                  )}
                </div>
              </div>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
