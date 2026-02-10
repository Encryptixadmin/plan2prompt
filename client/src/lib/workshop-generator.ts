import type { IdeaAnalysis, RiskDriver, AssumptionDependency, ScopeWarning, IdeaPurpose } from "@shared/types/ideas";
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

function getPurpose(analysis: IdeaAnalysis): IdeaPurpose {
  return analysis.input.purpose || "commercial";
}

function hasContext(analysis: IdeaAnalysis, field: string): boolean {
  const ctx = analysis.input.context;
  if (!ctx) return false;
  switch (field) {
    case "targetMarket": return !!(ctx.targetMarket && ctx.targetMarket.trim().length > 0);
    case "skills": return !!(ctx.skills && ctx.skills.length > 0);
    case "budget": return !!(ctx.budget);
    case "timeline": return !!(ctx.timeline && ctx.timeline.trim().length > 0);
    case "competitors": return !!(ctx.competitors && ctx.competitors.trim().length > 0);
    default: return false;
  }
}

function getTriggerReason(analysis: IdeaAnalysis, sectionType: WorkshopSectionType): string {
  switch (sectionType) {
    case "target_market_clarity": {
      const hasMarketRisk = analysis.risks.some(r => r.category === "market");
      const hasUnvalidatedAssumption = analysis.assumptionDependencies.some(a => a.status === "unvalidated");
      if (hasMarketRisk) return "Market risk identified in analysis";
      if (hasUnvalidatedAssumption) return "Unvalidated assumptions need clarification";
      return "Additional audience clarity would improve analysis";
    }
    case "pain_urgency_validation": {
      const demandRisk = analysis.primaryRiskDrivers.some(
        rd => rd.title.toLowerCase().includes("demand") || 
             rd.title.toLowerCase().includes("pain") ||
             rd.title.toLowerCase().includes("problem")
      );
      if (demandRisk) return "Unvalidated market demand or pain point";
      return "Problem validation would strengthen the analysis";
    }
    case "scope_boundaries": {
      if (analysis.scopeWarnings.length > 0) {
        return `${analysis.scopeWarnings.length} scope warning(s) identified`;
      }
      return "Scope definition would reduce implementation risk";
    }
    case "constraints_resources": {
      const hasFinancialRisk = analysis.risks.some(r => r.category === "financial");
      if (hasFinancialRisk) return "Financial risk requires constraint clarification";
      return "Resource constraints affect feasibility assessment";
    }
  }
}

