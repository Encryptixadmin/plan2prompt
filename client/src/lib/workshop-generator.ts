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

function truncate(text: string, maxLen: number = 80): string {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen).trimEnd() + "...";
}

function generateTargetMarketQuestions(analysis: IdeaAnalysis): WorkshopQuestion[] {
  const purpose = getPurpose(analysis);
  const questions: WorkshopQuestion[] = [];
  const ideaTitle = analysis.input.title;

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
        questionType: "short_text",
        prompt: `Describe the developer who would use "${ideaTitle}". What's their role, what tech stack do they work with, and what stage of their workflow would they use this in?`,
        mapping: marketMapping,
        required: true,
      });
    } else if (purpose === "internal") {
      questions.push({
        id: getNextQuestionId("target_market_clarity"),
        sectionType: "target_market_clarity",
        questionType: "short_text",
        prompt: `Who specifically will use "${ideaTitle}"? Describe the people/team, how many there are, and what their current workflow looks like.`,
        mapping: marketMapping,
        required: true,
      });
    } else if (purpose === "open_source") {
      questions.push({
        id: getNextQuestionId("target_market_clarity"),
        sectionType: "target_market_clarity",
        questionType: "short_text",
        prompt: `What community or ecosystem would "${ideaTitle}" serve? Describe the typical contributor or user, and where they currently look for solutions like this.`,
        mapping: marketMapping,
        required: true,
      });
    } else if (purpose === "learning") {
      questions.push({
        id: getNextQuestionId("target_market_clarity"),
        sectionType: "target_market_clarity",
        questionType: "short_text",
        prompt: `What specific skills or technologies do you want to learn by building "${ideaTitle}"? What's your current experience level with these?`,
        mapping: marketMapping,
        required: true,
      });
    } else {
      questions.push({
        id: getNextQuestionId("target_market_clarity"),
        sectionType: "target_market_clarity",
        questionType: "short_text",
        prompt: `Describe the ideal first user of "${ideaTitle}". Who are they, what problem do they face daily, and how are they dealing with it right now?`,
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

    questions.push({
      id: getNextQuestionId("target_market_clarity"),
      sectionType: "target_market_clarity",
      questionType: "short_text",
      prompt: `The analysis flagged an unvalidated assumption: "${truncate(relevantAssumption.assumption)}". What evidence or experience do you have that supports or challenges this?`,
      mapping: assumptionMapping,
      mappedAssumptionIndex: assumptionIndex,
      required: true,
    });
  }

  if (!hasContext(analysis, "competitors")) {
    if (purpose === "developer_tool") {
      questions.push({
        id: getNextQuestionId("target_market_clarity"),
        sectionType: "target_market_clarity",
        questionType: "short_text",
        prompt: `What tools or approaches do developers currently use to solve the problem "${ideaTitle}" addresses? What's missing or frustrating about those existing options?`,
        required: true,
      });
    } else if (purpose === "commercial") {
      questions.push({
        id: getNextQuestionId("target_market_clarity"),
        sectionType: "target_market_clarity",
        questionType: "short_text",
        prompt: `What existing products or alternatives compete with "${ideaTitle}"? Why would someone switch from those to your solution?`,
        required: true,
      });
    } else if (purpose === "open_source") {
      questions.push({
        id: getNextQuestionId("target_market_clarity"),
        sectionType: "target_market_clarity",
        questionType: "short_text",
        prompt: `What existing open-source projects or tools overlap with "${ideaTitle}"? What gap do they leave that this project would fill?`,
        required: true,
      });
    }
  }

  return questions.slice(0, MAX_QUESTIONS_PER_SECTION);
}

function generatePainUrgencyQuestions(analysis: IdeaAnalysis): WorkshopQuestion[] {
  const purpose = getPurpose(analysis);
  const questions: WorkshopQuestion[] = [];
  const ideaTitle = analysis.input.title;

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

  if (purpose === "learning") {
    questions.push({
      id: getNextQuestionId("pain_urgency_validation"),
      sectionType: "pain_urgency_validation",
      questionType: "short_text",
      prompt: `What specific concept or technique in "${ideaTitle}" are you most uncertain about? What would "success" look like for this learning project?`,
      required: true,
    });

    questions.push({
      id: getNextQuestionId("pain_urgency_validation"),
      sectionType: "pain_urgency_validation",
      questionType: "short_text",
      prompt: `Have you attempted to build something similar before? What happened, and what would you do differently this time?`,
      required: true,
    });

    return questions.slice(0, MAX_QUESTIONS_PER_SECTION);
  }

  if (purpose === "developer_tool") {
    questions.push({
      id: getNextQuestionId("pain_urgency_validation"),
      sectionType: "pain_urgency_validation",
      questionType: "short_text",
      prompt: `Walk through the specific workflow "${ideaTitle}" would improve. What does a developer currently do step-by-step, and where does frustration or wasted time occur?`,
      mapping: demandMapping,
      required: true,
    });

    questions.push({
      id: getNextQuestionId("pain_urgency_validation"),
      sectionType: "pain_urgency_validation",
      questionType: "short_text",
      prompt: `How have you validated that other developers share this pain point? Have you seen complaints, forum posts, tweets, or experienced it yourself on a team?`,
      mapping: painMapping,
      mappedAssumptionIndex: painAssumptionIndex,
      required: true,
    });
  } else if (purpose === "internal") {
    questions.push({
      id: getNextQuestionId("pain_urgency_validation"),
      sectionType: "pain_urgency_validation",
      questionType: "short_text",
      prompt: `Describe exactly how this task is currently handled without "${ideaTitle}". How much time does it take per occurrence, and how often does it happen?`,
      mapping: demandMapping,
      required: true,
    });

    questions.push({
      id: getNextQuestionId("pain_urgency_validation"),
      sectionType: "pain_urgency_validation",
      questionType: "short_text",
      prompt: `What goes wrong when this task is done manually or with the current process? Have there been errors, delays, or missed deadlines because of it?`,
      mapping: painMapping,
      mappedAssumptionIndex: painAssumptionIndex,
      required: true,
    });
  } else {
    questions.push({
      id: getNextQuestionId("pain_urgency_validation"),
      sectionType: "pain_urgency_validation",
      questionType: "short_text",
      prompt: `What do potential users of "${ideaTitle}" currently do to solve this problem? Describe their workaround and what makes it inadequate.`,
      mapping: demandMapping,
      required: true,
    });

    questions.push({
      id: getNextQuestionId("pain_urgency_validation"),
      sectionType: "pain_urgency_validation",
      questionType: "short_text",
      prompt: `What happens if users DON'T solve this problem? What's the real cost — lost time, lost money, frustration, missed opportunities?`,
      mapping: painMapping,
      mappedAssumptionIndex: painAssumptionIndex,
      required: true,
    });

    if (demandRiskDriver) {
      questions.push({
        id: getNextQuestionId("pain_urgency_validation"),
        sectionType: "pain_urgency_validation",
        questionType: "short_text",
        prompt: `The analysis flagged "${truncate(demandRiskDriver.title)}" as a risk. What concrete evidence do you have that people want this badly enough to pay for it or change their behavior?`,
        mapping: demandMapping,
        required: true,
      });
    }
  }

  return questions.slice(0, MAX_QUESTIONS_PER_SECTION);
}

function generateScopeBoundariesQuestions(analysis: IdeaAnalysis): WorkshopQuestion[] {
  const purpose = getPurpose(analysis);
  const questions: WorkshopQuestion[] = [];
  const ideaTitle = analysis.input.title;

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
      prompt: `What's the smallest version of "${ideaTitle}" you could build that would still teach you the core concepts? Describe just the essential pieces.`,
      mapping: scopeMapping,
      required: true,
    });

    questions.push({
      id: getNextQuestionId("scope_boundaries"),
      sectionType: "scope_boundaries",
      questionType: "short_text",
      prompt: `What parts of "${ideaTitle}" are stretch goals you'd only tackle once the basics are working? List them so you have a clear stopping point.`,
      mapping: scopeMapping,
      required: true,
    });
  } else {
    questions.push({
      id: getNextQuestionId("scope_boundaries"),
      sectionType: "scope_boundaries",
      questionType: "short_text",
      prompt: `What is the single most important thing "${ideaTitle}" must do well in version 1? If users could only do ONE thing with it, what would that be?`,
      mapping: scopeMapping,
      required: true,
    });

    questions.push({
      id: getNextQuestionId("scope_boundaries"),
      sectionType: "scope_boundaries",
      questionType: "short_text",
      prompt: `What features or capabilities are explicitly OUT of scope for version 1 of "${ideaTitle}"? List anything users might expect but won't get initially.`,
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
      questionType: "short_text",
      prompt: `The analysis identified hidden complexity in "${highComplexityWarning.area}": "${truncate(highComplexityWarning.hiddenComplexity)}". How do you plan to handle this — simplify, defer, use an existing service, or tackle it head-on?`,
      mapping: highComplexityMapping,
      required: true,
    });
  } else {
    questions.push({
      id: getNextQuestionId("scope_boundaries"),
      sectionType: "scope_boundaries",
      questionType: "short_text",
      prompt: `What's the hardest technical challenge you anticipate when building "${ideaTitle}"? How do you plan to approach it?`,
      required: true,
    });
  }

  return questions.slice(0, MAX_QUESTIONS_PER_SECTION);
}

