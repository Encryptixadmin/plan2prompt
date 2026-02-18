import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowLeft,
  Sparkles,
  Terminal,
  Copy,
  Check,
  Clock,
  Loader2,
  CheckCircle2,
  Lock,
  Download,
  StopCircle,
  ChevronRight,
  Target,
  ListOrdered,
  Hand,
  AlertTriangle,
  PlayCircle,
  XCircle,
  RotateCcw,
  ShieldAlert,
  Circle,
} from "lucide-react";
import { StepFeedbackForm } from "@/components/step-feedback-form";
import type { PromptDocument, IDEType, BuildPrompt, IDE_OPTIONS } from "@shared/types/prompts";
import { StageCard } from "@/components/stage-indicator";
import { ModuleBlockedState } from "@/components/module-blocked-state";
import { useProject } from "@/contexts/project-context";
import { useRequireProject } from "@/components/require-project-guard";
import { ClarificationPanel } from "@/components/clarification-panel";
import type { ExecutionStep, ExecutionSession } from "@shared/schema";

const ideOptions: typeof IDE_OPTIONS = [
  {
    id: "replit",
    name: "Replit",
    description: "Browser-based IDE with AI assistance",
    features: ["AI Agent", "Instant deployment", "Collaborative editing", "Built-in database"],
    limitations: ["Some system-level access restricted"],
  },
  {
    id: "cursor",
    name: "Cursor",
    description: "AI-first code editor built on VS Code",
    features: ["AI code completion", "Chat with codebase", "Multi-file editing", "Local development"],
    limitations: ["Requires local environment setup"],
  },
  {
    id: "lovable",
    name: "Lovable",
    description: "AI-powered app builder for rapid prototyping",
    features: ["Visual UI generation", "Fast iteration", "Component library", "Deployment"],
    limitations: ["Best for frontend-focused apps"],
  },
  {
    id: "antigravity",
    name: "Antigravity",
    description: "AI development platform",
    features: ["Natural language coding", "Rapid prototyping", "Full-stack support"],
    limitations: ["Newer platform with evolving features"],
  },
  {
    id: "warp",
    name: "Warp",
    description: "Modern terminal with AI capabilities",
    features: ["AI command assistance", "Blocks workflow", "Team collaboration"],
    limitations: ["Terminal-focused, pair with code editor"],
  },
  {
    id: "other",
    name: "Other / Generic",
    description: "Generic prompts for any AI-assisted IDE",
    features: ["Universal instructions", "Adaptable format"],
    limitations: ["May need adjustment for specific IDE"],
  },
];

interface RequirementOption {
  id: string;
  title: string;
  version: number;
  createdAt: string;
  stage?: string;
}

type FlowStep = "select-requirements" | "select-ide" | "view-prompts";

