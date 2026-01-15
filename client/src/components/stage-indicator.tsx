import { CheckCircle2, Circle, ChevronRight } from "lucide-react";
import type { PipelineStage } from "@shared/types/pipeline";

interface StageInfo {
  stage: PipelineStage;
  label: string;
  description: string;
}

const PIPELINE_STAGES: StageInfo[] = [
  { stage: "DRAFT_IDEA", label: "Draft Idea", description: "Initial idea entry" },
  { stage: "VALIDATED_IDEA", label: "Validated", description: "AI analysis complete" },
  { stage: "LOCKED_REQUIREMENTS", label: "Requirements", description: "Specs locked" },
  { stage: "PROMPTS_GENERATED", label: "Build Ready", description: "Prompts generated" },
];

function getStageIndex(stage: PipelineStage): number {
  return PIPELINE_STAGES.findIndex((s) => s.stage === stage);
}

interface StageIndicatorProps {
  currentStage: PipelineStage;
  className?: string;
}

export function StageIndicator({ currentStage, className = "" }: StageIndicatorProps) {
  const currentIndex = getStageIndex(currentStage);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {PIPELINE_STAGES.map((stageInfo, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isPending = index > currentIndex;

        return (
          <div key={stageInfo.stage} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              {isCompleted ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : isCurrent ? (
                <Circle className="h-4 w-4 text-primary fill-primary" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground/40" />
              )}
              <span
                className={`text-sm font-medium ${
                  isCompleted
                    ? "text-green-600 dark:text-green-400"
                    : isCurrent
                    ? "text-foreground"
                    : "text-muted-foreground/50"
                }`}
              >
                {stageInfo.label}
              </span>
            </div>
            {index < PIPELINE_STAGES.length - 1 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground/30" />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface CompactStageIndicatorProps {
  currentStage: PipelineStage;
  className?: string;
}

export function CompactStageIndicator({ currentStage, className = "" }: CompactStageIndicatorProps) {
  const currentIndex = getStageIndex(currentStage);
  const stageInfo = PIPELINE_STAGES[currentIndex];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-xs text-muted-foreground uppercase tracking-wide">Stage:</span>
      <span className="text-sm font-medium text-primary">{stageInfo.label}</span>
      <span className="text-xs text-muted-foreground">
        ({currentIndex + 1} of {PIPELINE_STAGES.length})
      </span>
    </div>
  );
}

interface StageCardProps {
  currentStage: PipelineStage;
  artifactId?: string;
  sourceArtifactId?: string;
  className?: string;
}

export function StageCard({ currentStage, artifactId, sourceArtifactId, className = "" }: StageCardProps) {
  const currentIndex = getStageIndex(currentStage);
  const stageInfo = PIPELINE_STAGES[currentIndex];
  const nextStage = currentIndex < PIPELINE_STAGES.length - 1 ? PIPELINE_STAGES[currentIndex + 1] : null;

  return (
    <div className={`rounded-lg border bg-card p-4 ${className}`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Current Stage</span>
          </div>
          <div className="flex items-center gap-2">
            <Circle className="h-4 w-4 text-primary fill-primary" />
            <span className="font-semibold">{stageInfo.label}</span>
          </div>
          <p className="text-sm text-muted-foreground">{stageInfo.description}</p>
        </div>
        
        {nextStage && (
          <div className="space-y-1 text-right">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Next Step</span>
            <div className="flex items-center gap-2 justify-end">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-muted-foreground">{nextStage.label}</span>
            </div>
          </div>
        )}
        
        {!nextStage && (
          <div className="space-y-1 text-right">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Pipeline</span>
            <div className="flex items-center gap-2 justify-end">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="font-medium text-green-600 dark:text-green-400">Complete</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t">
        <StageIndicator currentStage={currentStage} />
      </div>

      {artifactId && (
        <div className="mt-3 pt-3 border-t">
          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
            <span>Artifact: <code className="bg-muted px-1 py-0.5 rounded">{artifactId.slice(0, 8)}...</code></span>
            {sourceArtifactId && (
              <span>Source: <code className="bg-muted px-1 py-0.5 rounded">{sourceArtifactId.slice(0, 8)}...</code></span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
