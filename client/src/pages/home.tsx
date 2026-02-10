import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, FileText, Terminal, ArrowRight, Sparkles, TrendingUp, Clock, CheckCircle2 } from "lucide-react";
import { BillingStatus } from "@/components/billing-status";
import { useProject } from "@/contexts/project-context";

interface ArtifactSummary {
  id: string;
  title: string;
  version: number;
  createdAt: string;
  stage?: string;
}

export default function Home() {
  const { activeProject } = useProject();

  const { data: ideasData } = useQuery<{ success: boolean; data: ArtifactSummary[] }>({
    queryKey: ["/api/ideas"],
    enabled: !!activeProject,
  });

  const { data: requirementsData } = useQuery<{ success: boolean; data: ArtifactSummary[] }>({
    queryKey: ["/api/requirements/ideas"],
    enabled: !!activeProject,
  });

  const ideaCount = ideasData?.data?.length || 0;
  const reqCount = requirementsData?.data?.length || 0;

  const pipelineSteps = [
    {
      title: "Ideas",
      description: "Validate your concepts with AI consensus analysis before committing to building",
      href: "/ideas",
      icon: Lightbulb,
      count: ideaCount,
      countLabel: "validated",
      accentClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      testId: "link-ideas-module",
    },
    {
      title: "Requirements",
      description: "Convert validated ideas into comprehensive technical requirements documents",
      href: "/requirements",
      icon: FileText,
      count: reqCount,
      countLabel: "generated",
      accentClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      testId: "link-requirements-module",
    },
    {
      title: "Prompts",
      description: "Generate sequential, IDE-specific build instructions from your requirements",
      href: "/prompts",
      icon: Terminal,
      count: 0,
      countLabel: "generated",
      accentClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      testId: "link-prompts-module",
    },
  ];

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
                <p className="text-2xl font-semibold">{ideaCount}</p>
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
                <p className="text-2xl font-semibold">{reqCount}</p>
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
                <p className="text-2xl font-semibold">0</p>
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
                <p className="text-2xl font-semibold">{ideaCount > 0 ? "Active" : "Ready"}</p>
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
          <h2 className="text-lg font-semibold tracking-tight">Build Pipeline</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {pipelineSteps.map((step, index) => (
              <Card key={step.title} className="group relative">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className={`h-10 w-10 rounded-md flex items-center justify-center ${step.accentClass}`}>
                      <step.icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground tabular-nums">Step {index + 1}</span>
                  </div>
                  <CardTitle className="text-base mt-3">{step.title}</CardTitle>
                  <CardDescription className="text-sm leading-relaxed mt-1">
                    {step.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Link href={step.href}>
                    <Button variant="outline" className="w-full" data-testid={step.testId}>
                      {step.count > 0 ? `View ${step.title}` : `Start ${step.title}`}
                      <ArrowRight className="ml-2 h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
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
