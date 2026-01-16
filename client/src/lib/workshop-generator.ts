/**
 * Workshop Question Generator
 * 
 * Generates structured workshop questions based on analysis output.
 * Questions are deterministic and mapped to specific risks/assumptions.
 */

import type { IdeaAnalysis, RiskDriver, AssumptionDependency, ScopeWarning } from "@shared/types/ideas";
import type { WorkshopSection, WorkshopQuestion, WorkshopSectionType, RiskMapping } from "@shared/types/workshop";

const MAX_QUESTIONS_PER_SECTION = 3;
const MAX_TOTAL_QUESTIONS = 12;

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function generateDeterministicQuestionId(
  analysisId: string, 
  sectionType: string, 
  questionIndex: number
): string {
  const seed = `${analysisId}_${sectionType}_${questionIndex}`;
  return `wq_${simpleHash(seed)}`;
}

let currentAnalysisId: string = "";
let questionCounters: Map<string, number> = new Map();

function resetQuestionCounters(analysisId: string): void {
  currentAnalysisId = analysisId;
  questionCounters.clear();
}

function getNextQuestionId(sectionType: string): string {
  const count = questionCounters.get(sectionType) || 0;
  questionCounters.set(sectionType, count + 1);
  return generateDeterministicQuestionId(currentAnalysisId, sectionType, count);
}

function getTriggerReason(analysis: IdeaAnalysis, sectionType: WorkshopSectionType): string {
  switch (sectionType) {
    case "target_market_clarity": {
      const hasMarketRisk = analysis.risks.some(r => r.category === "market");
      const hasUnvalidatedAssumption = analysis.assumptionDependencies.some(a => a.status === "unvalidated");
      if (hasMarketRisk) return "Market risk identified";
      if (hasUnvalidatedAssumption) return "Unvalidated assumptions need clarification";
      return "Market clarity required for revise/stop recommendation";
    }
    case "pain_urgency_validation": {
      const demandRisk = analysis.primaryRiskDrivers.some(
        rd => rd.title.toLowerCase().includes("demand") || 
             rd.title.toLowerCase().includes("pain") ||
             rd.title.toLowerCase().includes("problem not painful")
      );
      if (demandRisk) return "Unvalidated market demand or pain point";
      return "Pain/urgency validation required for revise/stop recommendation";
    }
    case "scope_boundaries": {
      if (analysis.scopeWarnings.length > 0) {
        return `${analysis.scopeWarnings.length} scope warning(s) identified`;
      }
      return "Scope boundaries required for revise/stop recommendation";
    }
    case "constraints_resources": {
      const hasFinancialRisk = analysis.risks.some(r => r.category === "financial");
      if (hasFinancialRisk) return "Financial risk requires constraint clarification";
      return "Resource constraints required for revise/stop recommendation";
    }
  }
}

