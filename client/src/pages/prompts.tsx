import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
  Sparkles,
  Terminal,
  Copy,
  Check,
  Clock,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Lock,
  Download,
  StopCircle,
  ChevronRight,
  Target,
  ListOrdered,
  Hand,
} from "lucide-react";
import type { PromptDocument, IDEType, BuildPrompt, IDE_OPTIONS } from "@shared/types/prompts";
import { StageCard } from "@/components/stage-indicator";

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
  const [flowStep, setFlowStep] = useState<FlowStep>("select-requirements");
  const [selectedRequirements, setSelectedRequirements] = useState<string>("");
  const [selectedRequirementsTitle, setSelectedRequirementsTitle] = useState<string>("");
  const [selectedIDE, setSelectedIDE] = useState<IDEType | "">("");
  const [generatedPrompts, setGeneratedPrompts] = useState<PromptDocument | null>(null);
  const [copiedStep, setCopiedStep] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const { toast } = useToast();

  const { data: requirements, isLoading: loadingRequirements } = useQuery<RequirementOption[]>({
    queryKey: ["/api/prompts/requirements"],
    select: (data: any) => data.data,
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
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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
    generateMutation.mutate({
      requirementsArtifactId: selectedRequirements,
      ide: selectedIDE as IDEType,
    });
  };

  const handleBack = () => {
    if (flowStep === "view-prompts") {
      setFlowStep("select-ide");
      setGeneratedPrompts(null);
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
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy to clipboard",
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
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy to clipboard",
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

  const selectedIDEInfo = ideOptions.find((ide) => ide.id === selectedIDE);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="link-home">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Home
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Build Prompts</h1>
          </div>
          <div className="flex-1" />
          {flowStep !== "select-requirements" && (
            <Button variant="outline" size="sm" onClick={handleReset} data-testid="button-start-over">
              Start Over
            </Button>
          )}
        </div>
      </header>

      <main className="container py-8 max-w-4xl mx-auto">
        {flowStep === "select-requirements" && (
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
                {loadingRequirements ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : requirements && requirements.length > 0 ? (
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
                ) : (
                  <div className="text-center py-8 space-y-4">
                    <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
                    <div>
                      <p className="text-muted-foreground mb-2">No locked requirements available</p>
                      <p className="text-sm text-muted-foreground">
                        Requirements must be generated and accepted before prompts can be created. 
                        Complete the Requirements Module first.
                      </p>
                    </div>
                    <Link href="/requirements">
                      <Button variant="outline" data-testid="link-requirements">
                        Go to Requirements Module
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
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
                        Follow the STOP/WAIT instructions between steps.
                      </p>
                    </div>
                  </div>
                </div>

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
      </main>
    </div>
  );
}

interface PromptCardProps {
  prompt: BuildPrompt;
  isLast: boolean;
  isCopied: boolean;
  onCopy: () => void;
}

function PromptCard({ prompt, isLast, isCopied, onCopy }: PromptCardProps) {
  return (
    <div className="relative">
      <div className="flex items-start gap-4">
        <div className="flex flex-col items-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary bg-primary text-primary-foreground text-sm font-bold">
            {prompt.step}
          </div>
          {!isLast && (
            <div className="w-0.5 h-full min-h-[100px] bg-border mt-2" />
          )}
        </div>

        <Card className="flex-1">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-lg">{prompt.title}</CardTitle>
                {prompt.dependencies && prompt.dependencies.length > 0 && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">Requires:</span>
                    {prompt.dependencies.map((dep) => (
                      <Badge key={dep} variant="outline" className="text-xs">
                        Step {dep}
                      </Badge>
                    ))}
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
