import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useRequireProject } from "@/components/require-project-guard";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  XCircle,
  RotateCcw,
  StopCircle,
  X,
} from "lucide-react";
import type {
  IDEType,
  PromptFeedbackResponse,
  KnownFailureResponse,
  UnknownFailureResponse,
} from "@shared/types/prompts";

interface StepFeedbackFormProps {
  promptDocumentId: string;
  stepNumber: number;
  ide: IDEType;
  ideName: string;
  onClose: () => void;
}

export function StepFeedbackForm({
  promptDocumentId,
  stepNumber,
  ide,
  ideName,
  onClose,
}: StepFeedbackFormProps) {
  const [rawOutput, setRawOutput] = useState("");
  const [response, setResponse] = useState<PromptFeedbackResponse | null>(null);
  const { toast } = useToast();
  const { requireProject, ProjectRequiredDialog } = useRequireProject();

  const feedbackMutation = useMutation({
    mutationFn: async (data: {
      promptDocumentId: string;
      stepNumber: number;
      ide: IDEType;
      rawIdeOutput: string;
    }) => {
      const res = await apiRequest("POST", "/api/prompts/feedback", data);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setResponse(data.data);
      } else {
        toast({
          title: "Classification Failed",
          description: data.error?.message || "Could not classify the failure.",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to process feedback. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!rawOutput.trim()) {
      toast({
        title: "Input Required",
        description: "Paste the raw output from your IDE.",
        variant: "destructive",
      });
      return;
    }

    requireProject(() => {
      feedbackMutation.mutate({
        promptDocumentId,
        stepNumber,
        ide,
        rawIdeOutput: rawOutput,
      });
    });
  };

  const handleReset = () => {
    setRawOutput("");
    setResponse(null);
  };

  if (response) {
    return (
      <Card className="border-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {response.classification === "KNOWN_FAILURE" ? (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              Step {stepNumber} Issue Classified
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-feedback">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {response.classification === "KNOWN_FAILURE" ? (
            <KnownFailureDisplay response={response} />
          ) : (
            <UnknownFailureDisplay response={response} />
          )}

          <Separator />

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset} data-testid="button-try-again">
              <RotateCcw className="h-4 w-4 mr-2" />
              Try Different Output
            </Button>
            <Button variant="ghost" onClick={onClose} data-testid="button-dismiss">
              Dismiss
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-amber-200 dark:border-amber-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Resolve Step {stepNumber} Issue
            </CardTitle>
            <CardDescription>
              Paste the raw output from your IDE. The system will classify the failure.
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-feedback-form">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Step:</span>
              <Badge variant="outline">{stepNumber}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">IDE:</span>
              <Badge variant="outline">{ideName}</Badge>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Raw IDE Output</label>
          <Textarea
            placeholder="Paste the exact error output from your IDE here. Do not paraphrase or summarize."
            value={rawOutput}
            onChange={(e) => setRawOutput(e.target.value)}
            className="min-h-[150px] font-mono text-sm"
            data-testid="textarea-raw-output"
          />
          <p className="text-xs text-muted-foreground">
            Paste only the error output. Do not include screenshots, questions, or descriptions.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleSubmit}
            disabled={feedbackMutation.isPending || !rawOutput.trim()}
            data-testid="button-classify-failure"
          >
            {feedbackMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Classifying...
              </>
            ) : (
              "Classify Failure"
            )}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </CardContent>

      <ProjectRequiredDialog />
    </Card>
  );
}

function KnownFailureDisplay({ response }: { response: KnownFailureResponse }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
        <h4 className="font-semibold text-amber-700 dark:text-amber-400 mb-2">
          {response.failurePatternName}
        </h4>
        <p className="text-sm text-amber-600 dark:text-amber-400/80">
          <span className="font-medium">Why this occurs:</span> {response.whyThisOccurs}
        </p>
      </div>

      <div className="space-y-2">
        <h4 className="font-medium flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          Recovery Steps
        </h4>
        <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
          {response.recoverySteps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </div>

      <div className="rounded-lg border-2 border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/20 p-4">
        <div className="flex items-center gap-2">
          <StopCircle className="h-5 w-5 text-red-500" />
          <span className="font-semibold text-red-700 dark:text-red-400 uppercase text-sm">
            {response.instruction}
          </span>
        </div>
        {response.shouldRetry && (
          <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-2">
            After applying the fix, retry this step. Do not proceed to the next step until this one completes successfully.
          </p>
        )}
      </div>
    </div>
  );
}

function UnknownFailureDisplay({ response }: { response: UnknownFailureResponse }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
        <div className="flex items-center gap-2 mb-2">
          <XCircle className="h-5 w-5 text-red-500" />
          <h4 className="font-semibold text-red-700 dark:text-red-400">Unclassified Failure</h4>
        </div>
        <p className="text-sm text-red-600 dark:text-red-400/80">{response.statement}</p>
      </div>

      <div className="rounded-lg border-2 border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/20 p-4">
        <div className="flex items-center gap-2">
          <StopCircle className="h-5 w-5 text-red-500" />
          <span className="font-semibold text-red-700 dark:text-red-400 uppercase text-sm">
            {response.instruction}
          </span>
        </div>
      </div>
    </div>
  );
}
