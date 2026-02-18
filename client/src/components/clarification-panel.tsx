import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, CheckCircle, X, ChevronDown, ChevronUp, Info, ShieldAlert } from "lucide-react";
import type { ClarificationContract, ClarificationQuestion, IntegrityContext } from "@shared/types/clarification";

interface ClarificationPanelProps {
  projectId: string;
  module?: string;
  inline?: ClarificationContract[];
}

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: ClarificationQuestion;
  value: string;
  onChange: (val: string) => void;
}) {
  switch (question.expectedAnswerType) {
    case "boolean":
      return (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger data-testid={`select-${question.field}`}>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="yes">Yes</SelectItem>
            <SelectItem value="no">No</SelectItem>
          </SelectContent>
        </Select>
      );
    case "select":
      return (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger data-testid={`select-${question.field}`}>
            <SelectValue placeholder="Select an option..." />
          </SelectTrigger>
          <SelectContent>
            {(question.options || []).map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "multi_select": {
      const selected = value ? value.split(",").filter(Boolean) : [];
      return (
        <div className="space-y-1" data-testid={`multi-select-${question.field}`}>
          {(question.options || []).map((opt) => {
            const isChecked = selected.includes(opt);
            return (
              <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {
                    const next = isChecked
                      ? selected.filter((s) => s !== opt)
                      : [...selected, opt];
                    onChange(next.join(","));
                  }}
                  className="rounded border-input"
                />
                {opt}
              </label>
            );
          })}
        </div>
      );
    }
    case "long_text":
      return (
        <Textarea
          data-testid={`textarea-${question.field}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter your response..."
          className="min-h-[80px]"
        />
      );
    case "number":
      return (
        <Input
          data-testid={`input-${question.field}`}
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter a number..."
        />
      );
    default:
      return (
        <Input
          data-testid={`input-${question.field}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter your response..."
        />
      );
  }
}

function ClarificationCard({
  contract,
  onResolve,
  onDismiss,
  isResolving,
}: {
  contract: ClarificationContract;
  onResolve: (id: string, data: Record<string, unknown>) => void;
  onDismiss: (id: string) => void;
  isResolving: boolean;
}) {
  const [expanded, setExpanded] = useState(contract.severity === "blocker");
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const isBlocker = contract.severity === "blocker";
  const isResolved = contract.resolutionStatus !== "pending";

  let integrityCtx: IntegrityContext | null = null;
  if (contract.integrityContext) {
    try {
      integrityCtx = typeof contract.integrityContext === "string"
        ? JSON.parse(contract.integrityContext)
        : contract.integrityContext as IntegrityContext;
    } catch {}
  }

  const handleSubmit = () => {
    onResolve(contract.id, answers);
  };

  const allAnswered = contract.requiredClarifications.every(
    (q) => answers[q.field] && answers[q.field].trim().length > 0
  );

  return (
    <Card
      data-testid={`clarification-card-${contract.id}`}
      className={`p-4 ${isBlocker ? "border-destructive/50" : ""} ${isResolved ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {isBlocker ? (
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          ) : (
            <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm" data-testid={`clarification-title-${contract.id}`}>
                {contract.title}
              </span>
              <Badge variant={isBlocker ? "destructive" : "secondary"}>
                {contract.severity}
              </Badge>
              <Badge variant="outline">{contract.category.replace(/_/g, " ")}</Badge>
              {contract.occurrenceCount > 1 && (
                <Badge variant="outline">x{contract.occurrenceCount}</Badge>
              )}
              {isResolved && (
                <Badge variant="outline" className="text-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {contract.resolutionStatus}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{contract.description}</p>
            {integrityCtx && integrityCtx.integrityLevel === "critical" && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-destructive" data-testid={`integrity-warning-${contract.id}`}>
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                <span>This step involves irreversible changes. Refinement required before proceeding.</span>
              </div>
            )}
          </div>
        </div>
        {!isResolved && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setExpanded(!expanded)}
              data-testid={`btn-toggle-${contract.id}`}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            {!isBlocker && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onDismiss(contract.id)}
                data-testid={`btn-dismiss-${contract.id}`}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {expanded && !isResolved && (
        <div className="mt-3 space-y-3 border-t pt-3">
          {contract.requiredClarifications.map((q) => (
            <div key={q.field} className="space-y-1">
              <label className="text-sm font-medium">{q.question}</label>
              <QuestionField
                question={q}
                value={answers[q.field] || ""}
                onChange={(val) => setAnswers((prev) => ({ ...prev, [q.field]: val }))}
              />
            </div>
          ))}
          <div className="flex justify-end gap-2">
            <Button
              variant="default"
              size="sm"
              disabled={!allAnswered || isResolving}
              onClick={handleSubmit}
              data-testid={`btn-resolve-${contract.id}`}
            >
              {isResolving ? "Resolving..." : "Resolve"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export function ClarificationPanel({ projectId, module, inline }: ClarificationPanelProps) {
  const { data, isLoading } = useQuery<{
    contracts: ClarificationContract[];
    hasBlockers: boolean;
  }>({
    queryKey: ["/api/clarifications/pending", projectId, module],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (module) params.set("module", module);
      const res = await fetch(`/api/clarifications/pending?${params}`, {
        headers: { "x-project-id": projectId },
      });
      const json = await res.json();
      return json.data;
    },
    enabled: !inline,
    refetchInterval: 30000,
  });

  const contracts = inline || data?.contracts || [];
  const hasBlockers = inline
    ? inline.some((c) => c.severity === "blocker")
    : data?.hasBlockers || false;

  const resolveMutation = useMutation({
    mutationFn: async ({ id, resolutionData }: { id: string; resolutionData: Record<string, unknown> }) => {
      await apiRequest("POST", `/api/clarifications/${id}/resolve`, { resolutionData });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clarifications/pending"] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/clarifications/${id}/dismiss`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clarifications/pending"] });
    },
  });

  const pendingContracts = contracts.filter((c) => c.resolutionStatus === "pending");

  if (isLoading && !inline) return null;
  if (pendingContracts.length === 0) return null;

  return (
    <div data-testid="clarification-panel" className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className={`h-4 w-4 ${hasBlockers ? "text-destructive" : "text-yellow-500"}`} />
        <h3 className="text-sm font-semibold">
          {hasBlockers ? "Blockers Detected" : "Clarifications Needed"}
        </h3>
        <Badge variant={hasBlockers ? "destructive" : "secondary"}>
          {pendingContracts.length}
        </Badge>
      </div>
      {hasBlockers && (
        <p className="text-xs text-muted-foreground">
          Blocker-level issues must be resolved before proceeding. Resolve all blockers to continue.
        </p>
      )}
      <div className="space-y-2">
        {pendingContracts.map((contract) => (
          <ClarificationCard
            key={contract.id}
            contract={contract}
            onResolve={(id, data) => resolveMutation.mutate({ id, resolutionData: data })}
            onDismiss={(id) => dismissMutation.mutate(id)}
            isResolving={resolveMutation.isPending}
          />
        ))}
      </div>
    </div>
  );
}
