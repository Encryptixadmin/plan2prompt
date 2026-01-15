import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  FileText,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Server,
  Database,
  Shield,
  Layout,
  Code,
  ArrowRight,
  FileCode,
  Lightbulb,
  ThumbsUp,
  RefreshCw,
  ArrowLeft,
  Lock,
  FileCheck,
  AlertCircle,
} from "lucide-react";
import type { RequirementsDocument, GenerateRequirementsResponse } from "@shared/types/requirements";
import { StageCard } from "@/components/stage-indicator";
import { ModuleBlockedState } from "@/components/module-blocked-state";
import { ActiveProjectIndicator } from "@/components/active-project-indicator";
import { ProjectSwitcher } from "@/components/project-switcher";
import { useProject } from "@/contexts/project-context";
import { ArtifactPreview } from "@/components/artifact-preview";
import { ConfidenceCopy } from "@/components/commitment-confirmation";

interface IdeaOption {
  id: string;
  title: string;
  version: number;
  createdAt: string;
  stage?: string;
}

interface IdeaPreview {
  id: string;
  title: string;
  version: number;
  createdAt: string;
  stage?: string;
  summary: string;
  overview: string;
  strengths: string;
}

function PriorityBadge({ priority }: { priority: "must-have" | "should-have" | "nice-to-have" | "critical" | "high" | "medium" | "low" }) {
  const variants: Record<string, string> = {
    "must-have": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    "should-have": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    "nice-to-have": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${variants[priority]}`}>
      {priority}
    </span>
  );
}

interface RequirementsResultsProps {
  requirements: RequirementsDocument;
  onAccept: () => void;
  onRegenerate: () => void;
  onGoBack: () => void;
  isAccepting: boolean;
  isAccepted: boolean;
}

function RequirementsResults({ requirements, onAccept, onRegenerate, onGoBack, isAccepting, isAccepted }: RequirementsResultsProps) {
  return (
    <div className="space-y-6">
      {isAccepted && (
        <StageCard 
          currentStage="LOCKED_REQUIREMENTS" 
          artifactId={requirements.artifactId}
          sourceArtifactId={requirements.ideaArtifactId}
        />
      )}
      
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <CardTitle className="text-xl flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Requirements: {requirements.ideaTitle}
              </CardTitle>
              <CardDescription className="max-w-2xl">{requirements.summary}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">v{requirements.version}</Badge>
              {isAccepted && (
                <Badge className="gap-1 bg-green-500">
                  <Lock className="h-3 w-3" />
                  Locked
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {!isAccepted && (
        <Card className="border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-5 w-5" />
              Review Before Accepting
            </CardTitle>
            <CardDescription>
              This requirements document is versioned and will become the source of truth for your project.
              Once accepted, modifying the underlying idea will require creating a new version.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Accordion type="multiple" defaultValue={["functional", "nonfunctional"]} className="space-y-4">
        <AccordionItem value="functional" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900/30">
                <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-left">
                <span className="font-semibold">Functional Requirements</span>
                <span className="text-sm text-muted-foreground ml-2">
                  ({requirements.functionalRequirements.length} items)
                </span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-4">
              {requirements.functionalRequirements.map((fr) => (
                <div key={fr.id} className="p-4 rounded-lg bg-muted/50 space-y-3">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs font-mono">{fr.id}</Badge>
                        <span className="font-medium">{fr.title}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{fr.category}</span>
                    </div>
                    <PriorityBadge priority={fr.priority} />
                  </div>
                  <p className="text-sm text-muted-foreground">{fr.description}</p>
                  <div>
                    <span className="text-xs font-medium">Acceptance Criteria:</span>
                    <ul className="mt-1 space-y-1">
                      {fr.acceptanceCriteria.map((ac, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <CheckCircle className="h-3 w-3 mt-1 text-green-500 flex-shrink-0" />
                          {ac}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {fr.dependencies && fr.dependencies.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">Dependencies:</span> {fr.dependencies.join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="nonfunctional" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-purple-100 dark:bg-purple-900/30">
                <AlertTriangle className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="text-left">
                <span className="font-semibold">Non-Functional Requirements</span>
                <span className="text-sm text-muted-foreground ml-2">
                  ({requirements.nonFunctionalRequirements.length} items)
                </span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="pt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium">ID</th>
                    <th className="text-left py-2 px-2 font-medium">Category</th>
                    <th className="text-left py-2 px-2 font-medium">Title</th>
                    <th className="text-left py-2 px-2 font-medium">Target</th>
                  </tr>
                </thead>
                <tbody>
                  {requirements.nonFunctionalRequirements.map((nfr) => (
                    <tr key={nfr.id} className="border-b last:border-0">
                      <td className="py-2 px-2 font-mono text-xs">{nfr.id}</td>
                      <td className="py-2 px-2">
                        <Badge variant="outline" className="capitalize text-xs">{nfr.category}</Badge>
                      </td>
                      <td className="py-2 px-2">{nfr.title}</td>
                      <td className="py-2 px-2 text-muted-foreground">{nfr.target || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="architecture" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-green-100 dark:bg-green-900/30">
                <Server className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-left">
                <span className="font-semibold">Architecture Overview</span>
                <span className="text-sm text-muted-foreground ml-2">
                  ({requirements.architecture.components.length} components)
                </span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <h4 className="font-medium mb-2">{requirements.architecture.pattern}</h4>
                <p className="text-sm text-muted-foreground">{requirements.architecture.description}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {requirements.architecture.components.map((comp) => (
                  <div key={comp.name} className="p-4 rounded-lg border space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm">{comp.name}</span>
                      <Badge variant="secondary" className="capitalize text-xs">{comp.type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{comp.description}</p>
                    {comp.technologies && (
                      <div className="flex flex-wrap gap-1">
                        {comp.technologies.map((tech) => (
                          <Badge key={tech} variant="outline" className="text-xs">{tech}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <h4 className="font-medium text-sm mb-2">Data Flow</h4>
                <p className="text-sm text-muted-foreground">{requirements.architecture.dataFlow}</p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="datamodels" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-orange-100 dark:bg-orange-900/30">
                <Database className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="text-left">
                <span className="font-semibold">Data Models</span>
                <span className="text-sm text-muted-foreground ml-2">
                  ({requirements.dataModels.length} entities)
                </span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-4">
              {requirements.dataModels.map((model) => (
                <div key={model.name} className="p-4 rounded-lg border space-y-3">
                  <div>
                    <h4 className="font-medium">{model.name}</h4>
                    <p className="text-xs text-muted-foreground">{model.description}</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-1 px-2">Field</th>
                          <th className="text-left py-1 px-2">Type</th>
                          <th className="text-left py-1 px-2">Required</th>
                          <th className="text-left py-1 px-2">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {model.fields.map((field) => (
                          <tr key={field.name} className="border-b last:border-0">
                            <td className="py-1 px-2 font-mono">{field.name}</td>
                            <td className="py-1 px-2">{field.type}</td>
                            <td className="py-1 px-2">{field.required ? "Yes" : "No"}</td>
                            <td className="py-1 px-2 text-muted-foreground">{field.description || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="api" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-cyan-100 dark:bg-cyan-900/30">
                <Code className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div className="text-left">
                <span className="font-semibold">API Contracts</span>
                <span className="text-sm text-muted-foreground ml-2">
                  ({requirements.apiContracts.endpoints.length} endpoints)
                </span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-4">
              <div className="flex flex-wrap gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Base URL:</span>{" "}
                  <code className="px-1 py-0.5 bg-muted rounded text-xs">{requirements.apiContracts.baseUrl}</code>
                </div>
                <div>
                  <span className="text-muted-foreground">Version:</span>{" "}
                  <Badge variant="outline">{requirements.apiContracts.version}</Badge>
                </div>
              </div>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {requirements.apiContracts.endpoints.map((ep, i) => (
                    <div key={i} className="p-3 rounded-lg border space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-xs font-mono ${
                          ep.method === "GET" ? "bg-green-500" :
                          ep.method === "POST" ? "bg-blue-500" :
                          ep.method === "PUT" || ep.method === "PATCH" ? "bg-yellow-500" :
                          "bg-red-500"
                        }`}>
                          {ep.method}
                        </Badge>
                        <code className="text-sm">{ep.path}</code>
                        {ep.authentication && (
                          <Badge variant="outline" className="text-xs">Auth</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{ep.description}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="uiux" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-pink-100 dark:bg-pink-900/30">
                <Layout className="h-4 w-4 text-pink-600 dark:text-pink-400" />
              </div>
              <div className="text-left">
                <span className="font-semibold">UI/UX Principles</span>
                <span className="text-sm text-muted-foreground ml-2">
                  ({requirements.uiuxPrinciples.keyPrinciples.length} principles)
                </span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <h4 className="font-medium text-sm mb-1">Design System</h4>
                <p className="text-sm text-muted-foreground">{requirements.uiuxPrinciples.designSystem}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {requirements.uiuxPrinciples.keyPrinciples.map((p) => (
                  <div key={p.principle} className="p-3 rounded-lg border">
                    <h4 className="font-medium text-sm">{p.principle}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="font-medium text-sm mb-2">User Flows</h4>
                <div className="space-y-3">
                  {requirements.uiuxPrinciples.userFlows.map((uf) => (
                    <div key={uf.name} className="p-3 rounded-lg border">
                      <h5 className="font-medium text-sm">{uf.name}</h5>
                      <p className="text-xs text-muted-foreground mb-2">{uf.description}</p>
                      <ol className="text-xs space-y-1">
                        {uf.steps.map((step, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs flex-shrink-0">
                              {i + 1}
                            </span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="security" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-red-100 dark:bg-red-900/30">
                <Shield className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <div className="text-left">
                <span className="font-semibold">Security Considerations</span>
                <span className="text-sm text-muted-foreground ml-2">
                  ({requirements.securityConsiderations.length} items)
                </span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 pt-4">
              {requirements.securityConsiderations.map((sc, i) => (
                <div key={i} className="p-4 rounded-lg border space-y-2">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <span className="font-medium text-sm">{sc.title}</span>
                      <Badge variant="outline" className="ml-2 capitalize text-xs">{sc.category}</Badge>
                    </div>
                    <PriorityBadge priority={sc.priority} />
                  </div>
                  <p className="text-sm text-muted-foreground">{sc.description}</p>
                  <div className="text-xs">
                    <span className="font-medium">Implementation:</span>{" "}
                    <span className="text-muted-foreground">{sc.implementation}</span>
                  </div>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {!isAccepted && (
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">What would you like to do?</CardTitle>
            <CardDescription>
              Accepting will lock these requirements as the formal specification for your project.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col sm:flex-row gap-3 pt-0">
            <Button
              onClick={onAccept}
              disabled={isAccepting}
              className="flex-1"
              size="lg"
              data-testid="button-accept-requirements"
            >
              {isAccepting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Locking...
                </>
              ) : (
                <>
                  <ThumbsUp className="mr-2 h-4 w-4" />
                  Accept Requirements
                </>
              )}
            </Button>
            <Button
              onClick={onRegenerate}
              variant="outline"
              className="flex-1"
              size="lg"
              data-testid="button-regenerate"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Regenerate
            </Button>
            <Button
              onClick={onGoBack}
              variant="ghost"
              className="flex-1"
              size="lg"
              data-testid="button-go-back"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back to Idea
            </Button>
          </CardFooter>
        </Card>
      )}

      {isAccepted && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" />
              Requirements Locked
            </CardTitle>
            <CardDescription>
              This requirements document is now locked and versioned. Ready for the Prompts Module.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="text-sm">
                <span className="text-muted-foreground">Artifact ID:</span>{" "}
                <code className="px-2 py-0.5 bg-muted rounded text-xs">{requirements.artifactId}</code>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <div className="text-sm">
                <span className="text-muted-foreground">Next Step:</span>{" "}
                <Badge variant="outline" className="gap-1">
                  <ArrowRight className="h-3 w-3" />
                  Prompts Module
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function RequirementsPage() {
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);
  const [ideaPreview, setIdeaPreview] = useState<IdeaPreview | null>(null);
  const [requirements, setRequirements] = useState<RequirementsDocument | null>(null);
  const [isAccepted, setIsAccepted] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);

  const ideasQuery = useQuery<{ success: boolean; data: IdeaOption[] }>({
    queryKey: ["/api/requirements/ideas"],
  });

  const previewMutation = useMutation({
    mutationFn: async (ideaId: string) => {
      const response = await fetch(`/api/requirements/ideas/${ideaId}/preview`);
      return response.json() as Promise<{ success: boolean; data: IdeaPreview }>;
    },
    onSuccess: (data) => {
      if (data.success) {
        setIdeaPreview(data.data);
      }
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (ideaArtifactId: string) => {
      const response = await apiRequest("POST", "/api/requirements/generate", {
        ideaArtifactId,
      });
      return response as unknown as { success: boolean; data: GenerateRequirementsResponse };
    },
    onSuccess: (data) => {
      if (data.success) {
        setRequirements(data.data.requirements);
        setIsAccepted(false);
      }
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (reqs: RequirementsDocument) => {
      const response = await apiRequest("POST", "/api/requirements/accept", {
        requirements: reqs,
      });
      return response as unknown as { success: boolean; data: { requirements: RequirementsDocument } };
    },
    onSuccess: (data) => {
      if (data.success) {
        setRequirements(data.data.requirements);
        setIsAccepted(true);
      }
    },
  });

  const handleIdeaSelect = (ideaId: string) => {
    setSelectedIdeaId(ideaId);
    previewMutation.mutate(ideaId);
  };

  const handleGenerateClick = () => {
    setShowGenerateDialog(true);
  };

  const confirmGenerate = () => {
    if (selectedIdeaId) {
      generateMutation.mutate(selectedIdeaId);
    }
    setShowGenerateDialog(false);
  };

  const handleAccept = () => {
    setShowAcceptDialog(true);
  };

  const confirmAccept = () => {
    if (requirements) {
      acceptMutation.mutate(requirements);
    }
    setShowAcceptDialog(false);
  };

  const handleRegenerate = () => {
    if (selectedIdeaId) {
      generateMutation.mutate(selectedIdeaId);
    }
  };

  const handleGoBack = () => {
    setRequirements(null);
    setIsAccepted(false);
  };

  const handleReset = () => {
    setRequirements(null);
    setSelectedIdeaId(null);
    setIdeaPreview(null);
    setIsAccepted(false);
  };

  const ideas = ideasQuery.data?.data || [];
  const hasValidatedIdeas = ideas.length > 0;
  const showBlockedState = !ideasQuery.isLoading && !hasValidatedIdeas && !requirements;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <FileCode className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold">Requirements Module</h1>
              <p className="text-xs text-muted-foreground">Generate detailed requirements</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ActiveProjectIndicator />
            <ProjectSwitcher />
            {(requirements || isAccepted) && (
              <Button variant="outline" onClick={handleReset} data-testid="button-new-requirements">
                New Requirements
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {ideasQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : showBlockedState ? (
          <ModuleBlockedState type="requirementsNeedsIdea" />
        ) : !requirements ? (
          <div className="space-y-8">
            <div className="text-center space-y-3">
              <h2 className="text-2xl font-bold">Generate Requirements Document</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Convert a validated idea into a structured requirements document. This includes 
                functional requirements, architecture, data models, and security considerations.
              </p>
              <p className="text-sm text-muted-foreground/70 max-w-lg mx-auto">
                Requirements are versioned. Once accepted, they become the reference for all subsequent work.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Select a Validated Idea</CardTitle>
                <CardDescription>
                  Only validated ideas appear here. If none are listed, return to the Ideas Module and complete validation first.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {ideas.length > 0 && (
                  <Select
                    value={selectedIdeaId || ""}
                    onValueChange={handleIdeaSelect}
                  >
                    <SelectTrigger data-testid="select-idea">
                      <SelectValue placeholder="Choose a validated idea..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ideas.map((idea) => (
                        <SelectItem key={idea.id} value={idea.id}>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            {idea.title}
                            <Badge variant="secondary" className="text-xs">v{idea.version}</Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </CardContent>
            </Card>

            {ideaPreview && (
              <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-blue-500" />
                        Idea Preview: {ideaPreview.title}
                      </CardTitle>
                      <CardDescription>
                        Read-only preview of the validated idea artifact
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      Validated
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {ideaPreview.summary && (
                    <div>
                      <h4 className="text-sm font-medium mb-1">Summary</h4>
                      <p className="text-sm text-muted-foreground">{ideaPreview.summary}</p>
                    </div>
                  )}
                  {ideaPreview.overview && (
                    <div>
                      <h4 className="text-sm font-medium mb-1">Overview</h4>
                      <div className="text-sm text-muted-foreground whitespace-pre-line">{ideaPreview.overview}</div>
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <Button
                    onClick={handleGenerateClick}
                    disabled={generateMutation.isPending}
                    className="w-full"
                    size="lg"
                    data-testid="button-generate-requirements"
                  >
                    {generateMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating Requirements...
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        Generate Requirements Document
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            )}

            {generateMutation.isError && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                Failed to generate requirements. Please try again.
              </div>
            )}
          </div>
        ) : (
          <RequirementsResults
            requirements={requirements}
            onAccept={handleAccept}
            onRegenerate={handleRegenerate}
            onGoBack={handleGoBack}
            isAccepting={acceptMutation.isPending}
            isAccepted={isAccepted}
          />
        )}
      </main>

      <AlertDialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Generate Requirements Document?</AlertDialogTitle>
            <AlertDialogDescription>
              You're about to generate detailed requirements from this idea.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {ideaPreview && (
            <div className="my-4">
              <ArtifactPreview
                title={ideaPreview.title}
                metadata={{
                  version: ideaPreview.version,
                  createdAt: ideaPreview.createdAt,
                  stage: ideaPreview.stage === "validated" ? "VALIDATED_IDEA" : ideaPreview.stage === "draft" ? "DRAFT_IDEA" : undefined,
                }}
                rawContent={`# ${ideaPreview.title}\n\n## Summary\n${ideaPreview.summary}\n\n## Overview\n${ideaPreview.overview}\n\n## Strengths\n${ideaPreview.strengths}`}
                maxHeight="200px"
              />
            </div>
          )}

          <div className="bg-muted/50 rounded-md p-3 text-sm text-muted-foreground">
            <strong className="text-foreground">What happens next:</strong>
            <p className="mt-1">Comprehensive requirements will be generated based on the idea analysis. You can review them before accepting.</p>
          </div>

          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel data-testid="button-generate-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmGenerate} data-testid="button-generate-confirm">
              Generate Requirements
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
        <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Lock these requirements?</AlertDialogTitle>
            <AlertDialogDescription>
              You're about to lock these requirements as final.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {requirements && (
            <div className="my-4">
              <ArtifactPreview
                title={requirements.ideaTitle}
                metadata={{
                  version: 1,
                  createdAt: new Date().toISOString(),
                  stage: "LOCKED_REQUIREMENTS",
                }}
                rawContent={`# ${requirements.ideaTitle}\n\n## Summary\n${requirements.summary}\n\n## Functional Requirements\n${requirements.functionalRequirements?.slice(0, 3).map(r => `- ${r.title}`).join('\n') || 'None'}\n\n## Architecture\n${requirements.architecture?.pattern || 'Not specified'}`}
                maxHeight="200px"
              />
            </div>
          )}

          <div className="bg-muted/50 rounded-md p-3 text-sm text-muted-foreground">
            <strong className="text-foreground">What happens next:</strong>
            <p className="mt-1">This creates a stable reference for generating build prompts. The requirements will remain available, but the locked version serves as the baseline.</p>
          </div>

          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel data-testid="button-accept-cancel">Review Again</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAccept} data-testid="button-accept-confirm">
              Yes, Lock Requirements
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