function generateTargetMarketQuestions(analysis: IdeaAnalysis): WorkshopQuestion[] {
  const purpose = getPurpose(analysis);
  const questions: WorkshopQuestion[] = [];
  
  const marketRisk = analysis.risks.find(r => r.category === "market");
  const marketRiskIndex = marketRisk ? analysis.risks.indexOf(marketRisk) : undefined;
  
  const marketMapping: RiskMapping | undefined = marketRisk ? {
    type: "risk",
    riskCategory: "market",
    riskIndex: marketRiskIndex,
    sourceText: marketRisk.description,
  } : undefined;

  if (!hasContext(analysis, "targetMarket")) {
    if (purpose === "developer_tool") {
      questions.push({
        id: getNextQuestionId("target_market_clarity"),
        sectionType: "target_market_clarity",
        questionType: "single_select",
        prompt: "What type of developer is this tool primarily for?",
        options: [
          { value: "frontend", label: "Frontend developers" },
          { value: "backend", label: "Backend/infrastructure developers" },
          { value: "fullstack", label: "Full-stack developers" },
          { value: "devops", label: "DevOps/platform engineers" },
          { value: "data", label: "Data engineers/scientists" },
          { value: "other", label: "Other technical role" },
        ],
        mapping: marketMapping,
        required: true,
      });
    } else if (purpose === "internal") {
      questions.push({
        id: getNextQuestionId("target_market_clarity"),
        sectionType: "target_market_clarity",
        questionType: "single_select",
        prompt: "Who will use this tool?",
        options: [
          { value: "just_me", label: "Just me (personal tool)" },
          { value: "small_team", label: "My immediate team (2-10 people)" },
          { value: "department", label: "Our department/org" },
          { value: "company", label: "Company-wide" },
        ],
        mapping: marketMapping,
        required: true,
      });
    } else if (purpose !== "learning") {
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
    }
  }

  const unvalidatedAssumptions = analysis.assumptionDependencies.filter(
    a => a.status === "unvalidated" || a.status === "risky"
  );
  
  if (unvalidatedAssumptions.length > 0) {
    const relevantAssumption = unvalidatedAssumptions.find(a => {
      const lower = a.assumption.toLowerCase();
      if (purpose === "developer_tool") return lower.includes("adopt") || lower.includes("developer") || lower.includes("user");
      if (purpose === "internal") return lower.includes("solve") || lower.includes("need") || lower.includes("problem");
      return lower.includes("market") || lower.includes("user") || lower.includes("need");
    }) || unvalidatedAssumptions[0];
    
    const assumptionIndex = analysis.assumptionDependencies.indexOf(relevantAssumption);
    
    const assumptionMapping: RiskMapping = {
      type: "assumption",
      assumptionIndex: assumptionIndex,
      sourceText: relevantAssumption.assumption,
    };

    const promptText = purpose === "developer_tool"
      ? `What evidence do you have that developers would adopt this? (Re: "${relevantAssumption.assumption}")`
      : purpose === "internal"
        ? `What evidence do you have this would save time/effort? (Re: "${relevantAssumption.assumption}")`
        : `What evidence do you have for: "${relevantAssumption.assumption}"?`;

    questions.push({
      id: getNextQuestionId("target_market_clarity"),
      sectionType: "target_market_clarity",
      questionType: "short_text",
      prompt: promptText,
      mapping: assumptionMapping,
      mappedAssumptionIndex: assumptionIndex,
      required: true,
    });
  }

  if (purpose === "commercial" || purpose === "open_source") {
    const marketRiskDriver = analysis.primaryRiskDrivers.find(
      rd => rd.title.toLowerCase().includes("market") || rd.title.toLowerCase().includes("demand")
    );
    
    const riskDriverMapping: RiskMapping | undefined = marketRiskDriver ? {
      type: "risk_driver",
      riskDriverRank: marketRiskDriver.rank,
      sourceText: marketRiskDriver.title,
    } : undefined;

    const validationPrompt = purpose === "open_source"
      ? "How have you validated community interest?"
      : "How have you validated market interest?";

    const validationOptions = purpose === "open_source"
      ? [
          { value: "github_issues", label: "Existing GitHub issues/requests for this" },
          { value: "forum_discussions", label: "Forum/community discussions about this gap" },
          { value: "competitor_stars", label: "Similar projects have significant adoption" },
          { value: "personal_need", label: "I need this myself and others likely do too" },
          { value: "none", label: "Not yet validated" },
        ]
      : [
          { value: "customer_interviews", label: "Conducted customer interviews" },
          { value: "surveys", label: "Ran surveys or polls" },
          { value: "waitlist", label: "Built a waitlist with signups" },
          { value: "competitor_analysis", label: "Analyzed competitor success" },
          { value: "none", label: "Not yet validated" },
        ];

    questions.push({
      id: getNextQuestionId("target_market_clarity"),
      sectionType: "target_market_clarity",
      questionType: "multi_select",
      prompt: validationPrompt,
      options: validationOptions,
      mapping: riskDriverMapping,
      required: true,
    });
  }

  if (purpose === "developer_tool" && !hasContext(analysis, "competitors")) {
    questions.push({
      id: getNextQuestionId("target_market_clarity"),
      sectionType: "target_market_clarity",
      questionType: "short_text",
      prompt: "What do developers currently use to solve this problem? How would your tool improve on that workflow?",
      required: true,
    });
  }

  return questions.slice(0, MAX_QUESTIONS_PER_SECTION);
}

