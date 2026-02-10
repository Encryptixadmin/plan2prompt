import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, timedApiRequest } from "@/lib/queryClient";
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
  CheckCircle,
  AlertTriangle,
  Shield,
  Loader2,
  Sparkles,
  Target,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  Trash2,
  ArrowRight,
  FileCheck,
  BookOpen,
  Play,
} from "lucide-react";
import type { IdeaAnalysis, AnalyzeIdeaResponse } from "@shared/types/ideas";
import { StageCard } from "@/components/stage-indicator";
import { ArtifactPreview } from "@/components/artifact-preview";
import { useRequireProject } from "@/components/require-project-guard";
import { useAIProviderStatus } from "@/hooks/use-ai-provider-status";
import { mapBackendError, AnalysisTimeoutError } from "@/lib/error-messages";
import { useToast } from "@/hooks/use-toast";
import { WorkshopConversation } from "@/components/workshop-conversation";
import { WorkshopComparison } from "@/components/workshop-comparison";
import { buildConversationFindings } from "@/lib/workshop-resolution";
import type { WorkshopResolutionResult } from "@shared/types/workshop";

const ideaFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  purpose: z.enum(["commercial", "developer_tool", "internal", "open_source", "learning"]).optional(),
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
  onStartWorkshop: () => void;
  onProceedAnyway: () => void;
  onDiscard: () => void;
  isAccepting: boolean;
  isAccepted: boolean;
  previousAnalysis?: IdeaAnalysis | null;
}

