import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  CheckCircle, 
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import type { IdeaAnalysis } from "@shared/types/ideas";

interface WorkshopComparisonProps {
  previousAnalysis: IdeaAnalysis;
  newAnalysis: IdeaAnalysis;
}

function getScoreColor(score: number): string {
  if (score >= 75) return "text-green-600 dark:text-green-400";
  if (score >= 50) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function getRecommendationBadge(recommendation: "proceed" | "revise" | "stop") {
  switch (recommendation) {
    case "proceed":
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
          <CheckCircle className="h-3 w-3 mr-1" />
          Proceed
        </Badge>
      );
    case "revise":
      return (
        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Revise
        </Badge>
      );
    case "stop":
      return (
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
          <Minus className="h-3 w-3 mr-1" />
          Stop
        </Badge>
      );
  }
}

interface ResolvedRisk {
  category: string;
  description: string;
}

interface UnresolvedRisk {
  category: string;
  description: string;
  severity: string;
}

interface AssumptionTransition {
  assumption: string;
  previousStatus: string;
  newStatus: string;
}

interface RiskSeverityChange {
  category: string;
  description: string;
  previousSeverity: string;
  newSeverity: string;
}

function calculateImprovements(
  prev: IdeaAnalysis,
  next: IdeaAnalysis
): { 
  improvements: string[]; 
  unresolvedIssues: string[]; 
  resolvedRisks: ResolvedRisk[];
  remainingRisks: UnresolvedRisk[];
  resolvedAssumptions: string[];
  remainingAssumptions: string[];
  assumptionTransitions: AssumptionTransition[];
  riskSeverityChanges: RiskSeverityChange[];
} {
  const improvements: string[] = [];
  const unresolvedIssues: string[] = [];
  const resolvedRisks: ResolvedRisk[] = [];
  const remainingRisks: UnresolvedRisk[] = [];
  const resolvedAssumptions: string[] = [];
  const remainingAssumptions: string[] = [];
  const assumptionTransitions: AssumptionTransition[] = [];
  const riskSeverityChanges: RiskSeverityChange[] = [];

  const scoreDiff = next.overallScore - prev.overallScore;
  if (scoreDiff > 0) {
    improvements.push(`Overall score improved by ${scoreDiff} points`);
  }

  if (next.feasibility.market.score > prev.feasibility.market.score) {
    const diff = next.feasibility.market.score - prev.feasibility.market.score;
    improvements.push(`Market feasibility improved (+${diff} points)`);
  }

  if (next.feasibility.technical.score > prev.feasibility.technical.score) {
    const diff = next.feasibility.technical.score - prev.feasibility.technical.score;
    improvements.push(`Technical feasibility improved (+${diff} points)`);
  }

  if (prev.technicalProfile && next.technicalProfile) {
    if (prev.technicalProfile.estimatedMvpEffortWeeks > next.technicalProfile.estimatedMvpEffortWeeks) {
      improvements.push(`MVP effort reduced from ${prev.technicalProfile.estimatedMvpEffortWeeks} to ${next.technicalProfile.estimatedMvpEffortWeeks} weeks`);
    }
    if (prev.technicalProfile.complianceExposure !== next.technicalProfile.complianceExposure) {
      const complianceOrder: Record<string, number> = { "None": 0, "Low": 1, "Moderate": 2, "High": 3 };
      if ((complianceOrder[next.technicalProfile.complianceExposure] ?? 2) < (complianceOrder[prev.technicalProfile.complianceExposure] ?? 2)) {
        improvements.push(`Compliance exposure reduced from ${prev.technicalProfile.complianceExposure} to ${next.technicalProfile.complianceExposure}`);
      }
    }
  }

  if (prev.commercialProfile && next.commercialProfile) {
    const diffOrder: Record<string, number> = { "Weak": 0, "Moderate": 1, "Strong": 2 };
    if ((diffOrder[next.commercialProfile.differentiationStrength] ?? 1) > (diffOrder[prev.commercialProfile.differentiationStrength] ?? 1)) {
      improvements.push(`Differentiation strength improved to ${next.commercialProfile.differentiationStrength}`);
    }
    const clarityOrder: Record<string, number> = { "Unclear": 0, "Partially Defined": 1, "Defined": 2 };
    if ((clarityOrder[next.commercialProfile.marketClarity] ?? 1) > (clarityOrder[prev.commercialProfile.marketClarity] ?? 1)) {
      improvements.push(`Market clarity improved to ${next.commercialProfile.marketClarity}`);
    }
  }

  if (prev.viabilityAssessment && next.viabilityAssessment) {
    const viabilityOrder: Record<string, number> = { "Critical Risk": 0, "Weak": 1, "Moderate": 2, "Strong": 3 };
    if ((viabilityOrder[next.viabilityAssessment.overallViability] ?? 2) > (viabilityOrder[prev.viabilityAssessment.overallViability] ?? 2)) {
      improvements.push(`Viability upgraded from ${prev.viabilityAssessment.overallViability} to ${next.viabilityAssessment.overallViability}`);
    }
  }

  prev.risks.forEach((prevRisk, prevIndex) => {
    const prevRiskId = `risk_${prevRisk.category}_${prevIndex}`;
    
    const nextRisk = next.risks.find((r, i) => 
      `risk_${r.category}_${i}` === prevRiskId || 
      (r.category === prevRisk.category && r.description === prevRisk.description)
    );
    
    if (nextRisk) {
      if (prevRisk.severity !== nextRisk.severity) {
        const severityOrder = { high: 3, medium: 2, low: 1 };
        const prevOrder = severityOrder[prevRisk.severity as keyof typeof severityOrder] || 0;
        const nextOrder = severityOrder[nextRisk.severity as keyof typeof severityOrder] || 0;
        
        if (nextOrder < prevOrder) {
          riskSeverityChanges.push({
            category: prevRisk.category,
            description: prevRisk.description,
            previousSeverity: prevRisk.severity,
            newSeverity: nextRisk.severity,
          });
        }
      }
    } else {
      resolvedRisks.push({
        category: prevRisk.category,
        description: prevRisk.description,
      });
    }
  });

  if (resolvedRisks.length > 0) {
    improvements.push(`${resolvedRisks.length} risk(s) addressed`);
  }
  
  if (riskSeverityChanges.length > 0) {
    improvements.push(`${riskSeverityChanges.length} risk(s) reduced in severity`);
  }

  prev.assumptionDependencies.forEach((prevAssumption, index) => {
    const nextAssumption = next.assumptionDependencies[index];
    if (nextAssumption && prevAssumption.assumption === nextAssumption.assumption) {
      if (prevAssumption.status !== nextAssumption.status) {
        const statusOrder = { unvalidated: 0, risky: 1, validated: 2 };
        const prevOrder = statusOrder[prevAssumption.status as keyof typeof statusOrder] ?? 0;
        const nextOrder = statusOrder[nextAssumption.status as keyof typeof statusOrder] ?? 0;
        
        if (nextOrder > prevOrder) {
          assumptionTransitions.push({
            assumption: prevAssumption.assumption,
            previousStatus: prevAssumption.status,
            newStatus: nextAssumption.status,
          });
          
          if (nextAssumption.status === "validated") {
            resolvedAssumptions.push(prevAssumption.assumption);
          }
        }
      }
    }
  });

  const partiallyValidated = assumptionTransitions.filter(
    t => t.previousStatus === "unvalidated" && t.newStatus === "risky"
  ).length;
  
  if (partiallyValidated > 0) {
    improvements.push(`${partiallyValidated} assumption(s) partially validated`);
  }
  
  if (resolvedAssumptions.length > 0) {
    improvements.push(`${resolvedAssumptions.length} assumption(s) fully validated`);
  }

  if (next.recommendation !== "stop" && prev.recommendation === "stop") {
    improvements.push("Recommendation upgraded from STOP");
  }

  if (next.recommendation === "proceed" && prev.recommendation === "revise") {
    improvements.push("Recommendation upgraded to PROCEED");
  }

  next.risks.forEach((risk) => {
    remainingRisks.push({
      category: risk.category,
      description: risk.description,
      severity: risk.severity,
    });
  });

  const highSeverityRemaining = remainingRisks.filter(r => r.severity === "high");
  if (highSeverityRemaining.length > 0) {
    unresolvedIssues.push(`${highSeverityRemaining.length} high-severity risk(s) remain`);
  }

  next.assumptionDependencies
    .filter(a => a.status === "unvalidated")
    .forEach((assumption) => {
      remainingAssumptions.push(assumption.assumption);
    });

  if (remainingAssumptions.length > 0) {
    unresolvedIssues.push(`${remainingAssumptions.length} assumption(s) still unvalidated`);
  }

  if (next.scopeWarnings.length > 0) {
    unresolvedIssues.push(`${next.scopeWarnings.length} scope warning(s) remain`);
  }

  if (next.recommendation === "stop") {
    unresolvedIssues.push("Recommendation is still STOP");
  }

  return { 
    improvements, 
    unresolvedIssues, 
    resolvedRisks, 
    remainingRisks, 
    resolvedAssumptions, 
    remainingAssumptions,
    assumptionTransitions,
    riskSeverityChanges,
  };
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    market: "Market",
    technical: "Technical",
    financial: "Financial",
    legal: "Legal",
    competitive: "Competitive",
    execution: "Execution",
  };
  return labels[category] || category;
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    unvalidated: "Unvalidated",
    validated: "Validated",
    risky: "Partially Validated",
  };
  return labels[status] || status;
}

