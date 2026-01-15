import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
import type { RequirementsDocument, GenerateRequirementsResponse } from "@shared/types/requirements";
import { StageCard } from "@/components/stage-indicator";

interface IdeaOption {
  id: string;
  title: string;
  version: number;
  createdAt: string;
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

function RequirementsResults({ requirements }: { requirements: RequirementsDocument }) {
  return (
    <div className="space-y-6">
      <StageCard 
        currentStage="LOCKED_REQUIREMENTS" 
        artifactId={requirements.artifactId}
        sourceArtifactId={requirements.ideaArtifactId}
      />
      
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
            <Badge variant="outline">v{requirements.version}</Badge>
          </div>
        </CardHeader>
      </Card>

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

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-primary" />
            Ready for Development
          </CardTitle>
          <CardDescription>
            This requirements document is complete and ready for the development phase.
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
              <span className="text-muted-foreground">Module:</span>{" "}
              <Badge variant="outline">requirements</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RequirementsPage() {
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);
  const [requirements, setRequirements] = useState<RequirementsDocument | null>(null);

  const ideasQuery = useQuery<{ success: boolean; data: IdeaOption[] }>({
    queryKey: ["/api/requirements/ideas"],
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
      }
    },
  });

  const handleGenerate = () => {
    if (selectedIdeaId) {
      generateMutation.mutate(selectedIdeaId);
    }
  };

  const handleReset = () => {
    setRequirements(null);
    setSelectedIdeaId(null);
  };

  const ideas = ideasQuery.data?.data || [];

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
          {requirements && (
            <Button variant="outline" onClick={handleReset} data-testid="button-new-requirements">
              New Requirements
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {!requirements ? (
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Generate Requirements Document</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Select a validated idea to convert into a comprehensive requirements document
                including functional requirements, architecture, data models, and more.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Select an Idea</CardTitle>
                <CardDescription>
                  Choose from your validated ideas to generate requirements.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {ideasQuery.isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : ideas.length === 0 ? (
                  <div className="text-center py-8 space-y-4">
                    <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground" />
                    <div>
                      <p className="font-medium">No Ideas Available</p>
                      <p className="text-sm text-muted-foreground">
                        You need to validate an idea first before generating requirements.
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => window.location.href = "/ideas"} data-testid="link-ideas">
                      Go to Ideas Module
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Validated Idea</label>
                      <Select
                        value={selectedIdeaId || undefined}
                        onValueChange={setSelectedIdeaId}
                      >
                        <SelectTrigger data-testid="select-idea">
                          <SelectValue placeholder="Select an idea..." />
                        </SelectTrigger>
                        <SelectContent>
                          {ideas.map((idea) => (
                            <SelectItem key={idea.id} value={idea.id}>
                              {idea.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      onClick={handleGenerate}
                      disabled={!selectedIdeaId || generateMutation.isPending}
                      className="w-full"
                      data-testid="button-generate"
                    >
                      {generateMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating Requirements...
                        </>
                      ) : (
                        <>
                          <FileText className="mr-2 h-4 w-4" />
                          Generate Requirements
                        </>
                      )}
                    </Button>

                    {generateMutation.isError && (
                      <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                        Failed to generate requirements. Please try again.
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <RequirementsResults requirements={requirements} />
        )}
      </main>
    </div>
  );
}
