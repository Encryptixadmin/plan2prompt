import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Lightbulb,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Shield,
  Loader2,
  Sparkles,
  Target,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import type { IdeaAnalysis, AnalyzeIdeaResponse } from "@shared/types/ideas";

const ideaFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  targetMarket: z.string().optional(),
  skills: z.string().optional(),
  budget: z.enum(["low", "medium", "high", "enterprise"]).optional(),
  timeline: z.string().optional(),
  competitors: z.string().optional(),
});

type IdeaFormValues = z.infer<typeof ideaFormSchema>;

function ScoreIndicator({ score, label }: { score: number; label: string }) {
  const getScoreColor = (s: number) => {
    if (s >= 75) return "text-green-600 dark:text-green-400";
    if (s >= 50) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`text-2xl font-bold ${getScoreColor(score)}`}>{score}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: "low" | "medium" | "high" }) {
  const variants = {
    low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${variants[severity]}`}>
      {severity}
    </span>
  );
}

function AnalysisResults({ analysis }: { analysis: IdeaAnalysis }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <CardTitle className="text-xl flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {analysis.input.title}
              </CardTitle>
              <CardDescription className="max-w-2xl">{analysis.summary}</CardDescription>
            </div>
            <div className="flex items-center gap-6">
              <ScoreIndicator score={analysis.overallScore} label="Overall" />
              <ScoreIndicator score={analysis.feasibility.score} label="Feasibility" />
              <ScoreIndicator score={Math.round(analysis.consensusConfidence * 100)} label="Confidence" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={analysis.overallScore} className="h-2" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Strengths
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {analysis.strengths.map((strength, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-medium text-sm">{strength.title}</h4>
                  <Badge variant="secondary" className="text-xs">
                    {Math.round(strength.confidence * 100)}%
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{strength.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Weaknesses
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {analysis.weaknesses.map((weakness, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-medium text-sm">{weakness.title}</h4>
                  <SeverityBadge severity={weakness.severity} />
                </div>
                <p className="text-sm text-muted-foreground">{weakness.description}</p>
                {weakness.mitigation && (
                  <p className="text-sm text-primary mt-1">
                    <span className="font-medium">Mitigation:</span> {weakness.mitigation}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            Feasibility Assessment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Technical", data: analysis.feasibility.technical },
              { label: "Market", data: analysis.feasibility.market },
              { label: "Financial", data: analysis.feasibility.financial },
              { label: "Timeline", data: analysis.feasibility.timeline },
            ].map((item) => (
              <div key={item.label} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className="text-sm text-muted-foreground">{item.data.score}/100</span>
                </div>
                <Progress value={item.data.score} className="h-1.5" />
                <p className="text-xs text-muted-foreground">{item.data.notes}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-500" />
            Risk Flags
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analysis.risks.map((risk, i) => (
              <div key={i} className="p-3 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className="capitalize">
                    {risk.category}
                  </Badge>
                  <SeverityBadge severity={risk.severity} />
                </div>
                <p className="text-sm">{risk.description}</p>
                {risk.recommendation && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Recommendation:</span> {risk.recommendation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5 text-purple-500" />
            Recommended Next Steps
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analysis.nextSteps.map((step) => (
              <div key={step.priority} className="flex items-start gap-3 p-3 rounded-lg hover-elevate">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                  {step.priority}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium text-sm">{step.action}</h4>
                    <Badge variant="secondary" className="text-xs capitalize">
                      {step.effort} effort
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-primary" />
            Ready for Requirements Module
          </CardTitle>
          <CardDescription>
            This analysis has been saved and is ready to be used as input for the Requirements Module.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-sm">
              <span className="text-muted-foreground">Artifact ID:</span>{" "}
              <code className="px-2 py-0.5 bg-muted rounded text-xs">{analysis.artifactId}</code>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div className="text-sm">
              <span className="text-muted-foreground">Module:</span>{" "}
              <Badge variant="outline">ideas</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function IdeasPage() {
  const [analysis, setAnalysis] = useState<IdeaAnalysis | null>(null);

  const form = useForm<IdeaFormValues>({
    resolver: zodResolver(ideaFormSchema),
    defaultValues: {
      title: "",
      description: "",
      targetMarket: "",
      skills: "",
      budget: undefined,
      timeline: "",
      competitors: "",
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: async (values: IdeaFormValues) => {
      const response = await apiRequest("POST", "/api/ideas/analyze", {
        idea: {
          title: values.title,
          description: values.description,
          context: {
            targetMarket: values.targetMarket || undefined,
            skills: values.skills ? values.skills.split(",").map((s) => s.trim()) : undefined,
            budget: values.budget || undefined,
            timeline: values.timeline || undefined,
            competitors: values.competitors || undefined,
          },
        },
      });
      return response as { success: boolean; data: AnalyzeIdeaResponse };
    },
    onSuccess: (data) => {
      if (data.success) {
        setAnalysis(data.data.analysis);
      }
    },
  });

  const onSubmit = (values: IdeaFormValues) => {
    analyzeMutation.mutate(values);
  };

  const handleReset = () => {
    setAnalysis(null);
    form.reset();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <Lightbulb className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold">Ideas Module</h1>
              <p className="text-xs text-muted-foreground">Validate and refine your idea</p>
            </div>
          </div>
          {analysis && (
            <Button variant="outline" onClick={handleReset} data-testid="button-new-idea">
              New Idea
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {!analysis ? (
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Sense-Check Your Idea</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Get AI-powered analysis of your app or platform idea. We'll evaluate strengths,
                weaknesses, feasibility, and risks using consensus from multiple AI providers.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Describe Your Idea</CardTitle>
                <CardDescription>
                  Provide as much detail as you can for a more accurate analysis.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Idea Title</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., AI-powered recipe recommendation app"
                              {...field}
                              data-testid="input-title"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe your idea in detail. What problem does it solve? Who is it for? How does it work?"
                              className="min-h-[120px] resize-none"
                              {...field}
                              data-testid="input-description"
                            />
                          </FormControl>
                          <FormDescription>
                            Be specific about the problem you're solving and your proposed solution.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Separator />

                    <div className="space-y-4">
                      <h3 className="text-sm font-medium flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        Optional Context (improves analysis accuracy)
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="targetMarket"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Target Market</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="e.g., Health-conscious millennials"
                                  {...field}
                                  data-testid="input-market"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="skills"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Available Skills</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="e.g., React, Python, Marketing"
                                  {...field}
                                  data-testid="input-skills"
                                />
                              </FormControl>
                              <FormDescription className="text-xs">
                                Comma-separated list
                              </FormDescription>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="budget"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Budget Level</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-budget">
                                    <SelectValue placeholder="Select budget range" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="low">Low (under $5k)</SelectItem>
                                  <SelectItem value="medium">Medium ($5k - $50k)</SelectItem>
                                  <SelectItem value="high">High ($50k - $500k)</SelectItem>
                                  <SelectItem value="enterprise">Enterprise ($500k+)</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="timeline"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Timeline</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="e.g., 3 months to MVP"
                                  {...field}
                                  data-testid="input-timeline"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="competitors"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Known Competitors</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g., Yummly, Tasty, Allrecipes"
                                {...field}
                                data-testid="input-competitors"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={analyzeMutation.isPending}
                      data-testid="button-analyze"
                    >
                      {analyzeMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Analyzing with AI Consensus...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Analyze Idea
                        </>
                      )}
                    </Button>

                    {analyzeMutation.isError && (
                      <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                        Failed to analyze idea. Please try again.
                      </div>
                    )}
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        ) : (
          <AnalysisResults analysis={analysis} />
        )}
      </main>
    </div>
  );
}