function generateTargetMarketQuestions(analysis: IdeaAnalysis): WorkshopQuestion[] {
  const questions: WorkshopQuestion[] = [];
  
  const marketRisk = analysis.risks.find(r => r.category === "market");
  const marketRiskIndex = marketRisk ? analysis.risks.indexOf(marketRisk) : undefined;
  
  const marketMapping: RiskMapping | undefined = marketRisk ? {
    type: "risk",
    riskCategory: "market",
    riskIndex: marketRiskIndex,
    sourceText: marketRisk.description,
  } : undefined;

  questions.push({
    id: getNextQuestionId("target_market_clarity"),
    sectionType: "target_market_clarity",
    questionType: "single_select",
    prompt: "Who is the primary user for this product?",
    options: [
      { value: "individual_consumers", label: "Individual consumers (B2C)" },
      { value: "small_business", label: "Small business owners" },
      { value: "enterprise", label: "Enterprise/corporate teams" },
      { value: "developers", label: "Developers/technical users" },
      { value: "other", label: "Other specific group" },
    ],
    mapping: marketMapping,
    required: true,
  });

  const unvalidatedAssumptions = analysis.assumptionDependencies.filter(
    a => a.status === "unvalidated"
  );
  
  if (unvalidatedAssumptions.length > 0) {
    const firstUnvalidated = unvalidatedAssumptions[0];
    const assumptionIndex = analysis.assumptionDependencies.indexOf(firstUnvalidated);
    
    const assumptionMapping: RiskMapping = {
      type: "assumption",
      assumptionIndex: assumptionIndex,
      sourceText: firstUnvalidated.assumption,
    };

    questions.push({
      id: getNextQuestionId("target_market_clarity"),
      sectionType: "target_market_clarity",
      questionType: "short_text",
      prompt: `What evidence do you have for: "${firstUnvalidated.assumption}"?`,
      mapping: assumptionMapping,
      mappedAssumptionIndex: assumptionIndex,
      required: true,
    });
  } else {
    questions.push({
      id: getNextQuestionId("target_market_clarity"),
      sectionType: "target_market_clarity",
      questionType: "short_text",
      prompt: "What evidence do you have that your target users actually need this solution?",
      required: true,
    });
  }

  const marketRiskDriver = analysis.primaryRiskDrivers.find(
    rd => rd.title.toLowerCase().includes("market")
  );
  
  const riskDriverMapping: RiskMapping | undefined = marketRiskDriver ? {
    type: "risk_driver",
    riskDriverRank: marketRiskDriver.rank,
    sourceText: marketRiskDriver.title,
  } : undefined;

  questions.push({
    id: getNextQuestionId("target_market_clarity"),
    sectionType: "target_market_clarity",
    questionType: "multi_select",
    prompt: "How have you validated market interest?",
    options: [
      { value: "customer_interviews", label: "Conducted customer interviews" },
      { value: "surveys", label: "Ran surveys or polls" },
      { value: "waitlist", label: "Built a waitlist with signups" },
      { value: "competitor_analysis", label: "Analyzed competitor success" },
      { value: "none", label: "Not yet validated" },
    ],
    mapping: riskDriverMapping,
    required: true,
  });

  return questions.slice(0, MAX_QUESTIONS_PER_SECTION);
}

function generatePainUrgencyQuestions(analysis: IdeaAnalysis): WorkshopQuestion[] {
  const questions: WorkshopQuestion[] = [];

  const demandRiskDriver = analysis.primaryRiskDrivers.find(
    rd => rd.title.toLowerCase().includes("demand") || 
         rd.title.toLowerCase().includes("pain") ||
         rd.title.toLowerCase().includes("problem not painful")
  );
  
  const demandMapping: RiskMapping | undefined = demandRiskDriver ? {
    type: "risk_driver",
    riskDriverRank: demandRiskDriver.rank,
    sourceText: demandRiskDriver.title,
  } : undefined;
  
  const painAssumption = analysis.assumptionDependencies.find(
    a => a.assumption.toLowerCase().includes("pain") || 
         a.assumption.toLowerCase().includes("problem") ||
         a.assumption.toLowerCase().includes("need")
  );
  const painAssumptionIndex = painAssumption 
    ? analysis.assumptionDependencies.indexOf(painAssumption) 
    : undefined;

  const painMapping: RiskMapping | undefined = painAssumption && painAssumptionIndex !== undefined ? {
    type: "assumption",
    assumptionIndex: painAssumptionIndex,
    sourceText: painAssumption.assumption,
  } : undefined;

  questions.push({
    id: getNextQuestionId("pain_urgency_validation"),
    sectionType: "pain_urgency_validation",
    questionType: "short_text",
    prompt: "What do users currently do to solve this problem without your solution?",
    mapping: demandMapping,
    required: true,
  });

  questions.push({
    id: getNextQuestionId("pain_urgency_validation"),
    sectionType: "pain_urgency_validation",
    questionType: "single_select",
    prompt: "How often do users experience this problem?",
    options: [
      { value: "daily", label: "Daily or multiple times per day" },
      { value: "weekly", label: "Weekly" },
      { value: "monthly", label: "Monthly" },
      { value: "rarely", label: "Occasionally/rarely" },
    ],
    mapping: painMapping,
    mappedAssumptionIndex: painAssumptionIndex,
    required: true,
  });

  questions.push({
    id: getNextQuestionId("pain_urgency_validation"),
    sectionType: "pain_urgency_validation",
    questionType: "short_text",
    prompt: "What happens if users don't solve this problem? What are the consequences?",
    mapping: demandMapping,
    required: true,
  });

  return questions.slice(0, MAX_QUESTIONS_PER_SECTION);
}