export default function Prompts() {
  const { requireProject, ProjectRequiredDialog } = useRequireProject();
  const [flowStep, setFlowStep] = useState<FlowStep>("select-requirements");
  const [selectedRequirements, setSelectedRequirements] = useState<string>("");
  const [selectedRequirementsTitle, setSelectedRequirementsTitle] = useState<string>("");
  const [selectedIDE, setSelectedIDE] = useState<IDEType | "">("");
  const [generatedPrompts, setGeneratedPrompts] = useState<PromptDocument | null>(null);
  const [copiedStep, setCopiedStep] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [executionSession, setExecutionSession] = useState<ExecutionSession | null>(null);
  const [executionSteps, setExecutionSteps] = useState<ExecutionStep[]>([]);
  const [sessionBlocked, setSessionBlocked] = useState(false);
  const { toast } = useToast();

  const { activeProject } = useProject();

  const { data: requirements, isLoading: loadingRequirements } = useQuery<RequirementOption[]>({
    queryKey: ["/api/prompts/requirements"],
    select: (data: any) => data.data,
    enabled: !!activeProject,
  });

  const generateMutation = useMutation({
    mutationFn: async (data: { requirementsArtifactId: string; ide: IDEType }) => {
      const response = await apiRequest("POST", "/api/prompts/generate", data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setGeneratedPrompts(data.data);
        setFlowStep("view-prompts");
        toast({
          title: "Prompts Generated",
          description: `Created ${data.data.totalSteps} build prompts for ${data.data.ideName}`,
        });
      } else {
        throw new Error(data.error || "Failed to generate prompts");
      }
    },
    onError: () => {
      toast({
        title: "Something went wrong",
        description: "Could not generate prompts. Please try again in a moment.",
        variant: "destructive",
      });
    },
  });

  const initSessionMutation = useMutation({
    mutationFn: async (data: { promptArtifactId: string; totalSteps: number }) => {
      const response = await apiRequest("POST", "/api/execution/sessions", data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setExecutionSession(data.data.session);
        setExecutionSteps(data.data.steps);
        if (data.data.resumed) {
          toast({
            title: "Session Resumed",
            description: "Your previous execution progress has been restored.",
          });
        }
      }
    },
  });

  const updateStepMutation = useMutation({
    mutationFn: async (data: { sessionId: string; stepNumber: number; status: string; failureOutput?: string }) => {
      const response = await apiRequest(
        "PATCH",
        `/api/execution/sessions/${data.sessionId}/steps/${data.stepNumber}`,
        { status: data.status, failureOutput: data.failureOutput }
      );
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setExecutionSteps(data.data.steps);
        if (data.data.escalated) {
          toast({
            title: "Escalation Triggered",
            description: "This step has failed multiple times. Consider reviewing requirements.",
            variant: "destructive",
          });
        }
      }
    },
    onError: (error: any) => {
      const msg = error?.message || "Could not update step status.";
      if (msg.includes("STEP_SEQUENCE_VIOLATION")) {
        toast({
          title: "Step Locked",
          description: "Complete the previous step first before proceeding.",
          variant: "destructive",
        });
      } else if (msg.includes("SESSION_BLOCKED")) {
        setSessionBlocked(true);
        toast({
          title: "Session Blocked",
          description: "The upstream prompt artifact has changed. Start a new session.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Update Failed",
          description: msg,
          variant: "destructive",
        });
      }
    },
  });

  useEffect(() => {
    if (generatedPrompts?.artifactId && !executionSession) {
      initSessionMutation.mutate({
        promptArtifactId: generatedPrompts.artifactId,
        totalSteps: generatedPrompts.totalSteps,
      });
    }
  }, [generatedPrompts?.artifactId]);

  const getStepExecution = useCallback((stepNumber: number): ExecutionStep | undefined => {
    return executionSteps.find(s => s.stepNumber === stepNumber);
  }, [executionSteps]);

  const isStepEnabled = useCallback((stepNumber: number): boolean => {
    if (sessionBlocked) return false;
    if (!executionSession || executionSession.status !== "active") return false;
    if (stepNumber === 1) return true;
    const prevStep = executionSteps.find(s => s.stepNumber === stepNumber - 1);
    return prevStep?.status === "completed";
  }, [executionSteps, executionSession, sessionBlocked]);

  const handleStepAction = useCallback((stepNumber: number, status: "in_progress" | "completed" | "failed", failureOutput?: string) => {
    if (!executionSession) return;
    updateStepMutation.mutate({
      sessionId: executionSession.id,
      stepNumber,
      status,
      failureOutput,
    });
  }, [executionSession, updateStepMutation]);

  const handleRequirementsSelect = (reqId: string) => {
    setSelectedRequirements(reqId);
    const req = requirements?.find(r => r.id === reqId);
    setSelectedRequirementsTitle(req?.title?.replace("Requirements Reference: ", "") || "");
    setFlowStep("select-ide");
  };

  const handleIDESelect = (ide: IDEType) => {
    setSelectedIDE(ide);
  };

  const handleGenerate = () => {
    if (!selectedRequirements || !selectedIDE) return;
    requireProject(() => {
      generateMutation.mutate({
        requirementsArtifactId: selectedRequirements,
        ide: selectedIDE as IDEType,
      });
    });
  };

  const handleBack = () => {
    if (flowStep === "view-prompts") {
      setFlowStep("select-ide");
      setGeneratedPrompts(null);
      setExecutionSession(null);
      setExecutionSteps([]);
      setSessionBlocked(false);
    } else if (flowStep === "select-ide") {
      setFlowStep("select-requirements");
      setSelectedIDE("");
    }
  };

  const handleReset = () => {
    setFlowStep("select-requirements");
    setSelectedRequirements("");
    setSelectedRequirementsTitle("");
    setSelectedIDE("");
    setGeneratedPrompts(null);
    setExecutionSession(null);
    setExecutionSteps([]);
    setSessionBlocked(false);
  };

  const copyPrompt = async (step: number, prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedStep(step);
      toast({
        title: "Copied",
        description: `Step ${step} copied to clipboard`,
      });
      setTimeout(() => setCopiedStep(null), 2000);
    } catch {
      toast({
        title: "Copy Failed",
        description: "Could not copy to clipboard. Try selecting and copying manually.",
        variant: "destructive",
      });
    }
  };

  const copyAllPrompts = async () => {
    if (!generatedPrompts) return;
    
    const allPromptsText = generatedPrompts.prompts.map((p) => 
      `## Step ${p.step}: ${p.title}\n\n**Goal:** ${p.objective}\n\n**Instructions:**\n${p.prompt}\n\n**STOP/WAIT:** ${p.waitInstruction}\n\n---`
    ).join("\n\n");
    
    try {
      await navigator.clipboard.writeText(allPromptsText);
      setCopiedAll(true);
      toast({
        title: "All Prompts Copied",
        description: `${generatedPrompts.totalSteps} prompts copied to clipboard`,
      });
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      toast({
        title: "Copy Failed",
        description: "Could not copy to clipboard. Try selecting and copying manually.",
        variant: "destructive",
      });
    }
  };

  const exportAsMarkdown = () => {
    if (!generatedPrompts) return;

    let markdown = `# Build Prompts: ${generatedPrompts.ideaTitle}\n\n`;
    markdown += `**Target IDE:** ${generatedPrompts.ideName}\n`;
    markdown += `**Total Steps:** ${generatedPrompts.totalSteps}\n`;
    markdown += `**Estimated Time:** ${generatedPrompts.estimatedTotalTime}\n`;
    markdown += `**Generated:** ${new Date(generatedPrompts.createdAt).toLocaleString()}\n\n`;
    markdown += `---\n\n`;
    markdown += `## Instructions\n\n`;
    markdown += `1. Copy each prompt exactly as written\n`;
    markdown += `2. Paste into your ${generatedPrompts.ideName} AI assistant\n`;
    markdown += `3. Wait for the AI to complete the task\n`;
    markdown += `4. Verify the expected outcome\n`;
    markdown += `5. **Follow the STOP/WAIT instruction before proceeding**\n\n`;
    markdown += `---\n\n`;

    generatedPrompts.prompts.forEach((p) => {
      markdown += `## Step ${p.step}: ${p.title}\n\n`;
      markdown += `### Goal\n${p.objective}\n\n`;
      markdown += `### Instructions\n\`\`\`\n${p.prompt}\n\`\`\`\n\n`;
      markdown += `### Expected Outcome\n${p.expectedOutcome}\n\n`;
      markdown += `### STOP / WAIT\n> ${p.waitInstruction}\n\n`;
      if (p.dependencies && p.dependencies.length > 0) {
        markdown += `*Requires completion of: Step ${p.dependencies.join(", Step ")}*\n\n`;
      }
      markdown += `---\n\n`;
    });

    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `build-prompts-${generatedPrompts.ideaTitle.toLowerCase().replace(/\s+/g, "-")}-${generatedPrompts.ide}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Exported",
      description: "Prompts exported as Markdown file",
    });
  };

  const completedCount = executionSteps.filter(s => s.status === "completed").length;
  const totalStepsCount = executionSteps.length;
  const selectedIDEInfo = ideOptions.find((ide) => ide.id === selectedIDE);

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-10">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-prompts-title">Build Prompts</h1>
            <p className="text-sm text-muted-foreground">
              Generate step-by-step build instructions tailored to your IDE.
            </p>
          </div>
          {flowStep !== "select-requirements" && (
            <Button variant="outline" onClick={handleReset} data-testid="button-start-over">
              Start Over
            </Button>
          )}
        </div>
        {flowStep === "select-requirements" && (
          loadingRequirements ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (!requirements || requirements.length === 0) ? (
            <ModuleBlockedState type="promptsNeedsRequirements" />
          ) : (
            <div className="space-y-6">
              <div className="text-center space-y-3">
                <h2 className="text-2xl font-bold">Ready to Build</h2>
                <p className="text-muted-foreground max-w-lg mx-auto">
                  Generate ordered prompts from locked requirements. Each prompt includes a clear goal, 
                  instructions, and guidance on when to pause.
                </p>
                <p className="text-sm text-muted-foreground/70 max-w-lg mx-auto">
                  Prompts are text-based instructions. Copy them to your preferred development environment and execute manually.
                </p>
              </div>

              <Card className="border-2 border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5 text-primary" />
                    Select Locked Requirements
                  </CardTitle>
                  <CardDescription>
                    Only locked requirements appear here. Locking happens in the Requirements Module when you accept a generated document.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {requirements.map((req) => (
                      <button
                        key={req.id}
                        onClick={() => handleRequirementsSelect(req.id)}
                        className="w-full p-4 rounded-lg border hover-elevate text-left flex items-center justify-between gap-4 transition-all"
                        data-testid={`button-select-requirements-${req.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-md bg-green-100 dark:bg-green-900/30">
                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <div className="font-medium">
                              {req.title.replace("Requirements Reference: ", "")}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Version {req.version}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )
        )}

        {flowStep === "select-ide" && (
          <div className="space-y-6">
            <Button variant="ghost" onClick={handleBack} className="mb-2" data-testid="button-back">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            <div className="text-center space-y-3">
              <Badge variant="outline" className="mb-2">
                {selectedRequirementsTitle}
              </Badge>
              <h2 className="text-2xl font-bold">Choose Your Environment</h2>
              <p className="text-muted-foreground max-w-lg mx-auto">
                Select where you will execute the prompts. The output format adapts to your choice.
              </p>
              <p className="text-sm text-muted-foreground/70 max-w-lg mx-auto">
                If your environment is not listed, select "Other / Generic" for universal instructions.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {ideOptions.map((ide) => (
                <button
                  key={ide.id}
                  onClick={() => handleIDESelect(ide.id as IDEType)}
                  className={`p-4 rounded-lg border text-left transition-all hover-elevate ${
                    selectedIDE === ide.id 
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
                      : ""
                  }`}
                  data-testid={`button-ide-${ide.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{ide.name}</div>
                      <p className="text-sm text-muted-foreground mt-1">{ide.description}</p>
                    </div>
                    {selectedIDE === ide.id && (
                      <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-3">
                    {ide.features.slice(0, 3).map((feature) => (
                      <Badge key={feature} variant="secondary" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </button>
              ))}
            </div>

            {selectedIDE && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">Ready to generate prompts for {selectedIDEInfo?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        This will create portable, deterministic instructions.
                      </p>
                    </div>
                    <Button
                      onClick={handleGenerate}
                      disabled={generateMutation.isPending}
                      size="lg"
                      data-testid="button-generate-prompts"
                    >
                      {generateMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Generate Prompts
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {flowStep === "view-prompts" && generatedPrompts && (
          <div className="space-y-6">
            <StageCard 
              currentStage="PROMPTS_GENERATED" 
              artifactId={generatedPrompts.artifactId}
              sourceArtifactId={generatedPrompts.requirementsArtifactId}
            />

            {activeProject && (
              <ClarificationPanel
                projectId={activeProject.id}
                module="prompts"
                inline={(generatedPrompts as any).clarifications}
              />
            )}

            {sessionBlocked && (
              <Card className="border-2 border-red-300 dark:border-red-800">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-red-700 dark:text-red-400">Session Blocked</h4>
                      <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">
                        The upstream prompt artifact has been updated. Your current session is no longer valid.
                        Start over to generate a new session from the latest prompts.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Terminal className="h-5 w-5" />
                      {generatedPrompts.ideaTitle}
                    </CardTitle>
                    <CardDescription>
                      {generatedPrompts.totalSteps} prompts for {generatedPrompts.ideName}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="gap-1">
                      <Clock className="h-3 w-3" />
                      {generatedPrompts.estimatedTotalTime}
                    </Badge>
                    {totalStepsCount > 0 && (
                      <Badge
                        variant={completedCount === totalStepsCount ? "default" : "secondary"}
                        className="gap-1"
                        data-testid="badge-execution-progress"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        {completedCount} / {totalStepsCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20 p-4">
                  <div className="flex items-start gap-3">
                    <Hand className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-amber-700 dark:text-amber-400">Manual Execution Required</h4>
                      <p className="text-sm text-amber-600/80 dark:text-amber-400/80 mt-1">
                        These prompts do not auto-execute. Copy each prompt and paste it into your IDE's AI assistant. 
                        Follow the STOP/WAIT instructions between steps. Mark each step complete before proceeding.
                      </p>
                    </div>
                  </div>
                </div>

                {totalStepsCount > 0 && (
                  <div className="w-full bg-muted rounded-full h-2" data-testid="progress-bar">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(completedCount / totalStepsCount) * 100}%` }}
                    />
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={copyAllPrompts}
                    className="gap-2"
                    data-testid="button-copy-all"
                  >
                    {copiedAll ? (
                      <>
                        <Check className="h-4 w-4" />
                        Copied All
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy All Prompts
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={exportAsMarkdown}
                    className="gap-2"
                    data-testid="button-export-markdown"
                  >
                    <Download className="h-4 w-4" />
                    Export as Markdown
                  </Button>
                </div>
              </CardContent>
            </Card>

            <ScrollArea className="h-[700px] pr-4">
              <div className="space-y-6">
                {generatedPrompts.prompts.map((prompt, index) => (
                  <PromptCard
                    key={prompt.step}
                    prompt={prompt}
                    isLast={index === generatedPrompts.prompts.length - 1}
                    isCopied={copiedStep === prompt.step}
                    onCopy={() => copyPrompt(prompt.step, prompt.prompt)}
                    promptDocumentId={generatedPrompts.artifactId}
                    ide={generatedPrompts.ide}
                    ideName={generatedPrompts.ideName}
                    executionStep={getStepExecution(prompt.step)}
                    stepEnabled={isStepEnabled(prompt.step)}
                    onStepAction={handleStepAction}
                    isUpdating={updateStepMutation.isPending}
                  />
                ))}
              </div>
            </ScrollArea>

            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Portable and Reproducible</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      These prompts are self-contained. Export the Markdown file to use later, share with collaborators, 
                      or execute in any compatible environment. The same prompts produce consistent results.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

      <ProjectRequiredDialog />
    </div>
  );
}

interface PromptCardProps {
  prompt: BuildPrompt;
  isLast: boolean;
  isCopied: boolean;
  onCopy: () => void;
  promptDocumentId?: string;
  ide?: IDEType;
  ideName?: string;
  executionStep?: ExecutionStep;
  stepEnabled: boolean;
  onStepAction: (stepNumber: number, status: "in_progress" | "completed" | "failed", failureOutput?: string) => void;
  isUpdating: boolean;
}

function StepStatusIndicator({ status }: { status?: string }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "in_progress":
      return <PlayCircle className="h-4 w-4 text-blue-500" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Circle className="h-4 w-4 text-muted-foreground" />;
  }
}

function PromptCard({ prompt, isLast, isCopied, onCopy, promptDocumentId, ide, ideName, executionStep, stepEnabled, onStepAction, isUpdating }: PromptCardProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const stepStatus = executionStep?.status || "not_started";
  const isCompleted = stepStatus === "completed";
  const isFailed = stepStatus === "failed";
  const isDisabled = !stepEnabled && !isCompleted;

  const stepCircleClass = isCompleted
    ? "border-green-500 bg-green-500 text-white"
    : isFailed
    ? "border-red-500 bg-red-500 text-white"
    : stepStatus === "in_progress"
    ? "border-blue-500 bg-blue-500 text-white"
    : isDisabled
    ? "border-muted-foreground/30 bg-muted text-muted-foreground"
    : "border-primary bg-primary text-primary-foreground";

  return (
    <div className="relative" data-testid={`step-card-${prompt.step}`}>
      <div className="flex items-start gap-4">
        <div className="flex flex-col items-center">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold ${stepCircleClass}`}>
            {isCompleted ? <Check className="h-5 w-5" /> : prompt.step}
          </div>
          {!isLast && (
            <div className={`w-0.5 h-full min-h-[100px] mt-2 ${isCompleted ? "bg-green-300 dark:bg-green-700" : "bg-border"}`} />
          )}
        </div>

        <div className={`flex-1 space-y-4 ${isDisabled ? "opacity-50 pointer-events-none" : ""}`}>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{prompt.title}</CardTitle>
                    <StepStatusIndicator status={stepStatus} />
                  </div>
                  {prompt.dependencies && prompt.dependencies.length > 0 && (
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-muted-foreground">Requires:</span>
                      {prompt.dependencies.map((dep) => (
                        <Badge key={dep} variant="outline" className="text-xs">
                          Step {dep}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {prompt.requirementsCovered && prompt.requirementsCovered.length > 0 && (
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-muted-foreground">Covers:</span>
                      {prompt.requirementsCovered.map((reqId) => (
                        <Badge key={reqId} variant="secondary" className="text-xs" data-testid={`badge-req-${reqId}`}>
                          {reqId}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {executionStep && (executionStep.attempts > 0 || executionStep.escalationLevel > 0) && (
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {executionStep.attempts > 0 && (
                        <Badge variant="destructive" className="text-xs gap-1" data-testid={`badge-attempts-${prompt.step}`}>
                          <RotateCcw className="h-3 w-3" />
                          {executionStep.attempts} {executionStep.attempts === 1 ? "attempt" : "attempts"}
                        </Badge>
                      )}
                      {executionStep.escalationLevel > 0 && (
                        <Badge variant="destructive" className="text-xs gap-1" data-testid={`badge-escalation-${prompt.step}`}>
                          <ShieldAlert className="h-3 w-3" />
                          Escalation Level {executionStep.escalationLevel}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                {prompt.estimatedTime && (
                  <Badge variant="secondary" className="text-xs shrink-0 gap-1">
                    <Clock className="h-3 w-3" />
                    {prompt.estimatedTime}
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex items-start gap-2">
                <Target className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-xs font-medium uppercase text-muted-foreground">Goal</span>
                  <p className="text-sm">{prompt.objective}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ListOrdered className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-xs font-medium uppercase text-muted-foreground">Instructions</span>
                </div>
                <div className="relative rounded-lg border bg-muted/50">
                  <div className="flex items-center justify-between border-b px-4 py-2">
                    <span className="text-xs font-medium text-muted-foreground">COPY THIS PROMPT</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onCopy}
                      className="h-7 gap-1"
                      data-testid={`button-copy-step-${prompt.step}`}
                    >
                      {isCopied ? (
                        <>
                          <Check className="h-3 w-3" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <pre className="p-4 text-sm overflow-x-auto whitespace-pre-wrap font-mono">
                    {prompt.prompt}
                  </pre>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-xs font-medium uppercase text-muted-foreground">Expected Outcome</span>
                  <p className="text-sm text-muted-foreground">{prompt.expectedOutcome}</p>
                </div>
              </div>

              <div className="rounded-lg border-2 border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/20 p-4">
                <div className="flex items-center gap-2">
                  <StopCircle className="h-5 w-5 text-red-500" />
                  <span className="font-semibold text-red-700 dark:text-red-400 uppercase text-sm">
                    STOP / WAIT
                  </span>
                </div>
                <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-2">
                  {prompt.waitInstruction}
                </p>
              </div>

              {!isDisabled && !isCompleted && (
                <div className="pt-2 border-t flex items-center gap-2 flex-wrap">
                  {stepStatus === "not_started" && (
                    <Button
                      size="sm"
                      onClick={() => onStepAction(prompt.step, "in_progress")}
                      disabled={isUpdating}
                      className="gap-1"
                      data-testid={`button-start-step-${prompt.step}`}
                    >
                      <PlayCircle className="h-4 w-4" />
                      Start Step
                    </Button>
                  )}
                  {(stepStatus === "in_progress" || stepStatus === "failed") && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => onStepAction(prompt.step, "completed")}
                        disabled={isUpdating}
                        className="gap-1"
                        data-testid={`button-complete-step-${prompt.step}`}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Mark Complete
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => onStepAction(prompt.step, "failed", "Step failed during execution")}
                        disabled={isUpdating}
                        className="gap-1"
                        data-testid={`button-fail-step-${prompt.step}`}
                      >
                        <XCircle className="h-4 w-4" />
                        Report Failure
                      </Button>
                    </>
                  )}
                  {promptDocumentId && ide && ideName && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFeedback(true)}
                      className="gap-1"
                      data-testid={`button-resolve-step-${prompt.step}`}
                    >
                      <AlertTriangle className="h-4 w-4" />
                      Resolve Issue
                    </Button>
                  )}
                </div>
              )}

              {isCompleted && (
                <div className="pt-2 border-t">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-medium">Step completed</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {showFeedback && promptDocumentId && ide && ideName && (
            <StepFeedbackForm
              promptDocumentId={promptDocumentId}
              stepNumber={prompt.step}
              ide={ide}
              ideName={ideName}
              onClose={() => setShowFeedback(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