function generatePainUrgencyQuestions(analysis: IdeaAnalysis): WorkshopQuestion[] {
  const purpose = getPurpose(analysis);
  const questions: WorkshopQuestion[] = [];

  if (purpose === "learning") {
    questions.push({
      id: getNextQuestionId("pain_urgency_validation"),
      sectionType: "pain_urgency_validation",
      questionType: "short_text",
      prompt: "What specific skills or concepts are you trying to learn by building this?",
      required: true,
    });

    questions.push({
      id: getNextQuestionId("pain_urgency_validation"),
      sectionType: "pain_urgency_validation",
      questionType: "single_select",
      prompt: "How complex should this project be for your learning goals?",
      options: [
        { value: "weekend", label: "Weekend project (1-2 days)" },
        { value: "week", label: "Week-long deep dive" },
        { value: "month", label: "Multi-week exploration" },
        { value: "ongoing", label: "Ongoing learning vehicle" },
      ],
      required: true,
    });

    return questions.slice(0, MAX_QUESTIONS_PER_SECTION);
  }

  const demandRiskDriver = analysis.primaryRiskDrivers.find(
    rd => rd.title.toLowerCase().includes("demand") || 
         rd.title.toLowerCase().includes("pain") ||
         rd.title.toLowerCase().includes("problem")
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

  if (purpose === "developer_tool") {
    questions.push({
      id: getNextQuestionId("pain_urgency_validation"),
      sectionType: "pain_urgency_validation",
      questionType: "short_text",
      prompt: "What's the current developer workflow this tool would replace or improve? What's frustrating about it?",
      mapping: demandMapping,
      required: true,
    });

    questions.push({
      id: getNextQuestionId("pain_urgency_validation"),
      sectionType: "pain_urgency_validation",
      questionType: "single_select",
      prompt: "How often would a developer hit this pain point?",
      options: [
        { value: "every_commit", label: "Every commit/deployment" },
        { value: "daily", label: "Daily during development" },
        { value: "weekly", label: "Weekly (recurring task)" },
        { value: "occasionally", label: "Occasionally (specific situations)" },
      ],
      mapping: painMapping,
      mappedAssumptionIndex: painAssumptionIndex,
      required: true,
    });
  } else if (purpose === "internal") {
    questions.push({
      id: getNextQuestionId("pain_urgency_validation"),
      sectionType: "pain_urgency_validation",
      questionType: "short_text",
      prompt: "How is this task currently handled without this tool? How much time does it take?",
      mapping: demandMapping,
      required: true,
    });

    questions.push({
      id: getNextQuestionId("pain_urgency_validation"),
      sectionType: "pain_urgency_validation",
      questionType: "single_select",
      prompt: "How often is this task performed?",
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
  } else {
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
  }

  return questions.slice(0, MAX_QUESTIONS_PER_SECTION);
}

function generateScopeBoundariesQuestions(analysis: IdeaAnalysis): WorkshopQuestion[] {
  const purpose = getPurpose(analysis);
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

  if (purpose === "learning") {
    questions.push({
      id: getNextQuestionId("scope_boundaries"),
      sectionType: "scope_boundaries",
      questionType: "short_text",
      prompt: "What's the minimum you could build to start learning the core concept?",
      mapping: scopeMapping,
      required: true,
    });

    questions.push({
      id: getNextQuestionId("scope_boundaries"),
      sectionType: "scope_boundaries",
      questionType: "short_text",
      prompt: "What features are stretch goals that you'd add only if the basics work well?",
      mapping: scopeMapping,
      required: true,
    });
  } else {
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
  }

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
  const purpose = getPurpose(analysis);
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

  if (!hasContext(analysis, "budget") && (purpose === "commercial" || purpose === "open_source")) {
    const budgetMapping: RiskMapping = {
      type: financialRisk ? "risk" : budgetAssumption ? "assumption" : "risk",
      riskCategory: financialRisk ? "financial" : undefined,
      riskIndex: financialRiskIndex,
      assumptionIndex: budgetAssumptionIndex,
      sourceText: financialRisk?.description || budgetAssumption?.assumption,
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
  }

  if (!hasContext(analysis, "timeline")) {
    const timelineMapping: RiskMapping = {
      type: executionRisk ? "risk" : timelineAssumption ? "assumption" : "risk",
      riskCategory: executionRisk ? "execution" : undefined,
      riskIndex: executionRiskIndex,
      assumptionIndex: timelineAssumptionIndex,
      sourceText: executionRisk?.description || timelineAssumption?.assumption,
    };

    const timelineOptions = purpose === "learning"
      ? [
          { value: "weekend", label: "A weekend" },
          { value: "1_week", label: "About a week" },
          { value: "2_weeks", label: "2 weeks" },
          { value: "1_month", label: "A month or more" },
        ]
      : [
          { value: "1_month", label: "1 month or less" },
          { value: "3_months", label: "1-3 months" },
          { value: "6_months", label: "3-6 months" },
          { value: "12_months", label: "6-12 months" },
          { value: "longer", label: "More than 12 months" },
        ];

    questions.push({
      id: getNextQuestionId("constraints_resources"),
      sectionType: "constraints_resources",
      questionType: "banded_range",
      prompt: purpose === "learning"
        ? "How much time do you want to spend on this?"
        : "What is your target timeline to launch version 1?",
      options: timelineOptions,
      mapping: timelineMapping,
      mappedAssumptionIndex: timelineAssumptionIndex,
      required: true,
    });
  }

  if (purpose !== "learning" && purpose !== "internal") {
    const teamAssumption = analysis.assumptionDependencies.find(
      a => a.assumption.toLowerCase().includes("team") || 
           a.assumption.toLowerCase().includes("capacity") ||
           a.assumption.toLowerCase().includes("resource")
    );
    const teamAssumptionIndex = teamAssumption 
      ? analysis.assumptionDependencies.indexOf(teamAssumption) 
      : undefined;

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
  }

  return questions.slice(0, MAX_QUESTIONS_PER_SECTION);
}

function getSectionsForPurpose(purpose: IdeaPurpose): WorkshopSectionType[] {
  switch (purpose) {
    case "learning":
      return ["pain_urgency_validation", "scope_boundaries", "constraints_resources"];
    case "internal":
      return ["pain_urgency_validation", "scope_boundaries", "constraints_resources"];
    case "developer_tool":
      return ["target_market_clarity", "pain_urgency_validation", "scope_boundaries", "constraints_resources"];
    case "open_source":
      return ["target_market_clarity", "pain_urgency_validation", "scope_boundaries", "constraints_resources"];
    case "commercial":
    default:
      return ["target_market_clarity", "pain_urgency_validation", "scope_boundaries", "constraints_resources"];
  }
}

const SECTION_META: Record<WorkshopSectionType, { title: string; description: string; descriptionByPurpose?: Partial<Record<IdeaPurpose, string>> }> = {
  target_market_clarity: {
    title: "Target Audience",
    description: "Help us understand who this product is for and how you've validated the market.",
    descriptionByPurpose: {
      developer_tool: "Help us understand what type of developer this tool serves and how you've validated the need.",
      open_source: "Help us understand the community this project would serve.",
    },
  },
  pain_urgency_validation: {
    title: "Problem Validation",
    description: "Clarify the problem severity and how users currently cope without your solution.",
    descriptionByPurpose: {
      developer_tool: "Clarify the developer workflow pain point and how it's currently handled.",
      internal: "Clarify the current process this tool would replace and the time it takes.",
      learning: "Define your learning objectives so we can assess scope appropriately.",
    },
  },
  scope_boundaries: {
    title: "Scope & Boundaries",
    description: "Define what's in and out of scope for version 1 to manage complexity.",
    descriptionByPurpose: {
      learning: "Define the minimum viable version that delivers your learning goals.",
    },
  },
  constraints_resources: {
    title: "Constraints & Resources",
    description: "Clarify your resource constraints so the analysis can account for them.",
    descriptionByPurpose: {
      learning: "Help us understand how much time you want to invest.",
    },
  },
};

export function generateWorkshopSections(analysis: IdeaAnalysis): WorkshopSection[] {
  resetQuestionCounters(analysis.id);
  
  const purpose = getPurpose(analysis);
  const sectionTypes = getSectionsForPurpose(purpose);
  const sections: WorkshopSection[] = [];
  let totalQuestions = 0;

  const generators: Record<WorkshopSectionType, (a: IdeaAnalysis) => WorkshopQuestion[]> = {
    target_market_clarity: generateTargetMarketQuestions,
    pain_urgency_validation: generatePainUrgencyQuestions,
    scope_boundaries: generateScopeBoundariesQuestions,
    constraints_resources: generateConstraintsQuestions,
  };

  for (const sectionType of sectionTypes) {
    if (totalQuestions >= MAX_TOTAL_QUESTIONS) break;

    const generator = generators[sectionType];
    const questions = generator(analysis);
    const remainingSlots = Math.min(MAX_QUESTIONS_PER_SECTION, MAX_TOTAL_QUESTIONS - totalQuestions);
    const limitedQuestions = questions.slice(0, remainingSlots);

    if (limitedQuestions.length > 0) {
      const meta = SECTION_META[sectionType];
      const description = meta.descriptionByPurpose?.[purpose] || meta.description;

      sections.push({
        type: sectionType,
        title: meta.title,
        description,
        questions: limitedQuestions,
        triggered: true,
        triggerReason: getTriggerReason(analysis, sectionType),
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