function generateConstraintsQuestions(analysis: IdeaAnalysis): WorkshopQuestion[] {
  const purpose = getPurpose(analysis);
  const questions: WorkshopQuestion[] = [];
  const ideaTitle = analysis.input.title;

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
      prompt: `What is your budget range for building version 1 of "${ideaTitle}"?`,
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
        ? `How much time do you want to spend building "${ideaTitle}"?`
        : `What is your target timeline to launch version 1 of "${ideaTitle}"?`,
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
      questionType: "short_text",
      prompt: `Who will actually build "${ideaTitle}"? Describe the team — size, key skills available, and any skill gaps you'd need to fill.`,
      mapping: teamMapping,
      mappedAssumptionIndex: teamAssumptionIndex,
      required: true,
    });
  } else if (purpose === "internal" && !hasContext(analysis, "skills")) {
    questions.push({
      id: getNextQuestionId("constraints_resources"),
      sectionType: "constraints_resources",
      questionType: "short_text",
      prompt: `What technical skills do you (or your team) have that are relevant to building "${ideaTitle}"? Are there any areas where you'd need to learn something new?`,
      required: true,
    });
  }

  return questions.slice(0, MAX_QUESTIONS_PER_SECTION);
}

function buildSection(
  type: WorkshopSectionType,
  title: string,
  description: string,
  questions: WorkshopQuestion[],
  analysis: IdeaAnalysis
): WorkshopSection | null {
  if (questions.length === 0) return null;
  
  return {
    type,
    title,
    description,
    questions,
    triggered: true,
    triggerReason: getTriggerReason(analysis, type),
  };
}

