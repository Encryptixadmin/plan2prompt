/**
 * Workshop Resolution Engine
 * 
 * Evaluates workshop answers to:
 * 1. Resolve assumptions (unvalidated → partially_validated → validated)
 * 2. Adjust risk severities based on assumption resolution
 */

import type { IdeaAnalysis } from "@shared/types/ideas";
import type { 
  WorkshopSection, 
  WorkshopAnswer, 
  WorkshopResolutionResult,
  AssumptionResolution,
  RiskResolution,
  AssumptionStatus,
  RiskSeverity 
} from "@shared/types/workshop";

interface AnswerQuality {
  hasEvidence: boolean;
  isSpecific: boolean;
  isSubstantive: boolean;
}

function assessAnswerQuality(value: string | string[]): AnswerQuality {
  const text = Array.isArray(value) ? value.join(" ") : value;
  const wordCount = text.trim().split(/\s+/).length;
  
  return {
    hasEvidence: wordCount > 10 || 
      text.toLowerCase().includes("interview") ||
      text.toLowerCase().includes("survey") ||
      text.toLowerCase().includes("research") ||
      text.toLowerCase().includes("tested") ||
      text.toLowerCase().includes("validated") ||
      text.toLowerCase().includes("data") ||
      text.toLowerCase().includes("customer"),
    isSpecific: wordCount > 5 && !text.includes("not yet") && !text.includes("none"),
    isSubstantive: wordCount > 3 && text.toLowerCase() !== "none" && text.toLowerCase() !== "n/a",
  };
}

function determineNewAssumptionStatus(
  currentStatus: AssumptionStatus,
  answerQuality: AnswerQuality
): AssumptionStatus {
  if (!answerQuality.isSubstantive) {
    return currentStatus;
  }
  
  if (answerQuality.hasEvidence && answerQuality.isSpecific) {
    return "validated";
  }
  
  if (answerQuality.isSpecific) {
    return currentStatus === "unvalidated" ? "partially_validated" : currentStatus;
  }
  
  return currentStatus;
}

function adjustRiskSeverity(
  currentSeverity: RiskSeverity,
  relatedAssumptionsImproved: number
): RiskSeverity {
  if (relatedAssumptionsImproved === 0) {
    return currentSeverity;
  }
  
  if (relatedAssumptionsImproved >= 2) {
    if (currentSeverity === "high") return "low";
    if (currentSeverity === "medium") return "low";
  }
  
  if (relatedAssumptionsImproved >= 1) {
    if (currentSeverity === "high") return "medium";
  }
  
  return currentSeverity;
}

export function resolveWorkshopAnswers(
  analysis: IdeaAnalysis,
  sections: WorkshopSection[],
  answers: WorkshopAnswer[]
): WorkshopResolutionResult {
  const assumptionResolutions: AssumptionResolution[] = [];
  const riskResolutions: RiskResolution[] = [];
  
  const assumptionImprovements = new Map<number, boolean>();
  const riskImprovements = new Map<string, number>();
  
  for (const answer of answers) {
    const quality = assessAnswerQuality(answer.value);
    
    for (const assumptionId of answer.mappedAssumptionIds) {
      const match = assumptionId.match(/^assumption_(\d+)$/);
      if (!match) continue;
      
      const assumptionIndex = parseInt(match[1], 10);
      const assumption = analysis.assumptionDependencies[assumptionIndex];
      
      if (assumption && !assumptionImprovements.has(assumptionIndex)) {
        const previousStatus = assumption.status as AssumptionStatus;
        const newStatus = determineNewAssumptionStatus(previousStatus, quality);
        
        if (newStatus !== previousStatus) {
          assumptionResolutions.push({
            assumptionIndex,
            assumptionText: assumption.assumption,
            previousStatus,
            newStatus,
            evidenceProvided: answer.rawAnswer,
          });
          
          assumptionImprovements.set(assumptionIndex, true);
        }
      }
    }
    
    for (const riskId of answer.mappedRiskIds) {
      const currentCount = riskImprovements.get(riskId) || 0;
      if (quality.isSubstantive) {
        riskImprovements.set(riskId, currentCount + 1);
      }
    }
  }
  
  for (let i = 0; i < analysis.risks.length; i++) {
    const risk = analysis.risks[i];
    const riskId = `risk_${risk.category}_${i}`;
    const previousSeverity = risk.severity as RiskSeverity;
    
    let relatedImprovements = riskImprovements.get(riskId) || 0;
    
    if (relatedImprovements === 0) {
      if (risk.category === "market") {
        relatedImprovements = assumptionImprovements.size;
      } else if (risk.category === "financial") {
        const constraintAnswers = answers.filter(a => a.sectionType === "constraints_resources");
        if (constraintAnswers.some(a => assessAnswerQuality(a.value).isSubstantive)) {
          relatedImprovements = 1;
        }
      } else if (risk.category === "technical") {
        const scopeAnswers = answers.filter(a => a.sectionType === "scope_boundaries");
        if (scopeAnswers.some(a => assessAnswerQuality(a.value).hasEvidence)) {
          relatedImprovements = 1;
        }
      }
    }
    
    const newSeverity = adjustRiskSeverity(previousSeverity, relatedImprovements);
    
    if (newSeverity !== previousSeverity) {
      riskResolutions.push({
        riskId,
        riskDescription: risk.description,
        previousSeverity,
        newSeverity,
        adjustmentReason: `${relatedImprovements} related improvement(s) from workshop`,
      });
    }
  }
  
  for (const driver of analysis.primaryRiskDrivers) {
    const riskId = `risk_driver_${driver.rank}`;
    const directImprovements = riskImprovements.get(riskId) || 0;
    
    let previousSeverity: RiskSeverity = driver.isControllable ? "medium" : "high";
    let relatedImprovements = directImprovements > 0 ? directImprovements : (assumptionImprovements.size > 0 ? 1 : 0);
    
    const newSeverity = adjustRiskSeverity(previousSeverity, relatedImprovements);
    
    if (newSeverity !== previousSeverity) {
      riskResolutions.push({
        riskId,
        riskDescription: driver.title,
        previousSeverity,
        newSeverity,
        adjustmentReason: `Workshop provided context for "${driver.title}"`,
      });
    }
  }
  
  const assumptionsValidated = assumptionResolutions.filter(a => a.newStatus === "validated").length;
  const assumptionsPartiallyValidated = assumptionResolutions.filter(a => a.newStatus === "partially_validated").length;
  const risksReduced = riskResolutions.length;
  
  const overallImprovementScore = 
    (assumptionsValidated * 15) + 
    (assumptionsPartiallyValidated * 8) + 
    (risksReduced * 5);
  
  return {
    assumptions: assumptionResolutions,
    risks: riskResolutions,
    summary: {
      assumptionsValidated,
      assumptionsPartiallyValidated,
      risksReduced,
      overallImprovementScore,
    },
  };
}