function generateScopeBoundariesQuestions(analysis: IdeaAnalysis): WorkshopQuestion[] {
  const questions: WorkshopQuestion[] = [];

  const scopeWarning = analysis.scopeWarnings.length > 0 ? analysis.scopeWarnings[0] : null;
  const scopeWarningIndex = scopeWarning ? analysis.scopeWarnings.indexOf(scopeWarning) : undefined;
  const highComplexityWarning = analysis.scopeWarnings.find(sw => sw.underestimationRisk === "high");
  const highComplexityIndex = highComplexityWarning ? analysis.scopeWarnings.indexOf(highComplexityWarning) : undefined;

  const scopeMapping: RiskMapping | undefined = scopeWarning && scopeWarningIndex !== undefined ? {
    type: "scope_warning",
    scopeArea: scopeWarning.area,
    scopeIndex: scopeWarningIndex,
    sourceText: scopeWarning.warning,
  } : undefined;

  questions.push({
    id: getNextQuestionId("scope_boundaries"),
    sectionType: "scope_boundaries",
    questionType: "short_text",
    prompt: "What features or capabilities are explicitly NOT included in version 1?",
    mapping: scopeMapping,
    required: true,
  });

  questions.push({
    id: getNextQuestionId("scope_boundaries"),
    sectionType: "scope_boundaries",
    questionType: "short_text",
    prompt: "What is the single most important thing this product must do well in version 1?",
    mapping: scopeMapping,
    required: true,
  });

  if (highComplexityWarning && highComplexityIndex !== undefined) {
    const highComplexityMapping: RiskMapping = {
      type: "scope_warning",
      scopeArea: highComplexityWarning.area,
      scopeIndex: highComplexityIndex,
      sourceText: highComplexityWarning.hiddenComplexity,
    };

    questions.push({
      id: getNextQuestionId("scope_boundaries"),
      sectionType: "scope_boundaries",
      questionType: "single_select",
      prompt: `The analysis identified hidden complexity in "${highComplexityWarning.area}": ${highComplexityWarning.hiddenComplexity}. How will you address this?`,
      options: [
        { value: "defer", label: "Defer to a later version" },
        { value: "simplify", label: "Simplify the approach significantly" },
        { value: "outsource", label: "Use an existing solution/service" },
        { value: "accept", label: "Accept the complexity as necessary" },
      ],
      mapping: highComplexityMapping,
      required: true,
    });
  } else {
    questions.push({
      id: getNextQuestionId("scope_boundaries"),
      sectionType: "scope_boundaries",
      questionType: "short_text",
      prompt: "What complexity or technical challenges do you anticipate in building this?",
      required: true,
    });
  }

  return questions.slice(0, MAX_QUESTIONS_PER_SECTION);
}

