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

function findQuestionPrompt(sections: WorkshopSection[], questionId: string): string | null {
  for (const section of sections) {
    for (const q of section.questions) {
      if (q.id === questionId) {
        return q.prompt;
      }
    }
  }
  return null;
}

const SECTION_LABELS: Record<string, string> = {
  target_market_clarity: "Target Audience & Market Clarity",
  pain_urgency_validation: "Problem Validation & Urgency",
  scope_boundaries: "Scope & Boundaries",
  constraints_resources: "Constraints & Resources",
};

export function buildWorkshopFindings(
  analysis: IdeaAnalysis,
  resolutionResult: WorkshopResolutionResult,
  answers: WorkshopAnswer[],
  sections?: WorkshopSection[]
): string {
  const parts: string[] = [];

  parts.push("=== WORKSHOP FINDINGS (NEW EVIDENCE FROM THE BUILDER) ===");
  parts.push("");
  parts.push("The builder completed a Guided Refinement Workshop. Below is the full Q&A exchange and its impact on the initial analysis.");
  parts.push("You MUST incorporate these findings into your re-analysis. Treat each answer as new evidence that may validate or invalidate assumptions from the initial analysis.");
  parts.push("Do NOT re-derive information the builder already provided. Do NOT ignore this section.");
  parts.push("");

  if (resolutionResult.assumptions.length > 0) {
    parts.push("--- ASSUMPTION STATUS CHANGES ---");
    for (const assumption of resolutionResult.assumptions) {
      parts.push(`[${assumption.previousStatus.toUpperCase()} -> ${assumption.newStatus.toUpperCase()}] "${assumption.assumptionText}"`);
      parts.push(`   Evidence provided: ${assumption.evidenceProvided.substring(0, 300)}${assumption.evidenceProvided.length > 300 ? "..." : ""}`);
    }
    parts.push("");
  }

  if (resolutionResult.risks.length > 0) {
    parts.push("--- RISK SEVERITY ADJUSTMENTS ---");
    for (const risk of resolutionResult.risks) {
      parts.push(`[${risk.previousSeverity.toUpperCase()} -> ${risk.newSeverity.toUpperCase()}] "${risk.riskDescription}"`);
      parts.push(`   Reason: ${risk.adjustmentReason}`);
    }
    parts.push("");
  }

  parts.push("--- FULL WORKSHOP Q&A TRANSCRIPT ---");
  parts.push("");

  const sectionTypes = ["target_market_clarity", "pain_urgency_validation", "scope_boundaries", "constraints_resources"];

  for (const sectionType of sectionTypes) {
    const sectionAnswers = answers.filter(a => a.sectionType === sectionType);
    if (sectionAnswers.length === 0) continue;

    parts.push(`## ${SECTION_LABELS[sectionType] || sectionType}`);
    parts.push("");

    for (const answer of sectionAnswers) {
      const questionPrompt = sections
        ? findQuestionPrompt(sections, answer.questionId)
        : null;

      if (questionPrompt) {
        parts.push(`Q: ${questionPrompt}`);
      }
      parts.push(`A: ${answer.rawAnswer}`);
      parts.push("");
    }
  }

  parts.push("--- ANALYSIS ADJUSTMENT GUIDANCE ---");
  parts.push(`Based on the workshop evidence:`);
  parts.push(`- ${resolutionResult.summary.assumptionsValidated} assumption(s) now have supporting evidence (VALIDATED)`);
  parts.push(`- ${resolutionResult.summary.assumptionsPartiallyValidated} assumption(s) have partial evidence (PARTIALLY_VALIDATED)`);
  parts.push(`- ${resolutionResult.summary.risksReduced} risk(s) should be reduced in severity`);
  parts.push(`- Use the builder's specific answers to ground your updated analysis in their actual situation`);
  parts.push(`- If the builder provided domain-specific details (e.g., target aircraft types, regulatory requirements, specific workflows), reference those details in your analysis`);
  parts.push("");
  parts.push("=== END WORKSHOP FINDINGS ===");

  return parts.join("\n");
}