export function WorkshopComparison({
  previousAnalysis,
  newAnalysis,
}: WorkshopComparisonProps) {
  const scoreDiff = newAnalysis.overallScore - previousAnalysis.overallScore;
  const { 
    improvements, 
    unresolvedIssues, 
    resolvedRisks, 
    remainingRisks, 
    resolvedAssumptions, 
    remainingAssumptions,
    assumptionTransitions,
    riskSeverityChanges,
  } = calculateImprovements(previousAnalysis, newAnalysis);

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          Workshop Results: Before & After
        </CardTitle>
        <CardDescription>
          Compare how your idea analysis changed after providing additional context.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="text-center p-4 rounded-lg bg-muted/50" data-testid="score-previous">
            <p className="text-sm text-muted-foreground mb-1">Previous Score</p>
            <p className={`text-3xl font-bold ${getScoreColor(previousAnalysis.overallScore)}`}>
              {previousAnalysis.overallScore}
            </p>
            <div className="mt-2">
              {getRecommendationBadge(previousAnalysis.recommendation)}
            </div>
          </div>

          <div className="flex justify-center">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
              scoreDiff > 0 
                ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                : scoreDiff < 0
                  ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400"
                  : "bg-muted text-muted-foreground"
            }`} data-testid="score-diff">
              {scoreDiff > 0 ? (
                <TrendingUp className="h-5 w-5" />
              ) : scoreDiff < 0 ? (
                <TrendingDown className="h-5 w-5" />
              ) : (
                <Minus className="h-5 w-5" />
              )}
              <span className="font-bold">
                {scoreDiff > 0 ? `+${scoreDiff}` : scoreDiff}
              </span>
            </div>
          </div>

          <div className="text-center p-4 rounded-lg bg-muted/50" data-testid="score-new">
            <p className="text-sm text-muted-foreground mb-1">New Score</p>
            <p className={`text-3xl font-bold ${getScoreColor(newAnalysis.overallScore)}`}>
              {newAnalysis.overallScore}
            </p>
            <div className="mt-2">
              {getRecommendationBadge(newAnalysis.recommendation)}
            </div>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle className="h-4 w-4" />
              What Improved
            </h4>
            
            {improvements.length > 0 && (
              <ul className="space-y-2" data-testid="improvements-list">
                {improvements.map((improvement, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <ArrowRight className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                    {improvement}
                  </li>
                ))}
              </ul>
            )}

            {resolvedRisks.length > 0 && (
              <div className="mt-3" data-testid="resolved-risks">
                <p className="text-xs font-medium text-muted-foreground mb-2">Risks Addressed:</p>
                <ul className="space-y-1.5">
                  {resolvedRisks.map((risk, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                      <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0">
                        {getCategoryLabel(risk.category)}
                      </Badge>
                      <span className="line-clamp-2">{risk.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {assumptionTransitions.length > 0 && (
              <div className="mt-3" data-testid="assumption-transitions">
                <p className="text-xs font-medium text-muted-foreground mb-2">Assumption Status Changes:</p>
                <ul className="space-y-1.5">
                  {assumptionTransitions.map((transition, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                      <span className="flex-shrink-0 flex items-center gap-1">
                        <Badge className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 px-1 py-0">
                          {getStatusLabel(transition.previousStatus)}
                        </Badge>
                        <ArrowRight className="h-3 w-3" />
                        <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-1 py-0">
                          {getStatusLabel(transition.newStatus)}
                        </Badge>
                      </span>
                      <span className="line-clamp-2">{transition.assumption}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {riskSeverityChanges.length > 0 && (
              <div className="mt-3" data-testid="risk-severity-changes">
                <p className="text-xs font-medium text-muted-foreground mb-2">Risk Severity Reduced:</p>
                <ul className="space-y-1.5">
                  {riskSeverityChanges.map((change, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                      <span className="flex-shrink-0 flex items-center gap-1">
                        <Badge className="text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 px-1 py-0">
                          {change.previousSeverity}
                        </Badge>
                        <ArrowRight className="h-3 w-3" />
                        <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-1 py-0">
                          {change.newSeverity}
                        </Badge>
                      </span>
                      <span className="line-clamp-2">[{getCategoryLabel(change.category)}] {change.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {resolvedAssumptions.length > 0 && (
              <div className="mt-3" data-testid="resolved-assumptions">
                <p className="text-xs font-medium text-muted-foreground mb-2">Assumptions Fully Validated:</p>
                <ul className="space-y-1.5">
                  {resolvedAssumptions.map((assumption, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                      <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{assumption}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {improvements.length === 0 && resolvedRisks.length === 0 && resolvedAssumptions.length === 0 && assumptionTransitions.length === 0 && riskSeverityChanges.length === 0 && (
              <p className="text-sm text-muted-foreground">No improvements detected.</p>
            )}
          </div>

          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="h-4 w-4" />
              What Remains Unresolved
            </h4>
            
            {unresolvedIssues.length > 0 && (
              <ul className="space-y-2" data-testid="unresolved-issues-list">
                {unresolvedIssues.map((issue, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <ArrowRight className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                    {issue}
                  </li>
                ))}
              </ul>
            )}

            {remainingRisks.filter(r => r.severity === "high").length > 0 && (
              <div className="mt-3" data-testid="remaining-high-risks">
                <p className="text-xs font-medium text-muted-foreground mb-2">High-Severity Risks Remaining:</p>
                <ul className="space-y-1.5">
                  {remainingRisks
                    .filter(r => r.severity === "high")
                    .map((risk, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                        <Badge className="text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0">
                          {getCategoryLabel(risk.category)}
                        </Badge>
                        <span className="line-clamp-2">{risk.description}</span>
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {remainingAssumptions.length > 0 && (
              <div className="mt-3" data-testid="remaining-assumptions">
                <p className="text-xs font-medium text-muted-foreground mb-2">Assumptions Still Unvalidated:</p>
                <ul className="space-y-1.5">
                  {remainingAssumptions.slice(0, 3).map((assumption, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                      <AlertTriangle className="h-3 w-3 text-yellow-500 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{assumption}</span>
                    </li>
                  ))}
                  {remainingAssumptions.length > 3 && (
                    <li className="text-xs text-muted-foreground">
                      ...and {remainingAssumptions.length - 3} more
                    </li>
                  )}
                </ul>
              </div>
            )}

            {unresolvedIssues.length === 0 && remainingRisks.filter(r => r.severity === "high").length === 0 && remainingAssumptions.length === 0 && (
              <p className="text-sm text-muted-foreground">All major issues resolved!</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