function AnalysisResults({ 
  analysis, 
  onAccept, 
  onStartWorkshop, 
  onProceedAnyway, 
  onDiscard, 
  isAccepting, 
  isAccepted,
  previousAnalysis,
}: AnalysisResultsProps) {
  const needsRefinement = analysis.recommendation === "revise" || analysis.recommendation === "stop";
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

      {previousAnalysis && (
        <WorkshopComparison
          previousAnalysis={previousAnalysis}
          newAnalysis={analysis}
        />
      )}

      {!isAccepted && (
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">Review Complete</CardTitle>
            <CardDescription>
              {needsRefinement
                ? "This idea needs refinement. Use the Guided Workshop to improve it, or proceed with acknowledged risks."
                : "Accepting saves this as a validated idea. Discarding clears everything."}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-3 pt-0">
            {needsRefinement ? (
              <>
                <div className="flex flex-col sm:flex-row gap-3 w-full">
                  <Button
                    onClick={onStartWorkshop}
                    className="flex-1"
                    size="lg"
                    data-testid="button-start-workshop"
                  >
                    <BookOpen className="mr-2 h-4 w-4" />
                    Refine via Guided Workshop
                  </Button>
                  <Button
                    onClick={onProceedAnyway}
                    variant="outline"
                    className="flex-1"
                    size="lg"
                    data-testid="button-proceed-anyway"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Proceed Anyway (Risk Acknowledged)
                  </Button>
                </div>
                <Button
                  onClick={onDiscard}
                  variant="ghost"
                  className="w-full"
                  size="lg"
                  data-testid="button-discard"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Discard
                </Button>
              </>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3 w-full">
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
                  onClick={onDiscard}
                  variant="ghost"
                  className="flex-1"
                  size="lg"
                  data-testid="button-discard"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Discard
                </Button>
              </div>
            )}
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
  const { requireProject, ProjectRequiredDialog } = useRequireProject();
  const { hasValidatedProviders, isLoading: isLoadingProviders, isError: isProviderError } = useAIProviderStatus();
  const { toast } = useToast();
  const [analysis, setAnalysis] = useState<IdeaAnalysis | null>(null);
  const [previousAnalysis, setPreviousAnalysis] = useState<IdeaAnalysis | null>(null);
  const [isAccepted, setIsAccepted] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [pendingFormValues, setPendingFormValues] = useState<IdeaFormValues | null>(null);
  const [workshopMode, setWorkshopMode] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  
  const canAnalyze = hasValidatedProviders;

  const form = useForm<IdeaFormValues>({
    resolver: zodResolver(ideaFormSchema),
    defaultValues: {
      title: "",
      description: "",
      purpose: undefined,
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
      
      const response = await timedApiRequest("POST", "/api/ideas/analyze", {
        idea: {
          title: values.title,
          description: values.description,
          purpose: values.purpose || undefined,
          context: {
            targetMarket: values.targetMarket || undefined,
            skills: values.skills ? values.skills.split(",").map((s) => s.trim()) : undefined,
            budget: values.budget || undefined,
            timeline: values.timeline || undefined,
            competitors: values.competitors || undefined,
          },
        },
      });
      return response.json() as Promise<{ success: boolean; data: AnalyzeIdeaResponse }>;
    },
    onSuccess: (data) => {
      if (data.success) {
        setAnalysis(data.data.analysis);
        setIsAccepted(false);
      }
    },
    onError: (error: Error) => {
      const isTimeout = error instanceof AnalysisTimeoutError || error.name === "AnalysisTimeoutError";
      toast({
        variant: "destructive",
        title: isTimeout ? "Analysis is taking longer than expected" : "Analysis failed",
        description: mapBackendError(error),
      });
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

  const handleStartWorkshop = () => {
    if (!analysis) return;
    setWorkshopMode(true);
  };

  const handleProceedAnyway = () => {
    setShowAcceptDialog(true);
  };

  const handleWorkshopComplete = async (turns: { question: string; answer: string; turnNumber: number }[]) => {
    if (!analysis) return;
    
    setIsReanalyzing(true);
    setPreviousAnalysis(analysis);
    
    try {
      const isReady = await checkProviderReadiness();
      if (!isReady) {
        throw new Error("Idea analysis is unavailable due to configuration issues.");
      }

      const workshopFindings = buildConversationFindings(turns);
      
      const response = await timedApiRequest("POST", "/api/ideas/analyze", {
        idea: {
          title: analysis.input.title,
          description: analysis.input.description,
          purpose: analysis.input.purpose,
          context: {
            ...analysis.input.context,
            workshopRefinement: workshopFindings,
          },
        },
      });
      
      const data = await response.json() as { success: boolean; data: AnalyzeIdeaResponse };
      
      if (data.success) {
        const adjustedAnalysis = data.data.analysis;
        
        setAnalysis(adjustedAnalysis);
        setWorkshopMode(false);
        setIsAccepted(false);
        
        toast({
          title: "Re-analysis complete",
          description: "Your idea has been re-analyzed with the interview context.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Re-analysis failed",
        description: mapBackendError(error),
      });
    } finally {
      setIsReanalyzing(false);
    }
  };
  
  const applyWorkshopResolution = (
    analysisResult: IdeaAnalysis, 
    resolution: WorkshopResolutionResult
  ): IdeaAnalysis => {
    const mapStatus = (status: string): "validated" | "unvalidated" | "risky" => {
      if (status === "validated") return "validated";
      if (status === "partially_validated") return "risky";
      return "unvalidated";
    };
    
    const updatedAssumptions = [...analysisResult.assumptionDependencies];
    for (const assumptionRes of resolution.assumptions) {
      if (updatedAssumptions[assumptionRes.assumptionIndex]) {
        updatedAssumptions[assumptionRes.assumptionIndex] = {
          ...updatedAssumptions[assumptionRes.assumptionIndex],
          status: mapStatus(assumptionRes.newStatus),
        };
      }
    }
    
    const updatedRisks = analysisResult.risks.map((risk, index) => {
      const riskId = `risk_${risk.category}_${index}`;
      const riskRes = resolution.risks.find(r => r.riskId === riskId);
      if (riskRes) {
        return {
          ...risk,
          severity: riskRes.newSeverity,
        };
      }
      return risk;
    });
    
    const scoreBoost = resolution.summary.overallImprovementScore;
    const newScore = Math.min(100, analysisResult.overallScore + scoreBoost);
    
    let newRecommendation = analysisResult.recommendation;
    let newRationale = analysisResult.recommendationRationale;
    
    if (scoreBoost > 0) {
      if (analysisResult.recommendation === "stop" && newScore >= 45) {
        newRecommendation = "revise";
        newRationale = `Workshop improved score from ${analysisResult.overallScore} to ${newScore}. Still needs attention but no longer critical.`;
      } else if (analysisResult.recommendation === "revise" && newScore >= 70) {
        newRecommendation = "proceed";
        newRationale = `Workshop validation improved score to ${newScore}. Key concerns addressed.`;
      }
    }
    
    return {
      ...analysisResult,
      assumptionDependencies: updatedAssumptions,
      risks: updatedRisks,
      overallScore: newScore,
      recommendation: newRecommendation,
      recommendationRationale: newRationale,
    };
  };

  const handleWorkshopCancel = () => {
    setWorkshopMode(false);
  };

  const handleDiscard = () => {
    setShowDiscardDialog(true);
  };

  const confirmDiscard = () => {
    setAnalysis(null);
    setPreviousAnalysis(null);
    setIsAccepted(false);
    setWorkshopMode(false);
    form.reset();
    setShowDiscardDialog(false);
  };

  const handleNewIdea = () => {
    setAnalysis(null);
    setPreviousAnalysis(null);
    setIsAccepted(false);
    setWorkshopMode(false);
    form.reset();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-ideas-title">Ideas</h1>
          <p className="text-sm text-muted-foreground">
            Validate your concepts with AI-powered consensus analysis.
          </p>
        </div>

        {!analysis ? (
          <div className="space-y-8">

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

                    <FormField
                      control={form.control}
                      name="purpose"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>What type of project is this?</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-purpose">
                                <SelectValue placeholder="Select project type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="commercial">Commercial Product (SaaS, marketplace, consumer app)</SelectItem>
                              <SelectItem value="developer_tool">Developer Tool (SDK, CLI, library, devtool)</SelectItem>
                              <SelectItem value="internal">Internal/Personal Tool (private use, team utility)</SelectItem>
                              <SelectItem value="open_source">Open Source Project (community-driven)</SelectItem>
                              <SelectItem value="learning">Learning/Experiment (skill-building, prototype)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            This shapes the analysis — a dev tool needs different validation than a consumer app.
                          </FormDescription>
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
        ) : workshopMode ? (
          <WorkshopConversation
            analysis={analysis}
            researchBrief={analysis.input.context?.researchBrief}
            onComplete={handleWorkshopComplete}
            onCancel={handleWorkshopCancel}
            isSubmitting={isReanalyzing}
          />
        ) : (
          <AnalysisResults
            analysis={analysis}
            onAccept={handleAccept}
            onStartWorkshop={handleStartWorkshop}
            onProceedAnyway={handleProceedAnyway}
            onDiscard={handleDiscard}
            isAccepting={acceptMutation.isPending}
            isAccepted={isAccepted}
            previousAnalysis={previousAnalysis}
          />
        )}

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