function generateConstraintsQuestions(analysis: IdeaAnalysis): WorkshopQuestion[] {
  const questions: WorkshopQuestion[] = [];

  const financialRisk = analysis.risks.find(r => r.category === "financial");
  const financialRiskIndex = financialRisk ? analysis.risks.indexOf(financialRisk) : undefined;
  const executionRisk = analysis.risks.find(r => r.category === "execution");
  const executionRiskIndex = executionRisk ? analysis.risks.indexOf(executionRisk) : undefined;
  
  const budgetAssumption = analysis.assumptionDependencies.find(
    a => a.assumption.toLowerCase().includes("budget") || a.assumption.toLowerCase().includes("cost")
  );
  const budgetAssumptionIndex = budgetAssumption 
    ? analysis.assumptionDependencies.indexOf(budgetAssumption) 
    : undefined;

  const timelineAssumption = analysis.assumptionDependencies.find(
    a => a.assumption.toLowerCase().includes("timeline") || 
         a.assumption.toLowerCase().includes("time") ||
         a.assumption.toLowerCase().includes("deadline")
  );
  const timelineAssumptionIndex = timelineAssumption 
    ? analysis.assumptionDependencies.indexOf(timelineAssumption) 
    : undefined;

  const teamAssumption = analysis.assumptionDependencies.find(
    a => a.assumption.toLowerCase().includes("team") || 
         a.assumption.toLowerCase().includes("capacity") ||
         a.assumption.toLowerCase().includes("resource")
  );
  const teamAssumptionIndex = teamAssumption 
    ? analysis.assumptionDependencies.indexOf(teamAssumption) 
    : undefined;

  const budgetMapping: RiskMapping = {
    type: financialRisk ? "risk" : budgetAssumption ? "assumption" : "risk",
    riskCategory: financialRisk ? "financial" : undefined,
    riskIndex: financialRiskIndex,
    assumptionIndex: budgetAssumptionIndex,
    sourceText: financialRisk?.description || budgetAssumption?.assumption,
  };

  const timelineMapping: RiskMapping = {
    type: executionRisk ? "risk" : timelineAssumption ? "assumption" : "risk",
    riskCategory: executionRisk ? "execution" : undefined,
    riskIndex: executionRiskIndex,
    assumptionIndex: timelineAssumptionIndex,
    sourceText: executionRisk?.description || timelineAssumption?.assumption,
  };

  const teamMapping: RiskMapping = {
    type: executionRisk ? "risk" : teamAssumption ? "assumption" : "risk",
    riskCategory: executionRisk ? "execution" : undefined,
    riskIndex: executionRiskIndex,
    assumptionIndex: teamAssumptionIndex,
    sourceText: executionRisk?.description || teamAssumption?.assumption,
  };

  questions.push({
    id: getNextQuestionId("constraints_resources"),
    sectionType: "constraints_resources",
    questionType: "banded_range",
    prompt: "What is your budget range for building version 1?",
    options: [
      { value: "bootstrap", label: "Bootstrap ($0 - $1,000)" },
      { value: "small", label: "Small ($1,000 - $10,000)" },
      { value: "medium", label: "Medium ($10,000 - $50,000)" },
      { value: "large", label: "Large ($50,000 - $200,000)" },
      { value: "enterprise", label: "Enterprise ($200,000+)" },
    ],
    mapping: budgetMapping,
    mappedAssumptionIndex: budgetAssumptionIndex,
    required: true,
  });

  questions.push({
    id: getNextQuestionId("constraints_resources"),
    sectionType: "constraints_resources",
    questionType: "banded_range",
    prompt: "What is your target timeline to launch version 1?",
    options: [
      { value: "1_month", label: "1 month or less" },
      { value: "3_months", label: "1-3 months" },
      { value: "6_months", label: "3-6 months" },
      { value: "12_months", label: "6-12 months" },
      { value: "longer", label: "More than 12 months" },
    ],
    mapping: timelineMapping,
    mappedAssumptionIndex: timelineAssumptionIndex,
    required: true,
  });

  questions.push({
    id: getNextQuestionId("constraints_resources"),
    sectionType: "constraints_resources",
    questionType: "single_select",
    prompt: "What is your team composition for this project?",
    options: [
      { value: "solo", label: "Solo founder/developer" },
      { value: "small_team", label: "Small team (2-5 people)" },
      { value: "medium_team", label: "Medium team (6-15 people)" },
      { value: "large_team", label: "Large team (15+ people)" },
      { value: "outsourced", label: "Primarily outsourced/contracted" },
    ],
    mapping: teamMapping,
    mappedAssumptionIndex: teamAssumptionIndex,
    required: true,
  });

  return questions.slice(0, MAX_QUESTIONS_PER_SECTION);
}

