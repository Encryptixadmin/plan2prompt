import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Brain, Users, Sparkles, FileText, Cpu, CheckCircle2, Loader2, Circle, Zap, Package } from "lucide-react";
import type { ProgressStage } from "@/hooks/use-sse-generation";

const STAGE_ICONS: Record<string, typeof Search> = {
  researching: Search,
  analyzing: Brain,
  building_consensus: Users,
  synthesizing: Sparkles,
  loading_idea: FileText,
  generating: Cpu,
  parsing: Package,
  validating: CheckCircle2,
  loading_requirements: FileText,
  enriching: Zap,
  structuring: Package,
  complete: CheckCircle2,
};

interface GenerationProgressProps {
  stages: ProgressStage[];
  currentStage: string | null;
  isGenerating: boolean;
  startTime: number | null;
  error: string | null;
  module: "ideas" | "requirements" | "prompts";
}

function ElapsedTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return (
    <span className="text-xs text-muted-foreground tabular-nums" data-testid="text-elapsed-time">
      {mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}
    </span>
  );
}

export function GenerationProgress({ stages, currentStage, isGenerating, startTime, error, module }: GenerationProgressProps) {
  const overallPercent = stages.length > 0
    ? Math.round(stages.filter(s => s.status === "complete").length / stages.length * 100)
    : 0;

  return (
    <Card className="border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/30 dark:to-background" data-testid="generation-progress">
      <CardContent className="pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {isGenerating && <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />}
            <h3 className="text-sm font-semibold text-foreground">
              {error ? "Generation Failed" : isGenerating ? "Generating..." : "Generation Complete"}
            </h3>
          </div>
          {startTime && <ElapsedTimer startTime={startTime} />}
        </div>

        <div className="w-full bg-muted rounded-full h-1.5 mb-5">
          <div
            className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${overallPercent}%` }}
            data-testid="progress-bar-fill"
          />
        </div>

        <div className="space-y-3">
          {stages.map((stage, index) => {
            const Icon = STAGE_ICONS[stage.stage] || Circle;
            const isActive = stage.status === "active";
            const isComplete = stage.status === "complete";
            const isPending = stage.status === "pending";

            return (
              <div key={stage.stage} className="flex items-center gap-3" data-testid={`stage-${stage.stage}`}>
                <div className="relative flex-shrink-0">
                  {isComplete ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : isActive ? (
                    <div className="relative">
                      <Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                      <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
                    </div>
                  ) : (
                    <Icon className="h-5 w-5 text-muted-foreground/40" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-tight ${
                    isComplete ? "text-muted-foreground" :
                    isActive ? "text-foreground font-medium" :
                    "text-muted-foreground/50"
                  }`}>
                    {stage.message}
                  </p>
                </div>

                {isActive && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500 flex-shrink-0" />
                )}

                {index < stages.length - 1 && (
                  <div className="hidden" />
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm" data-testid="text-generation-error">
            {error}
          </div>
        )}

        {isGenerating && (
          <p className="mt-4 text-xs text-muted-foreground text-center" data-testid="text-generation-hint">
            This usually takes 30–60 seconds
          </p>
        )}
      </CardContent>
    </Card>
  );
}
