import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  ChevronRight,
  Clock,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type { PromptDocument, IDEType, BuildPrompt, IDE_OPTIONS } from "@shared/types/prompts";

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
}

export default function Prompts() {
  const [selectedRequirements, setSelectedRequirements] = useState<string>("");
  const [selectedIDE, setSelectedIDE] = useState<IDEType | "">("");
  const [generatedPrompts, setGeneratedPrompts] = useState<PromptDocument | null>(null);
  const [copiedStep, setCopiedStep] = useState<number | null>(null);
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

  const handleGenerate = () => {
    if (!selectedRequirements || !selectedIDE) {
      toast({
        title: "Missing Selection",
        description: "Please select both requirements and target IDE",
        variant: "destructive",
      });
      return;
    }

    generateMutation.mutate({
      requirementsArtifactId: selectedRequirements,
      ide: selectedIDE as IDEType,
    });
  };

  const copyPrompt = async (step: number, prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedStep(step);
      toast({
        title: "Copied",
        description: `Step ${step} prompt copied to clipboard`,
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
        </div>
      </header>

      <main className="container py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Select Requirements
                </CardTitle>
                <CardDescription>
                  Choose the requirements document to generate prompts from
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingRequirements ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : requirements && requirements.length > 0 ? (
                  <Select
                    value={selectedRequirements}
                    onValueChange={setSelectedRequirements}
                  >
                    <SelectTrigger data-testid="select-requirements">
                      <SelectValue placeholder="Select requirements..." />
                    </SelectTrigger>
                    <SelectContent>
                      {requirements.map((req) => (
                        <SelectItem key={req.id} value={req.id}>
                          {req.title.replace("Requirements Reference: ", "")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-center py-4">
                    <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No requirements found</p>
                    <Link href="/requirements">
                      <Button variant="ghost" size="sm">
                        Generate requirements first
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Terminal className="h-5 w-5" />
                  Select Target IDE
                </CardTitle>
                <CardDescription>
                  Choose the IDE you'll use to build the app
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  value={selectedIDE}
                  onValueChange={(value) => setSelectedIDE(value as IDEType)}
                >
                  <SelectTrigger data-testid="select-ide">
                    <SelectValue placeholder="Select IDE..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ideOptions.map((ide) => (
                      <SelectItem key={ide.id} value={ide.id}>
                        {ide.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedIDEInfo && (
                  <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {selectedIDEInfo.description}
                    </p>
                    <div>
                      <p className="text-xs font-medium mb-1">Features:</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedIDEInfo.features.map((feature) => (
                          <Badge key={feature} variant="secondary" className="text-xs">
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {selectedIDEInfo.limitations.length > 0 && (
                      <div>
                        <p className="text-xs font-medium mb-1 text-muted-foreground">Notes:</p>
                        <p className="text-xs text-muted-foreground">
                          {selectedIDEInfo.limitations.join(". ")}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Button
              onClick={handleGenerate}
              disabled={!selectedRequirements || !selectedIDE || generateMutation.isPending}
              className="w-full"
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
                  Generate Build Prompts
                </>
              )}
            </Button>
          </div>

          <div className="lg:col-span-2">
            {generatedPrompts ? (
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle>{generatedPrompts.ideaTitle}</CardTitle>
                      <CardDescription>
                        {generatedPrompts.totalSteps} prompts for {generatedPrompts.ideName}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" />
                        {generatedPrompts.estimatedTotalTime}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border bg-muted/50 p-4 mb-6">
                    <h4 className="font-medium mb-2">Instructions</h4>
                    <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Copy each prompt exactly as written</li>
                      <li>Paste into your {generatedPrompts.ideName} AI assistant</li>
                      <li>Wait for the AI to complete the task</li>
                      <li>Verify the expected outcome</li>
                      <li>Follow the STOP/WAIT instruction before proceeding</li>
                    </ol>
                  </div>

                  <ScrollArea className="h-[600px] pr-4">
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
                </CardContent>
              </Card>
            ) : (
              <Card className="h-full min-h-[400px] flex items-center justify-center">
                <div className="text-center space-y-4 p-8">
                  <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <Terminal className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium">No Prompts Generated</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">
                      Select a requirements document and target IDE, then click Generate to create
                      step-by-step build prompts.
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
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
          <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary bg-primary text-primary-foreground text-sm font-medium">
            {prompt.step}
          </div>
          {!isLast && (
            <div className="w-0.5 h-full min-h-[100px] bg-border mt-2" />
          )}
        </div>

        <div className="flex-1 pb-6">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <h4 className="font-semibold">{prompt.title}</h4>
              <p className="text-sm text-muted-foreground">{prompt.objective}</p>
            </div>
            {prompt.estimatedTime && (
              <Badge variant="secondary" className="text-xs shrink-0">
                <Clock className="h-3 w-3 mr-1" />
                {prompt.estimatedTime}
              </Badge>
            )}
          </div>

          {prompt.dependencies && prompt.dependencies.length > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-muted-foreground">Requires:</span>
              {prompt.dependencies.map((dep) => (
                <Badge key={dep} variant="outline" className="text-xs">
                  Step {dep}
                </Badge>
              ))}
            </div>
          )}

          <div className="relative rounded-lg border bg-card">
            <div className="flex items-center justify-between border-b px-4 py-2">
              <span className="text-xs font-medium text-muted-foreground">PROMPT</span>
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
            <pre className="p-4 text-sm overflow-x-auto whitespace-pre-wrap">
              {prompt.prompt}
            </pre>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <div>
                <span className="text-xs font-medium">Expected Outcome</span>
                <p className="text-sm text-muted-foreground">{prompt.expectedOutcome}</p>
              </div>
            </div>

            <div className="rounded-lg border-2 border-amber-500/50 bg-amber-500/10 p-3">
              <div className="flex items-center gap-2">
                <ChevronRight className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  {prompt.waitInstruction}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
