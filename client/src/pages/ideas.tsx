import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  CheckCircle,
  AlertTriangle,
  Shield,
  Loader2,
  Sparkles,
  Target,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  Pencil,
  Trash2,
  ArrowRight,
  FileCheck,
} from "lucide-react";
import type { IdeaAnalysis, AnalyzeIdeaResponse } from "@shared/types/ideas";
import { StageCard } from "@/components/stage-indicator";
import { ActiveProjectIndicator } from "@/components/active-project-indicator";
import { ProjectSwitcher } from "@/components/project-switcher";
import { useProject } from "@/contexts/project-context";
import { ArtifactPreview } from "@/components/artifact-preview";
import { ConfidenceCopy } from "@/components/commitment-confirmation";
import { useAdminStatus } from "@/hooks/use-admin-status";
import { useRequireProject } from "@/components/require-project-guard";
import { useAIProviderStatus } from "@/hooks/use-ai-provider-status";
import { mapBackendError } from "@/lib/error-messages";

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

interface AnalysisResultsProps {
  analysis: IdeaAnalysis;
  onAccept: () => void;
  onEdit: () => void;
  onDiscard: () => void;
  isAccepting: boolean;
  isAccepted: boolean;
}

function AnalysisResults({ analysis, onAccept, onEdit, onDiscard, isAccepting, isAccepted }: AnalysisResultsProps) {
  const getRecommendation = () => {
    if (analysis.overallScore >= 75) {
      return {
        text: "Strong Candidate",
        description: "This idea shows significant promise. The strengths outweigh the risks, and feasibility scores are encouraging.",
        color: "text-green-600 dark:text-green-400",
        bgColor: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
      };
    } else if (analysis.overallScore >= 50) {
      return {
        text: "Proceed with Caution",
        description: "This idea has potential but requires attention to identified weaknesses and risks before proceeding.",
        color: "text-yellow-600 dark:text-yellow-400",
        bgColor: "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800",
      };
    } else {
      return {
        text: "Needs Refinement",
        description: "Consider addressing significant weaknesses and risks. The idea may need substantial revision.",
        color: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
      };
    }
  };

  const recommendation = getRecommendation();

  return (
    <div className="space-y-6">
      {isAccepted && (
        <StageCard 
          currentStage="VALIDATED_IDEA" 
          artifactId={analysis.artifactId}
        />
      )}

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
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-lg px-3 py-1">
                Score: {analysis.overallScore}/100
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className={`border ${recommendation.bgColor}`}>
        <CardHeader>
          <CardTitle className={`text-lg flex items-center gap-2 ${recommendation.color}`}>
            <Target className="h-5 w-5" />
            Recommendation: {recommendation.text}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{recommendation.description}</p>
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <span>AI Confidence: {Math.round(analysis.consensusConfidence * 100)}%</span>
            <Separator orientation="vertical" className="h-4" />
            <span>Provider Agreement: {Math.round(analysis.providerAgreement * 100)}%</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Strengths
            </CardTitle>
            <CardDescription>What makes this idea compelling</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {analysis.strengths.length > 0 ? (
              analysis.strengths.map((strength, i) => (
                <div key={i} className="space-y-1 p-3 rounded-lg bg-green-50/50 dark:bg-green-900/10">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-medium text-sm">{strength.title}</h4>
                    <Badge variant="secondary" className="text-xs">
                      {Math.round(strength.confidence * 100)}%
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{strength.description}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground italic">No significant strengths identified.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Weaknesses
            </CardTitle>
            <CardDescription>Areas that need attention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {analysis.weaknesses.length > 0 ? (
              analysis.weaknesses.map((weakness, i) => (
                <div key={i} className="space-y-1 p-3 rounded-lg bg-yellow-50/50 dark:bg-yellow-900/10">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-medium text-sm">{weakness.title}</h4>
                    <SeverityBadge severity={weakness.severity} />
                  </div>
                  <p className="text-sm text-muted-foreground">{weakness.description}</p>
                  {weakness.mitigation && (
                    <p className="text-sm text-primary mt-2">
                      <span className="font-medium">Mitigation:</span> {weakness.mitigation}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground italic">No significant weaknesses identified.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-500" />
            Risks
          </CardTitle>
          <CardDescription>Potential challenges and blockers to consider</CardDescription>
        </CardHeader>
        <CardContent>
          {analysis.risks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analysis.risks.map((risk, i) => (
                <div key={i} className="p-3 rounded-lg bg-red-50/50 dark:bg-red-900/10 space-y-2">
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
          ) : (
            <p className="text-sm text-muted-foreground italic">No significant risks identified.</p>
          )}
        </CardContent>
      </Card>

      {!isAccepted && (
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">Review Complete</CardTitle>
            <CardDescription>
              Accepting saves this as a validated idea. Editing returns you to the form. Discarding clears everything.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col sm:flex-row gap-3 pt-0">
            <Button
              onClick={onAccept}
              disabled={isAccepting}
              className="flex-1"
              size="lg"
              data-testid="button-accept-idea"
            >
              {isAccepting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <ThumbsUp className="mr-2 h-4 w-4" />
                  Accept as Validated Idea
                </>
              )}
            </Button>
            <Button
              onClick={onEdit}
              variant="outline"
              className="flex-1"
              size="lg"
              data-testid="button-edit-rerun"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit & Re-run
            </Button>
            <Button
              onClick={onDiscard}
              variant="ghost"
              className="flex-1"
              size="lg"
              data-testid="button-discard"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Discard
            </Button>
          </CardFooter>
        </Card>
      )}

      {isAccepted && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" />
              Idea Validated and Saved
            </CardTitle>
            <CardDescription>
              This analysis is now saved as an artifact and ready for the Requirements Module.
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
                <span className="text-muted-foreground">Next Step:</span>{" "}
                <Badge variant="outline" className="gap-1">
                  <ArrowRight className="h-3 w-3" />
                  Requirements Module
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function IdeasPage() {
  const { isAdmin } = useAdminStatus();
  const { requireProject, ProjectRequiredDialog } = useRequireProject();
  const { hasValidatedProviders, isLoading: isLoadingProviders, isError: isProviderError } = useAIProviderStatus();
  const [analysis, setAnalysis] = useState<IdeaAnalysis | null>(null);
  const [isAccepted, setIsAccepted] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [pendingFormValues, setPendingFormValues] = useState<IdeaFormValues | null>(null);
  
  const canAnalyze = hasValidatedProviders;

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

  const checkProviderReadiness = async (): Promise<boolean> => {
    try {
      const response = await fetch("/api/admin/health");
      if (!response.ok) return false;
      const data = await response.json();
      const providers = data?.data?.providers || [];
      return providers.some((p: { validated: boolean; enabled: boolean }) => p.validated && p.enabled);
    } catch {
      return false;
    }
  };

  const analyzeMutation = useMutation({
    mutationFn: async (values: IdeaFormValues) => {
      const isReady = await checkProviderReadiness();
      if (!isReady) {
        throw new Error("Idea analysis is unavailable due to configuration issues.");
      }
      
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
      return response as unknown as { success: boolean; data: AnalyzeIdeaResponse };
    },
    onSuccess: (data) => {
      if (data.success) {
        setAnalysis(data.data.analysis);
        setIsAccepted(false);
      }
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (analysisData: IdeaAnalysis) => {
      const response = await apiRequest("POST", "/api/ideas/accept", {
        analysis: analysisData,
      });
      return response as unknown as { success: boolean; data: { analysis: IdeaAnalysis } };
    },
    onSuccess: (data) => {
      if (data.success) {
        setAnalysis(data.data.analysis);
        setIsAccepted(true);
      }
    },
  });

  const onSubmit = (values: IdeaFormValues) => {
    requireProject(() => {
      analyzeMutation.mutate(values);
    });
  };

  const handleAccept = () => {
    setShowAcceptDialog(true);
  };

  const confirmAccept = () => {
    setShowAcceptDialog(false);
    if (analysis) {
      requireProject(() => {
        acceptMutation.mutate(analysis);
      });
    }
  };

  const handleEdit = () => {
    setAnalysis(null);
    setIsAccepted(false);
  };

  const handleDiscard = () => {
    setShowDiscardDialog(true);
  };

  const confirmDiscard = () => {
    setAnalysis(null);
    setIsAccepted(false);
    form.reset();
    setShowDiscardDialog(false);
  };

  const handleNewIdea = () => {
    setAnalysis(null);
    setIsAccepted(false);
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
          <div className="flex items-center gap-3">
            <ActiveProjectIndicator />
            <ProjectSwitcher />
            {(analysis || isAccepted) && (
              <Button variant="outline" onClick={handleNewIdea} data-testid="button-new-idea">
                New Idea
              </Button>
            )}
            {isAdmin && (
              <Link href="/admin">
                <Button variant="outline" size="sm" data-testid="link-admin">
                  <Shield className="h-4 w-4 mr-2" />
                  Admin
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {!analysis ? (
          <div className="space-y-8">
            <div className="text-center space-y-3">
              <h2 className="text-2xl font-bold">Validate Your Idea</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Describe your concept and receive a structured analysis. The evaluation identifies 
                strengths, weaknesses, risks, and feasibility before you proceed to building.
              </p>
              <p className="text-sm text-muted-foreground/70 max-w-lg mx-auto">
                This step helps you decide whether to proceed. No commitments are made until you explicitly accept the analysis.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Describe Your Idea</CardTitle>
                <CardDescription>
                  Provide the core concept. Additional context improves accuracy but is not required.
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
                              className="min-h-[150px] resize-none"
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

                    <Collapsible open={contextOpen} onOpenChange={setContextOpen}>
                      <CollapsibleTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full justify-between"
                          data-testid="button-toggle-context"
                        >
                          <span className="flex items-center gap-2 text-muted-foreground">
                            Additional Context (Optional)
                          </span>
                          {contextOpen ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-4 pt-4">
                        <p className="text-sm text-muted-foreground">
                          Providing context helps the AI give more accurate and relevant analysis.
                        </p>

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
                      </CollapsibleContent>
                    </Collapsible>

                    <Separator />

                    {(!canAnalyze || isProviderError) && !isLoadingProviders && (
                      <div className="p-4 rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200 text-sm" data-testid="alert-no-providers">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium">Idea analysis is temporarily unavailable</p>
                            <p className="mt-1 text-yellow-700 dark:text-yellow-300">
                              No AI providers are correctly configured. Please contact an administrator.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full"
                      size="lg"
                      disabled={analyzeMutation.isPending || !canAnalyze}
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
                      <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm" data-testid="alert-analyze-error">
                        {mapBackendError(analyzeMutation.error)}
                      </div>
                    )}
                  </form>
                </Form>
              </CardContent>
            </Card>

            <div className="text-center text-sm text-muted-foreground">
              <p>You will review the analysis before making any commitment.</p>
            </div>
          </div>
        ) : (
          <AnalysisResults
            analysis={analysis}
            onAccept={handleAccept}
            onEdit={handleEdit}
            onDiscard={handleDiscard}
            isAccepting={acceptMutation.isPending}
            isAccepted={isAccepted}
          />
        )}
      </main>

      <AlertDialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
        <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Accept this idea as validated?</AlertDialogTitle>
            <AlertDialogDescription>
              You're about to save this validated idea as an artifact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {analysis && (
            <div className="my-4">
              <ArtifactPreview
                title={analysis.input.title}
                metadata={{
                  version: 1,
                  createdAt: new Date().toISOString(),
                  stage: "VALIDATED_IDEA",
                }}
                rawContent={`# ${analysis.input.title}\n\n## Summary\n${analysis.summary}\n\n## Overall Score\n${analysis.overallScore}/100\n\n## Strengths\n${analysis.strengths.map(s => `- **${s.title}**: ${s.description}`).join('\n')}\n\n## Risks\n${analysis.risks.map(r => `- **${r.category}** (${r.severity}): ${r.description}`).join('\n')}`}
                maxHeight="250px"
              />
            </div>
          )}

          <div className="bg-muted/50 rounded-md p-3 text-sm text-muted-foreground">
            <strong className="text-foreground">What happens next:</strong>
            <p className="mt-1">This creates a stable reference that can be used to generate detailed requirements.</p>
          </div>

          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel data-testid="button-accept-cancel">Review Again</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAccept} data-testid="button-accept-confirm">
              Yes, Validate This Idea
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this analysis?</AlertDialogTitle>
            <AlertDialogDescription>
              This will discard the AI analysis and clear your idea form. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-discard-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDiscard} data-testid="button-discard-confirm">
              Yes, Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ProjectRequiredDialog />
    </div>
  );
}
