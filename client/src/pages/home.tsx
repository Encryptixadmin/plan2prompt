import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Lightbulb, FileText, Terminal, ArrowRight, Sparkles, TrendingUp, CheckCircle2, Circle, ChevronRight } from "lucide-react";
import { BillingStatus } from "@/components/billing-status";
import { useProject } from "@/contexts/project-context";

interface PipelineItem {
  id: string;
  title: string;
  stage: string;
  createdAt: string;
  requirementsCount: number;
  promptsCount: number;
  latestRequirementsId: string | null;
  latestPromptsId: string | null;
}

function getStageBadge(stage: string) {
  switch (stage) {
    case "prompts_generated":
      return { label: "Complete", variant: "default" as const, className: "bg-emerald-600 dark:bg-emerald-500 text-white border-emerald-600 dark:border-emerald-500" };
    case "requirements_generated":
      return { label: "Requirements Ready", variant: "default" as const, className: "bg-blue-600 dark:bg-blue-500 text-white border-blue-600 dark:border-blue-500" };
    case "idea_validated":
    case "idea_submitted":
    default:
      return { label: "Idea Validated", variant: "default" as const, className: "bg-amber-600 dark:bg-amber-500 text-white border-amber-600 dark:border-amber-500" };
  }
}

function getNextAction(item: PipelineItem): { label: string; href: string; testId: string } {
  if (item.promptsCount > 0) {
    return { label: "View Prompts", href: "/prompts", testId: `button-view-prompts-${item.id}` };
  }
  if (item.requirementsCount > 0) {
    return { label: "Generate Prompts", href: "/prompts", testId: `button-generate-prompts-${item.id}` };
  }
  return { label: "Generate Requirements", href: "/requirements", testId: `button-generate-requirements-${item.id}` };
}

function PipelineStepIndicator({ stage }: { stage: string }) {
  const ideaDone = true;
  const reqDone = stage === "requirements_generated" || stage === "prompts_generated";
  const promptsDone = stage === "prompts_generated";

  const steps = [
    { label: "Idea", done: ideaDone, icon: Lightbulb },
    { label: "Requirements", done: reqDone, icon: FileText },
    { label: "Prompts", done: promptsDone, icon: Terminal },
  ];

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-1">
          <div className="flex items-center gap-1.5">
            {step.done ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground/40" />
            )}
            <span className={`text-xs ${step.done ? "text-foreground font-medium" : "text-muted-foreground"}`}>
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <ChevronRight className="h-3 w-3 text-muted-foreground/40 mx-0.5" />
          )}
        </div>
      ))}
    </div>
  );
}

function PipelineRow({ item }: { item: PipelineItem }) {
  const stageBadge = getStageBadge(item.stage);
  const nextAction = getNextAction(item);

  return (
    <Card data-testid={`card-pipeline-item-${item.id}`}>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span className="text-sm font-medium truncate" data-testid={`text-pipeline-title-${item.id}`}>
                {item.title}
              </span>
              <Badge className={stageBadge.className} data-testid={`badge-pipeline-stage-${item.id}`}>
                {stageBadge.label}
              </Badge>
            </div>
            <PipelineStepIndicator stage={item.stage} />
          </div>
          <Link href={nextAction.href}>
            <Button variant="outline" size="sm" data-testid={nextAction.testId}>
              {nextAction.label}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const { activeProject } = useProject();

  const { data: pipelineData, isLoading: pipelineLoading } = useQuery<{ success: boolean; data: PipelineItem[] }>({
    queryKey: ["/api/projects", activeProject?.id, "pipeline"],
    enabled: !!activeProject?.id,
  });

  const pipeline = pipelineData?.data || [];
  const ideaCount = pipeline.length;
  const reqCount = pipeline.reduce((sum, item) => sum + item.requirementsCount, 0);
  const promptsCount = pipeline.reduce((sum, item) => sum + item.promptsCount, 0);

  return (
    <div className="p-6 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-10">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Your build pipeline overview. Start with an idea and work through each stage.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ideas</p>
                <p className="text-2xl font-semibold" data-testid="text-metric-ideas">{ideaCount}</p>
              </div>
              <div className="h-10 w-10 rounded-md bg-amber-500/10 flex items-center justify-center">
                <Lightbulb className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Requirements</p>
                <p className="text-2xl font-semibold" data-testid="text-metric-requirements">{reqCount}</p>
              </div>
              <div className="h-10 w-10 rounded-md bg-blue-500/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Build Prompts</p>
                <p className="text-2xl font-semibold" data-testid="text-metric-prompts">{promptsCount}</p>
              </div>
              <div className="h-10 w-10 rounded-md bg-emerald-500/10 flex items-center justify-center">
                <Terminal className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pipeline</p>
                <p className="text-2xl font-semibold" data-testid="text-metric-pipeline">{ideaCount > 0 ? "Active" : "Ready"}</p>
              </div>
              <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                {ideaCount > 0 ? (
                  <TrendingUp className="h-5 w-5 text-primary" />
                ) : (
                  <Sparkles className="h-5 w-5 text-primary" />
                )}
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <h2 className="text-lg font-semibold tracking-tight">Pipeline Tracker</h2>
          {pipelineLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Card key={i} className="p-4">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-5 w-24 rounded-md ml-auto" />
                  </div>
                </Card>
              ))}
            </div>
          ) : pipeline.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="mx-auto h-12 w-12 rounded-md bg-amber-500/10 flex items-center justify-center mb-4">
                  <Lightbulb className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <p className="text-sm font-medium mb-1" data-testid="text-pipeline-empty">Submit your first idea to see it here</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Each idea flows through the pipeline: Idea → Requirements → Build Prompts
                </p>
                <Link href="/ideas">
                  <Button variant="outline" data-testid="link-start-first-idea">
                    Go to Ideas
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3" data-testid="list-pipeline-items">
              {pipeline.map((item) => (
                <PipelineRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-5">
            <h2 className="text-lg font-semibold tracking-tight">Getting Started</h2>
            <Card>
              <CardContent className="p-6 space-y-5">
                <div className="flex items-start gap-4">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-primary">1</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Submit your app idea</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Describe your concept and get AI-powered consensus analysis
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-primary">2</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Generate requirements</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Turn validated ideas into comprehensive technical specs
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-primary">3</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Get build prompts</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Receive step-by-step instructions tailored to your IDE
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-5">
            <h2 className="text-lg font-semibold tracking-tight">Usage</h2>
            <BillingStatus />
          </div>
        </div>
      </div>
    </div>
  );
}