export interface WorkshopSessionResult {
  sections: WorkshopSection[];
  totalQuestions: number;
}

export function createWorkshopSession(analysis: IdeaAnalysis): WorkshopSessionResult {
  resetQuestionCounters(analysis.id);
  const purpose = getPurpose(analysis);

  const sections: WorkshopSection[] = [];

  const targetTitle = purpose === "developer_tool" ? "Target Developers" :
    purpose === "internal" ? "Target Users" :
    purpose === "learning" ? "Learning Goals" :
    purpose === "open_source" ? "Target Community" :
    "Target Audience";

  const targetDesc = purpose === "developer_tool" ? "Help us understand who will use this tool and why they'd adopt it." :
    purpose === "internal" ? "Clarify who benefits from this tool and how it fits their work." :
    purpose === "learning" ? "Define what you want to learn and how this project helps." :
    purpose === "open_source" ? "Identify the community this serves and what gap it fills." :
    "Define your ideal user and validate their need for this solution.";

  const targetMarketSection = buildSection(
    "target_market_clarity",
    targetTitle,
    targetDesc,
    generateTargetMarketQuestions(analysis),
    analysis
  );

  const painTitle = purpose === "developer_tool" ? "Developer Pain Point" :
    purpose === "internal" ? "Problem Validation" :
    purpose === "learning" ? "Learning Direction" :
    "Problem & Urgency";

  const painDesc = purpose === "developer_tool" ? "Validate that the workflow problem is real and worth solving with a dedicated tool." :
    purpose === "internal" ? "Confirm the manual process is painful enough to justify building a tool." :
    purpose === "learning" ? "Clarify your learning objectives and how this project addresses them." :
    "Confirm the problem is urgent and painful enough that users will seek a solution.";

  const painSection = buildSection(
    "pain_urgency_validation",
    painTitle,
    painDesc,
    generatePainUrgencyQuestions(analysis),
    analysis
  );

  const scopeSection = buildSection(
    "scope_boundaries",
    "Scope & Boundaries",
    "Define what version 1 includes and what it doesn't, so the analysis reflects realistic scope.",
    generateScopeBoundariesQuestions(analysis),
    analysis
  );

  const constraintsTitle = purpose === "learning" ? "Time & Resources" : "Constraints & Resources";
  const constraintsDesc = purpose === "learning"
    ? "Set realistic time expectations for this learning project."
    : "Clarify the budget, timeline, and team resources available to build this.";

  const constraintsSection = buildSection(
    "constraints_resources",
    constraintsTitle,
    constraintsDesc,
    generateConstraintsQuestions(analysis),
    analysis
  );

  if (targetMarketSection) sections.push(targetMarketSection);
  if (painSection) sections.push(painSection);
  if (scopeSection) sections.push(scopeSection);
  if (constraintsSection) sections.push(constraintsSection);

  let totalQuestions = sections.reduce((sum, s) => sum + s.questions.length, 0);

  if (totalQuestions > MAX_TOTAL_QUESTIONS) {
    for (const section of sections) {
      if (totalQuestions <= MAX_TOTAL_QUESTIONS) break;
      while (section.questions.length > 2 && totalQuestions > MAX_TOTAL_QUESTIONS) {
        section.questions.pop();
        totalQuestions--;
      }
    }
  }

  return { sections, totalQuestions };
}