export function buildWorkshopFindings(
  analysis: IdeaAnalysis,
  resolutionResult: WorkshopResolutionResult,
  answers: WorkshopAnswer[]
): string {
  const parts: string[] = [];
  
  parts.push("=== WORKSHOP FINDINGS (NEW EVIDENCE) ===");
  parts.push("");
  parts.push("The user has completed a Guided Refinement Workshop providing additional context.");
  parts.push("The following uncertainties have been reduced based on user input.");
  parts.push("You MUST incorporate these findings into your re-analysis.");
  parts.push("Do NOT ignore this section. Do NOT re-assess as if no refinement occurred.");
  parts.push("");
  
  if (resolutionResult.assumptions.length > 0) {
    parts.push("--- ASSUMPTION STATUS CHANGES ---");
    for (const assumption of resolutionResult.assumptions) {
      parts.push(`[${assumption.previousStatus.toUpperCase()} → ${assumption.newStatus.toUpperCase()}] "${assumption.assumptionText}"`);
      parts.push(`   Evidence: ${assumption.evidenceProvided.substring(0, 200)}${assumption.evidenceProvided.length > 200 ? "..." : ""}`);
    }
    parts.push("");
  }
  
  if (resolutionResult.risks.length > 0) {
    parts.push("--- RISK SEVERITY ADJUSTMENTS ---");
    for (const risk of resolutionResult.risks) {
      parts.push(`[${risk.previousSeverity.toUpperCase()} → ${risk.newSeverity.toUpperCase()}] "${risk.riskDescription}"`);
      parts.push(`   Reason: ${risk.adjustmentReason}`);
    }
    parts.push("");
  }
  
  parts.push("--- USER-PROVIDED CONTEXT ---");
  
  const targetMarketAnswers = answers.filter(a => a.sectionType === "target_market_clarity");
  if (targetMarketAnswers.length > 0) {
    parts.push("Target Market Clarity:");
    for (const answer of targetMarketAnswers) {
      parts.push(`  - ${answer.rawAnswer}`);
    }
  }
  
  const painAnswers = answers.filter(a => a.sectionType === "pain_urgency_validation");
  if (painAnswers.length > 0) {
    parts.push("Pain & Urgency Validation:");
    for (const answer of painAnswers) {
      parts.push(`  - ${answer.rawAnswer}`);
    }
  }
  
  const scopeAnswers = answers.filter(a => a.sectionType === "scope_boundaries");
  if (scopeAnswers.length > 0) {
    parts.push("Scope Boundaries:");
    for (const answer of scopeAnswers) {
      parts.push(`  - ${answer.rawAnswer}`);
    }
  }
  
  const constraintAnswers = answers.filter(a => a.sectionType === "constraints_resources");
  if (constraintAnswers.length > 0) {
    parts.push("Constraints & Resources:");
    for (const answer of constraintAnswers) {
      parts.push(`  - ${answer.rawAnswer}`);
    }
  }
  
  parts.push("");
  parts.push("--- SCORING ADJUSTMENT INSTRUCTIONS ---");
  parts.push(`Based on workshop findings, the analysis should reflect:`);
  parts.push(`- ${resolutionResult.summary.assumptionsValidated} assumption(s) moved to VALIDATED status`);
  parts.push(`- ${resolutionResult.summary.assumptionsPartiallyValidated} assumption(s) moved to PARTIALLY_VALIDATED status`);
  parts.push(`- ${resolutionResult.summary.risksReduced} risk(s) reduced in severity`);
  parts.push(`- Suggested score improvement: +${resolutionResult.summary.overallImprovementScore} points`);
  parts.push("");
  parts.push("=== END WORKSHOP FINDINGS ===");
  
  return parts.join("\n");
}
