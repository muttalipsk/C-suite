import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Upload, Plus, X, ArrowLeft, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

const twinFormSchema = z.object({
  twinName: z.string().min(1, "Twin name is required"),
  companyName: z.string().min(1, "Company name is required"),
  designation: z.string().min(1, "Designation is required"),
  toneStyle: z.string().min(1, "Communication tone is required"),
  riskTolerance: z.string().min(1, "Risk tolerance is required"),
  coreValues: z.string().min(10, "Core values must be at least 10 characters"),
  emojiPreference: z.string().optional(),
  q4Goal: z.string().optional(),
  coreStrategy: z.string().optional(),
});

type TwinFormValues = z.infer<typeof twinFormSchema>;

export default function CreateTwinPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [sampleMessages, setSampleMessages] = useState<string[]>(["", "", ""]);

  const form = useForm<TwinFormValues>({
    resolver: zodResolver(twinFormSchema),
    defaultValues: {
      twinName: "",
      companyName: "",
      designation: "",
      toneStyle: "",
      riskTolerance: "",
      coreValues: "",
      emojiPreference: "None",
      q4Goal: "",
      coreStrategy: "",
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setUploadedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const addSampleMessage = () => {
    setSampleMessages(prev => [...prev, ""]);
  };

  const updateSampleMessage = (index: number, value: string) => {
    setSampleMessages(prev => prev.map((msg, i) => i === index ? value : msg));
  };

  const removeSampleMessage = (index: number) => {
    if (sampleMessages.length > 3) {
      setSampleMessages(prev => prev.filter((_, i) => i !== index));
    }
  };

  const onSubmit = async (data: TwinFormValues) => {
    setIsSubmitting(true);

    try {
      const formData = new FormData();

      // Add text fields
      formData.append("twinName", data.twinName);
      formData.append("toneStyle", data.toneStyle);
      formData.append("riskTolerance", data.riskTolerance);
      formData.append("coreValues", data.coreValues);
      formData.append("emojiPreference", data.emojiPreference || "None");

      // Add sample messages as JSON
      const filteredMessages = sampleMessages.filter(msg => msg.trim());
      formData.append("sampleMessages", JSON.stringify(filteredMessages));

      // Add profile data as JSON
      const profileData = {
        company_name: data.companyName,
        designation: data.designation,
        q4_goal: data.q4Goal || "",
        core_strategy: data.coreStrategy || "",
        core_values: data.coreValues,
        risk_tolerance: data.riskTolerance,
        twin_name: data.twinName,
      };
      formData.append("profileData", JSON.stringify(profileData));

      // Add files
      uploadedFiles.forEach(file => {
        formData.append("files", file);
      });

      const response = await fetch("/api/twins/create", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        toast({
          title: "Digital Twin Created",
          description: "Your twin has been successfully created and is ready to use.",
        });
        navigate("/twins");
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to create twin",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Twin creation error:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Button
          variant="ghost"
          onClick={() => navigate("/twins")}
          className="mb-6"
          data-testid="button-back-to-twins"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Twins
        </Button>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">Create Your Digital Twin</h1>
          </div>
          <p className="text-muted-foreground">
            Build an AI-powered version of yourself that thinks, communicates, and advises like you do.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Define your twin's identity and role</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="twinName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Twin Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Sarah Chen Digital Twin"
                          {...field}
                          data-testid="input-twin-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., TechCorp"
                            {...field}
                            data-testid="input-company-name"
                          />
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
                          <Input
                            placeholder="e.g., Chief Technology Officer"
                            {...field}
                            data-testid="input-designation"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Communication Style */}
            <Card>
              <CardHeader>
                <CardTitle>Communication Style</CardTitle>
                <CardDescription>How does your twin communicate?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="toneStyle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tone & Style</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-tone-style">
                              <SelectValue placeholder="Select communication style" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Direct">Direct</SelectItem>
                            <SelectItem value="Motivational">Motivational</SelectItem>
                            <SelectItem value="Sarcastic">Sarcastic</SelectItem>
                            <SelectItem value="Formal">Formal</SelectItem>
                            <SelectItem value="Humorous">Humorous</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="emojiPreference"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Emoji Usage</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-emoji-preference">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="None">None</SelectItem>
                            <SelectItem value="Minimal">Minimal</SelectItem>
                            <SelectItem value="Moderate">Moderate</SelectItem>
                            <SelectItem value="Frequent">Frequent</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="riskTolerance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Risk Tolerance</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-risk-tolerance">
                            <SelectValue placeholder="Select risk approach" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Conservative">Conservative - Prefer proven approaches</SelectItem>
                          <SelectItem value="Balanced">Balanced - Measured risk-taking</SelectItem>
                          <SelectItem value="Aggressive">Aggressive - Bold, experimental</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="coreValues"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Core Values</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., Innovation, customer obsession, data-driven decision making..."
                          className="min-h-[100px]"
                          {...field}
                          data-testid="textarea-core-values"
                        />
                      </FormControl>
                      <FormDescription>
                        Describe the principles that guide your decision-making
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Strategic Context */}
            <Card>
              <CardHeader>
                <CardTitle>Strategic Context</CardTitle>
                <CardDescription>Optional: Add strategic goals and priorities</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="q4Goal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Q4 Goals</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., Launch new product line, increase market share by 15%..."
                          className="min-h-[80px]"
                          {...field}
                          data-testid="textarea-q4-goal"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="coreStrategy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Core Strategy</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., Focus on AI-driven automation, expand into enterprise market..."
                          className="min-h-[80px]"
                          {...field}
                          data-testid="textarea-core-strategy"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Sample Messages */}
            <Card>
              <CardHeader>
                <CardTitle>Sample Messages</CardTitle>
                <CardDescription>
                  Provide at least 3 examples of how you typically communicate (emails, messages, responses)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-3">
                    {sampleMessages.map((message, index) => (
                      <div key={index} className="flex gap-2">
                        <Textarea
                          placeholder={`Sample message ${index + 1}`}
                          value={message}
                          onChange={(e) => updateSampleMessage(index, e.target.value)}
                          className="min-h-[80px]"
                          data-testid={`textarea-sample-message-${index}`}
                        />
                        {sampleMessages.length > 3 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeSampleMessage(index)}
                            data-testid={`button-remove-message-${index}`}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <Button
                  type="button"
                  variant="outline"
                  onClick={addSampleMessage}
                  className="w-full"
                  data-testid="button-add-sample-message"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Another Sample
                </Button>
              </CardContent>
            </Card>

            {/* File Upload */}
            <Card>
              <CardHeader>
                <CardTitle>Upload Documents</CardTitle>
                <CardDescription>
                  Upload documents that represent your communication style and expertise (optional)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Upload PDF, TXT, DOC, or MD files (Max 100MB)
                  </p>
                  <Input
                    type="file"
                    multiple
                    accept=".txt,.pdf,.doc,.docx,.md"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                    data-testid="input-file-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById("file-upload")?.click()}
                    data-testid="button-choose-files"
                  >
                    Choose Files
                  </Button>
                </div>

                {uploadedFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Uploaded Files:</p>
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded">
                        <span className="text-sm truncate">{file.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFile(index)}
                          data-testid={`button-remove-file-${index}`}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Separator />

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/twins")}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                data-testid="button-create-twin"
              >
                {isSubmitting ? "Creating..." : "Create Digital Twin"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