export function generateWorkshopSections(analysis: IdeaAnalysis): WorkshopSection[] {
  resetQuestionCounters(analysis.id);
  
  const sections: WorkshopSection[] = [];
  let totalQuestions = 0;

  if (totalQuestions < MAX_TOTAL_QUESTIONS) {
    const questions = generateTargetMarketQuestions(analysis);
    const remainingSlots = Math.min(MAX_QUESTIONS_PER_SECTION, MAX_TOTAL_QUESTIONS - totalQuestions);
    const limitedQuestions = questions.slice(0, remainingSlots);
    
    if (limitedQuestions.length > 0) {
      sections.push({
        type: "target_market_clarity",
        title: "Target Market Clarity",
        description: "Help us understand who this product is for and how you've validated the market.",
        questions: limitedQuestions,
        triggered: true,
        triggerReason: getTriggerReason(analysis, "target_market_clarity"),
      });
      totalQuestions += limitedQuestions.length;
    }
  }

  if (totalQuestions < MAX_TOTAL_QUESTIONS) {
    const questions = generatePainUrgencyQuestions(analysis);
    const remainingSlots = Math.min(MAX_QUESTIONS_PER_SECTION, MAX_TOTAL_QUESTIONS - totalQuestions);
    const limitedQuestions = questions.slice(0, remainingSlots);
    
    if (limitedQuestions.length > 0) {
      sections.push({
        type: "pain_urgency_validation",
        title: "Pain & Urgency Validation",
        description: "Clarify the problem severity and how users currently cope without your solution.",
        questions: limitedQuestions,
        triggered: true,
        triggerReason: getTriggerReason(analysis, "pain_urgency_validation"),
      });
      totalQuestions += limitedQuestions.length;
    }
  }

  if (totalQuestions < MAX_TOTAL_QUESTIONS) {
    const questions = generateScopeBoundariesQuestions(analysis);
    const remainingSlots = Math.min(MAX_QUESTIONS_PER_SECTION, MAX_TOTAL_QUESTIONS - totalQuestions);
    const limitedQuestions = questions.slice(0, remainingSlots);
    
    if (limitedQuestions.length > 0) {
      sections.push({
        type: "scope_boundaries",
        title: "Scope & Boundaries",
        description: "Define what's in and out of scope for version 1 to manage complexity.",
        questions: limitedQuestions,
        triggered: true,
        triggerReason: getTriggerReason(analysis, "scope_boundaries"),
      });
      totalQuestions += limitedQuestions.length;
    }
  }

  if (totalQuestions < MAX_TOTAL_QUESTIONS) {
    const questions = generateConstraintsQuestions(analysis);
    const remainingSlots = Math.min(MAX_QUESTIONS_PER_SECTION, MAX_TOTAL_QUESTIONS - totalQuestions);
    const limitedQuestions = questions.slice(0, remainingSlots);
    
    if (limitedQuestions.length > 0) {
      sections.push({
        type: "constraints_resources",
        title: "Constraints & Resources",
        description: "Clarify your resource constraints so the analysis can account for them.",
        questions: limitedQuestions,
        triggered: true,
        triggerReason: getTriggerReason(analysis, "constraints_resources"),
      });
      totalQuestions += limitedQuestions.length;
    }
  }

  return sections;
}

function generateDeterministicSessionId(analysisId: string): string {
  return `ws_${simpleHash(analysisId)}`;
}

export function createWorkshopSession(analysis: IdeaAnalysis): {
  id: string;
  originalAnalysisId: string;
  originalIdeaInput: { title: string; description: string };
  sections: WorkshopSection[];
  answers: [];
  resolvedRiskIds: [];
  status: "in_progress";
  createdAt: string;
} {
  return {
    id: generateDeterministicSessionId(analysis.id),
    originalAnalysisId: analysis.id,
    originalIdeaInput: {
      title: analysis.input.title,
      description: analysis.input.description,
    },
    sections: generateWorkshopSections(analysis),
    answers: [],
    resolvedRiskIds: [],
    status: "in_progress",
    createdAt: new Date().toISOString(),
  };
}
