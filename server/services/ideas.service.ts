import { randomUUID } from "crypto";
import type {
  IdeaInput,
  IdeaAnalysis,
  IdeaStrength,
  IdeaWeakness,
  IdeaRisk,
  IdeaFeasibility,
  IdeaNextStep,
  ConfidenceAssessment,
  RiskDriver,
  ScopeWarning,
  AssumptionDependency,
  FailureModeNarrative,
  IdeaPurpose,
  TechnicalProfile,
  CommercialProfile,
  ExecutionProfile,
  ViabilityAssessment,
  ComplexityLevel,
  DataComplexity,
  ComplianceExposure,
  ClarityLevel,
  RevenueModelClarity,
  CompetitionDensity,
  DifferentiationStrength,
  TeamComplexity,
  LikelihoodLevel,
  ViabilityBand,
} from "@shared/types/ideas";
import { consensusService } from "./ai";
import { artifactService } from "./artifact.service";
import { researchService } from "./research.service";
import type { AIConsensusResult } from "@shared/types/ai";
import type { PipelineStage } from "@shared/types/pipeline";
import type { UsageModule } from "@shared/schema";

const PURPOSE_LABELS: Record<string, string> = {
  commercial: "Commercial Product (SaaS, marketplace, consumer app — revenue-focused)",
  developer_tool: "Developer Tool (SDK, CLI, library, devtool — adoption-focused)",
  internal: "Internal/Personal Tool (private use, team utility — utility-focused)",
  open_source: "Open Source Project (community-driven — contribution-focused)",
  learning: "Learning/Experiment (skill-building, prototype — knowledge-focused)",
};

export class IdeasService {
  async analyzeIdea(input: IdeaInput, projectId?: string, userId?: string): Promise<IdeaAnalysis> {
    const isRefinement = !!(input.context?.workshopRefinement);

    if (!input.context) {
      input.context = {};
    }

    let researchBrief = input.context.researchBrief || "";
    if (!researchBrief) {
      try {
        researchBrief = await researchService.generateResearchBrief(input, projectId, userId);
        if (researchBrief) {
          input.context.researchBrief = researchBrief;
        }
      } catch (error) {
        console.error("[Ideas] Research brief generation failed, proceeding without:", error);
      }
    }

    const prompt = this.buildAnalysisPrompt(input);
    const systemPrompt = isRefinement
      ? this.getRefinementSystemPrompt(input.purpose)
      : this.getSystemPrompt(input.purpose);
    const usageContext = projectId
      ? { projectId, module: "ideas" as UsageModule, userId }
      : undefined;

    const consensus = await consensusService.getConsensus({
      prompt: {
        system: systemPrompt,
        user: prompt,
        context: JSON.stringify(input.context || {}),
      },
    }, usageContext);

    const analysis = this.parseConsensusToAnalysis(input, consensus);
    return analysis;
  }

  async acceptIdea(analysis: IdeaAnalysis, stopAcknowledged = false): Promise<IdeaAnalysis> {
    const artifact = await this.saveAsArtifact(analysis, stopAcknowledged);
    analysis.artifactId = artifact.metadata.id;
    return analysis;
  }

  private buildAnalysisPrompt(input: IdeaInput): string {
    const purposeLabel = input.purpose ? PURPOSE_LABELS[input.purpose] || input.purpose : "Not specified";

    let prompt = `Analyze the following idea:\n\n`;
    prompt += `**Title:** ${input.title}\n\n`;
    prompt += `**Description:** ${input.description}\n\n`;
    prompt += `**Purpose/Type:** ${purposeLabel}\n\n`;

    if (input.context) {
      prompt += `**Context:**\n`;
      if (input.context.targetMarket) {
        prompt += `- Target Audience: ${input.context.targetMarket}\n`;
      }
      if (input.context.skills && input.context.skills.length > 0) {
        prompt += `- Available Skills: ${input.context.skills.join(", ")}\n`;
      }
      if (input.context.budget) {
        prompt += `- Budget Level: ${input.context.budget}\n`;
      }
      if (input.context.timeline) {
        prompt += `- Timeline: ${input.context.timeline}\n`;
      }
      if (input.context.competitors) {
        prompt += `- Known Alternatives/Competitors: ${input.context.competitors}\n`;
      }

      if (input.context.researchBrief) {
        prompt += `\n=== DOMAIN RESEARCH BRIEF ===\n`;
        prompt += `The following research was gathered about this idea's domain, market, and competitive landscape. Use it to ground your analysis in real-world context.\n\n`;
        prompt += `${input.context.researchBrief}\n`;
        prompt += `\n=== END RESEARCH BRIEF ===\n`;
      }

      if (input.context.workshopRefinement) {
        console.log(`[IdeasService] Including workshop refinement in re-analysis prompt (${input.context.workshopRefinement.length} chars)`);
        prompt += `\n${input.context.workshopRefinement}\n`;
      }
    }

    prompt += `\nYou MUST respond with valid JSON matching this structure exactly. Do not include any text before or after the JSON:\n`;
    prompt += `{
  "strengths": [{"title": "string", "description": "string", "confidence": 0.0-1.0}],
  "weaknesses": [{"title": "string", "description": "string", "severity": "low"|"medium"|"high", "mitigation": "string"}],
  "feasibility": {
    "technical": {"score": 0-100, "notes": "string"},
    "market": {"score": 0-100, "notes": "string"},
    "financial": {"score": 0-100, "notes": "string"},
    "timeline": {"score": 0-100, "notes": "string"}
  },
  "risks": [{"category": "market"|"technical"|"financial"|"legal"|"competitive"|"execution", "description": "string", "severity": "low"|"medium"|"high", "recommendation": "string"}],
  "nextSteps": [{"priority": 1, "action": "string", "description": "string", "effort": "low"|"medium"|"high"}],
  "riskDrivers": [{"rank": 1, "title": "string", "whyItMatters": "string", "failureTrigger": "string", "isControllable": true|false, "controllabilityNote": "string"}],
  "scopeWarnings": [{"area": "technical"|"ux"|"operations"|"compliance"|"integration"|"data", "warning": "string", "hiddenComplexity": "string", "underestimationRisk": "low"|"medium"|"high"}],
  "assumptions": [{"assumption": "string", "status": "validated"|"unvalidated"|"risky", "validationMethod": "string", "riskIfWrong": "string"}],
  "failureNarrative": "string",
  "summary": "string",
  "technicalProfile": {
    "architectureComplexity": "Low"|"Moderate"|"High"|"Very High",
    "integrationDifficulty": "Low"|"Moderate"|"High"|"Very High",
    "dataComplexity": "Simple"|"Structured"|"Complex"|"Highly Regulated",
    "complianceExposure": "None"|"Low"|"Moderate"|"High",
    "estimatedMvpEffortWeeks": number,
    "keyTechnicalRisks": ["string"]
  },
  "commercialProfile": {
    "marketClarity": "Defined"|"Partially Defined"|"Unclear",
    "revenueModelClarity": "Clear"|"Emerging"|"Unclear",
    "competitionDensity": "Low"|"Moderate"|"High",
    "differentiationStrength": "Weak"|"Moderate"|"Strong",
    "goToMarketComplexity": "Low"|"Moderate"|"High"|"Very High",
    "keyCommercialRisks": ["string"]
  },
  "executionProfile": {
    "teamComplexity": "Solo"|"Small Team"|"Cross-Functional"|"Enterprise",
    "hiddenWorkLikelihood": "Low"|"Moderate"|"High",
    "scalabilityChallenges": ["string"],
    "operationalRisks": ["string"]
  },
  "viabilityAssessment": {
    "overallViability": "Strong"|"Moderate"|"Weak"|"Critical Risk",
    "confidenceScore": 0-100,
    "rationale": "string"
  }
}\n`;

    if (input.context?.workshopRefinement) {
      prompt += `\nCRITICAL RE-ANALYSIS INSTRUCTIONS:\n`;
      prompt += `The builder completed a Refinement Interview. You MUST:\n`;
      prompt += `1. Reference SPECIFIC details from the interview by name (e.g., competitor names, pricing figures, technical choices, target demographics).\n`;
      prompt += `2. Use the builder's exact data points in strength/weakness descriptions and feasibility notes.\n`;
      prompt += `3. Adjust risk severities and assumption statuses based on the concrete evidence provided.\n`;
      prompt += `4. Do NOT generalize or abstract away the specific information the builder shared.\n`;
      prompt += `5. Every strength, weakness, and risk should cite relevant interview evidence where applicable.\n`;
    }

    return prompt;
  }

  private getSystemPrompt(purpose?: IdeaPurpose): string {
    const purposeGuidance = this.getPurposeGuidance(purpose);

    return `You are a critical-minded advisor and product strategist. Your job is to provide honest, specific analysis that helps the builder make an informed decision.

PROJECT TYPE: ${PURPOSE_LABELS[purpose || "commercial"] || "Not specified"}

${purposeGuidance}

CORE MANDATE:
- Be direct and specific to THIS idea, not generic
- Every strength, weakness, risk, and recommendation must reference specifics from the description
- Do NOT produce generic advice that could apply to any idea
- Tailor your analysis to the project type (commercial products need market validation; dev tools need adoption analysis; internal tools need utility justification; learning projects need scope management)

ANALYSIS PRINCIPLES:
1. Ground every point in the specific idea description provided
2. Risks and weaknesses must be unique to this idea, not boilerplate
3. Feasibility scores must reflect the specific context provided (skills, budget, timeline)
4. Next steps must be actionable for this specific idea and project type

OUTPUT REQUIREMENTS:
- No encouragement language ("great idea", "promising", "exciting")
- Every positive must be balanced with a specific risk
- Confidence scores must be justified with specific evidence from the description
- Failure modes must be specific to THIS idea, not generic
- Respond with valid JSON only, no markdown wrapping

The builder should be able to decide: Proceed, Revise, or Stop based on your analysis alone.`;
  }

  private getRefinementSystemPrompt(purpose?: IdeaPurpose): string {
    const purposeGuidance = this.getPurposeGuidance(purpose);

    return `You are a critical-minded advisor performing a REFINEMENT RE-ANALYSIS. This is NOT a fresh analysis — the builder has already received an initial analysis and has completed a Guided Refinement Workshop providing additional context, evidence, and clarifications.

PROJECT TYPE: ${PURPOSE_LABELS[purpose || "commercial"] || "Not specified"}

${purposeGuidance}

REFINEMENT-SPECIFIC INSTRUCTIONS:
1. The prompt contains a WORKSHOP FINDINGS section with Q&A pairs. These are the builder's direct responses to specific questions about their idea. Treat each answer as new evidence.
2. If a DOMAIN RESEARCH BRIEF is provided, use it to ground your analysis in real-world context — reference specific competitors, regulations, market data, and technical standards mentioned in the research.
3. Do NOT repeat the same generic analysis from before. Your job is to produce an UPDATED analysis that reflects:
   - Assumptions that have been validated or partially validated by the builder's answers
   - Risks that should be adjusted (up or down) based on new evidence
   - New strengths or weaknesses revealed by the builder's domain knowledge
   - More specific, grounded recommendations based on the research brief
4. If the builder mentioned specific details (e.g., target aircraft models, specific user workflows, regulatory requirements, competitor products), reference those details by name in your analysis.
5. If the research brief mentions specific competitors or products, evaluate the idea's differentiation against those specific products.

WHAT CHANGED vs. FIRST ANALYSIS:
- Previously unvalidated assumptions may now have supporting evidence
- Risk severities may have shifted based on builder's clarifications
- Scope may be better defined (what's in v1 vs. what's deferred)
- Budget, timeline, and team constraints may now be specified
- Domain-specific context from research should inform feasibility scores

OUTPUT REQUIREMENTS:
- Reference the builder's specific answers and research findings in your analysis text
- Adjusted feasibility scores should reflect the new information
- Risk descriptions should be more specific based on domain research
- Recommendations should reference specific products, tools, or approaches from the research
- No encouragement language ("great idea", "promising", "exciting")
- Respond with valid JSON only, no markdown wrapping

The builder should leave this re-analysis with a clearer, more grounded picture than the first pass.`;
  }

  private getPurposeGuidance(purpose?: IdeaPurpose): string {
    switch (purpose) {
      case "developer_tool":
        return `FOCUS FOR DEVELOPER TOOLS:
- Evaluate developer experience (DX) and integration friction
- Assess the existing tooling landscape and gaps this fills
- Consider adoption barriers: learning curve, migration cost, lock-in risk
- Market validation means developer community interest, not consumer demand
- Revenue model may be freemium, sponsorship, or consulting — not always direct sales
- Skip consumer-market questions; focus on developer workflow fit`;

      case "internal":
        return `FOCUS FOR INTERNAL/PERSONAL TOOLS:
- Market validation is NOT relevant — skip market demand analysis
- Focus on: Does this solve a real, recurring problem for the builder/team?
- Evaluate build-vs-buy: could an existing tool handle this?
- Time investment vs. time saved is the key metric
- Technical complexity relative to the builder's skills is critical
- No need for competitive analysis or revenue model`;

      case "open_source":
        return `FOCUS FOR OPEN SOURCE PROJECTS:
- Community fit: Is there an existing community that would benefit?
- Maintenance burden: Can the creator sustain this long-term?
- Differentiation from existing open source alternatives
- Documentation and onboarding are critical success factors
- Revenue is typically indirect (consulting, sponsorship, hiring pipeline)
- Adoption depends on solving a real pain point in the ecosystem`;

      case "learning":
        return `FOCUS FOR LEARNING/EXPERIMENT PROJECTS:
- Market validation and revenue are NOT relevant
- Focus on: Will this project teach the intended skills?
- Evaluate scope — learning projects fail when they're too ambitious
- Assess whether the technical challenges match the learning goals
- Recommend incremental milestones that deliver learning value
- The "risk" is wasted time, not lost money`;

      case "commercial":
      default:
        return `FOCUS FOR COMMERCIAL PRODUCTS:
- Market validation and product-market fit are paramount
- Revenue model viability is critical
- User acquisition strategy and competitive positioning matter
- Build cost relative to addressable market size
- Regulatory and legal considerations if applicable`;
    }
  }

  private parseConsensusToAnalysis(
    input: IdeaInput,
    consensus: AIConsensusResult
  ): IdeaAnalysis {
    const id = randomUUID();

    const primaryResponse = consensus.providerResponses
      .sort((a, b) => b.confidence - a.confidence)[0];

    let parsed = this.tryParseAIResponse(primaryResponse?.content || "");

    if (!parsed && consensus.providerResponses.length > 1) {
      for (const resp of consensus.providerResponses) {
        parsed = this.tryParseAIResponse(resp.content);
        if (parsed) break;
      }
    }

    if (!parsed) {
      parsed = this.extractFromFreeText(primaryResponse?.content || consensus.unifiedContent, input);
    }

    const strengths = this.validateStrengths(parsed.strengths || []);
    const weaknesses = this.validateWeaknesses(parsed.weaknesses || []);
    const feasibility = this.validateFeasibility(parsed.feasibility);
    const risks = this.validateRisks(parsed.risks || []);
    const nextSteps = this.validateNextSteps(parsed.nextSteps || []);
    const primaryRiskDrivers = this.validateRiskDrivers(parsed.riskDrivers || []);
    const scopeWarnings = this.validateScopeWarnings(parsed.scopeWarnings || []);
    const assumptionDependencies = this.validateAssumptions(parsed.assumptions || []);

    const technicalProfile = this.validateTechnicalProfile(parsed.technicalProfile);
    const commercialProfile = this.validateCommercialProfile(parsed.commercialProfile);
    const executionProfile = this.validateExecutionProfile(parsed.executionProfile);
    const viabilityAssessment = this.validateViabilityAssessment(parsed.viabilityAssessment);

    const confidenceAssessment = this.buildConfidenceAssessment(
      consensus, feasibility, strengths, weaknesses, assumptionDependencies
    );

    const failureModeNarrative = this.buildFailureNarrative(
      parsed.failureNarrative || "", primaryRiskDrivers, input
    );

    const overallScore = this.computeWeightedScore(
      viabilityAssessment, technicalProfile, commercialProfile, executionProfile, feasibility
    );

    const { recommendation, rationale } = this.determineRecommendation(
      overallScore, primaryRiskDrivers, assumptionDependencies, scopeWarnings,
      technicalProfile, commercialProfile, executionProfile
    );

    const summary = parsed.summary ||
      `"${input.title}" scored ${Math.max(0, Math.min(100, overallScore))}/100. ` +
      `Confidence: ${(consensus.confidence * 100).toFixed(0)}% across ${consensus.providerResponses.length} providers.`;

    return {
      id,
      input,
      strengths,
      weaknesses,
      feasibility,
      risks,
      nextSteps,
      summary,
      overallScore: Math.max(0, Math.min(100, overallScore)),
      consensusConfidence: consensus.confidence,
      providerAgreement: consensus.agreementScore,
      createdAt: new Date().toISOString(),
      technicalProfile,
      commercialProfile,
      executionProfile,
      viabilityAssessment,
      confidenceAssessment,
      primaryRiskDrivers,
      scopeWarnings,
      assumptionDependencies,
      failureModeNarrative,
      recommendation,
      recommendationRationale: rationale,
    };
  }

  private tryParseAIResponse(content: string): any | null {
    if (!content) return null;

    try {
      return JSON.parse(content);
    } catch {
    }

    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {
      }
    }

    const braceMatch = content.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try {
        return JSON.parse(braceMatch[0]);
      } catch {
      }
    }

    return null;
  }

  private extractFromFreeText(content: string, input: IdeaInput): any {
    const lowerContent = content.toLowerCase();

    const strengths: IdeaStrength[] = [{
      title: "Concept Articulation",
      description: `The idea "${input.title}" addresses a specific space. Full AI analysis: ${content.substring(0, 300)}`,
      confidence: 0.6,
    }];

    const weaknesses: IdeaWeakness[] = [{
      title: "Analysis Requires Review",
      description: "The AI analysis was returned in unstructured format. Review the full text for detailed insights.",
      severity: "medium" as const,
      mitigation: "Review the raw analysis output and refine the idea description for better structured results.",
    }];

    const risks: IdeaRisk[] = [{
      category: "execution" as const,
      description: "Unable to extract structured risk assessment. The idea should be re-analysed with a more detailed description.",
      severity: "medium" as const,
      recommendation: "Add more specific details about the implementation approach and target users.",
    }];

    return {
      strengths,
      weaknesses,
      feasibility: null,
      risks,
      nextSteps: [{
        priority: 1,
        action: "Refine Description",
        description: "Add more specific details about what this product does, who it's for, and how it works to enable better AI analysis.",
        effort: "low",
      }],
      riskDrivers: [],
      scopeWarnings: [],
      assumptions: [],
      failureNarrative: content.substring(0, 500),
      summary: `Analysis of "${input.title}" completed with unstructured output. Review details below.`,
    };
  }

  private validateStrengths(raw: any[]): IdeaStrength[] {
    return raw.slice(0, 6).map(s => ({
      title: String(s.title || "Untitled Strength"),
      description: String(s.description || ""),
      confidence: Math.max(0, Math.min(1, Number(s.confidence) || 0.5)),
    })).filter(s => s.description.length > 0);
  }

  private validateWeaknesses(raw: any[]): IdeaWeakness[] {
    const validSeverities = ["low", "medium", "high"];
    return raw.slice(0, 6).map(w => ({
      title: String(w.title || "Untitled Weakness"),
      description: String(w.description || ""),
      severity: (validSeverities.includes(w.severity) ? w.severity : "medium") as "low" | "medium" | "high",
      mitigation: w.mitigation ? String(w.mitigation) : undefined,
    })).filter(w => w.description.length > 0);
  }

  private validateFeasibility(raw: any): IdeaFeasibility {
    if (!raw) {
      return {
        score: 50,
        technical: { score: 50, notes: "Insufficient data for detailed technical assessment." },
        market: { score: 50, notes: "Insufficient data for detailed market assessment." },
        financial: { score: 50, notes: "Insufficient data for detailed financial assessment." },
        timeline: { score: 50, notes: "Insufficient data for detailed timeline assessment." },
      };
    }

    const clampScore = (v: any) => Math.max(0, Math.min(100, Number(v) || 50));

    const technical = {
      score: clampScore(raw.technical?.score),
      notes: String(raw.technical?.notes || "No notes provided."),
    };
    const market = {
      score: clampScore(raw.market?.score),
      notes: String(raw.market?.notes || "No notes provided."),
    };
    const financial = {
      score: clampScore(raw.financial?.score),
      notes: String(raw.financial?.notes || "No notes provided."),
    };
    const timeline = {
      score: clampScore(raw.timeline?.score),
      notes: String(raw.timeline?.notes || "No notes provided."),
    };

    return {
      score: Math.round((technical.score + market.score + financial.score + timeline.score) / 4),
      technical,
      market,
      financial,
      timeline,
    };
  }

  private validateRisks(raw: any[]): IdeaRisk[] {
    const validCategories = ["market", "technical", "financial", "legal", "competitive", "execution"];
    const validSeverities = ["low", "medium", "high"];
    return raw.slice(0, 8).map(r => ({
      category: (validCategories.includes(r.category) ? r.category : "execution") as IdeaRisk["category"],
      description: String(r.description || ""),
      severity: (validSeverities.includes(r.severity) ? r.severity : "medium") as "low" | "medium" | "high",
      recommendation: r.recommendation ? String(r.recommendation) : undefined,
    })).filter(r => r.description.length > 0);
  }

  private validateNextSteps(raw: any[]): IdeaNextStep[] {
    const validEfforts = ["low", "medium", "high"];
    return raw.slice(0, 6).map((s, i) => ({
      priority: Number(s.priority) || (i + 1),
      action: String(s.action || ""),
      description: String(s.description || ""),
      effort: (validEfforts.includes(s.effort) ? s.effort : "medium") as "low" | "medium" | "high",
    })).filter(s => s.action.length > 0);
  }

  private validateRiskDrivers(raw: any[]): RiskDriver[] {
    return raw.slice(0, 5).map((r, i) => ({
      rank: Number(r.rank) || (i + 1),
      title: String(r.title || ""),
      whyItMatters: String(r.whyItMatters || ""),
      failureTrigger: String(r.failureTrigger || ""),
      isControllable: Boolean(r.isControllable),
      controllabilityNote: String(r.controllabilityNote || ""),
    })).filter(r => r.title.length > 0);
  }

  private validateScopeWarnings(raw: any[]): ScopeWarning[] {
    const validAreas = ["technical", "ux", "operations", "compliance", "integration", "data"];
    const validRisks = ["low", "medium", "high"];
    return raw.slice(0, 6).map(w => ({
      area: (validAreas.includes(w.area) ? w.area : "technical") as ScopeWarning["area"],
      warning: String(w.warning || ""),
      hiddenComplexity: String(w.hiddenComplexity || ""),
      underestimationRisk: (validRisks.includes(w.underestimationRisk) ? w.underestimationRisk : "medium") as "low" | "medium" | "high",
    })).filter(w => w.warning.length > 0);
  }

  private validateAssumptions(raw: any[]): AssumptionDependency[] {
    const validStatuses = ["validated", "unvalidated", "risky"];
    return raw.slice(0, 8).map(a => ({
      assumption: String(a.assumption || ""),
      status: (validStatuses.includes(a.status) ? a.status : "unvalidated") as "validated" | "unvalidated" | "risky",
      validationMethod: a.validationMethod ? String(a.validationMethod) : undefined,
      riskIfWrong: a.riskIfWrong ? String(a.riskIfWrong) : undefined,
    })).filter(a => a.assumption.length > 0);
  }

  private validateTechnicalProfile(raw: any): TechnicalProfile {
    const validComplexity: ComplexityLevel[] = ["Low", "Moderate", "High", "Very High"];
    const validData: DataComplexity[] = ["Simple", "Structured", "Complex", "Highly Regulated"];
    const validCompliance: ComplianceExposure[] = ["None", "Low", "Moderate", "High"];

    if (!raw || typeof raw !== "object") {
      return {
        architectureComplexity: "Moderate",
        integrationDifficulty: "Moderate",
        dataComplexity: "Structured",
        complianceExposure: "None",
        estimatedMvpEffortWeeks: 12,
        keyTechnicalRisks: [],
      };
    }

    return {
      architectureComplexity: validComplexity.includes(raw.architectureComplexity) ? raw.architectureComplexity : "Moderate",
      integrationDifficulty: validComplexity.includes(raw.integrationDifficulty) ? raw.integrationDifficulty : "Moderate",
      dataComplexity: validData.includes(raw.dataComplexity) ? raw.dataComplexity : "Structured",
      complianceExposure: validCompliance.includes(raw.complianceExposure) ? raw.complianceExposure : "None",
      estimatedMvpEffortWeeks: Math.max(1, Math.min(104, Number(raw.estimatedMvpEffortWeeks) || 12)),
      keyTechnicalRisks: Array.isArray(raw.keyTechnicalRisks)
        ? raw.keyTechnicalRisks.filter((r: any) => typeof r === "string" && r.length > 0).slice(0, 6)
        : [],
    };
  }

  private validateCommercialProfile(raw: any): CommercialProfile {
    const validClarity: ClarityLevel[] = ["Defined", "Partially Defined", "Unclear"];
    const validRevenue: RevenueModelClarity[] = ["Clear", "Emerging", "Unclear"];
    const validCompetition: CompetitionDensity[] = ["Low", "Moderate", "High"];
    const validDiff: DifferentiationStrength[] = ["Weak", "Moderate", "Strong"];
    const validComplexity: ComplexityLevel[] = ["Low", "Moderate", "High", "Very High"];

    if (!raw || typeof raw !== "object") {
      return {
        marketClarity: "Partially Defined",
        revenueModelClarity: "Emerging",
        competitionDensity: "Moderate",
        differentiationStrength: "Moderate",
        goToMarketComplexity: "Moderate",
        keyCommercialRisks: [],
      };
    }

    return {
      marketClarity: validClarity.includes(raw.marketClarity) ? raw.marketClarity : "Partially Defined",
      revenueModelClarity: validRevenue.includes(raw.revenueModelClarity) ? raw.revenueModelClarity : "Emerging",
      competitionDensity: validCompetition.includes(raw.competitionDensity) ? raw.competitionDensity : "Moderate",
      differentiationStrength: validDiff.includes(raw.differentiationStrength) ? raw.differentiationStrength : "Moderate",
      goToMarketComplexity: validComplexity.includes(raw.goToMarketComplexity) ? raw.goToMarketComplexity : "Moderate",
      keyCommercialRisks: Array.isArray(raw.keyCommercialRisks)
        ? raw.keyCommercialRisks.filter((r: any) => typeof r === "string" && r.length > 0).slice(0, 6)
        : [],
    };
  }

  private validateExecutionProfile(raw: any): ExecutionProfile {
    const validTeam: TeamComplexity[] = ["Solo", "Small Team", "Cross-Functional", "Enterprise"];
    const validLikelihood: LikelihoodLevel[] = ["Low", "Moderate", "High"];

    if (!raw || typeof raw !== "object") {
      return {
        teamComplexity: "Solo",
        hiddenWorkLikelihood: "Moderate",
        scalabilityChallenges: [],
        operationalRisks: [],
      };
    }

    return {
      teamComplexity: validTeam.includes(raw.teamComplexity) ? raw.teamComplexity : "Solo",
      hiddenWorkLikelihood: validLikelihood.includes(raw.hiddenWorkLikelihood) ? raw.hiddenWorkLikelihood : "Moderate",
      scalabilityChallenges: Array.isArray(raw.scalabilityChallenges)
        ? raw.scalabilityChallenges.filter((r: any) => typeof r === "string" && r.length > 0).slice(0, 6)
        : [],
      operationalRisks: Array.isArray(raw.operationalRisks)
        ? raw.operationalRisks.filter((r: any) => typeof r === "string" && r.length > 0).slice(0, 6)
        : [],
    };
  }

  private validateViabilityAssessment(raw: any): ViabilityAssessment {
    const validBands: ViabilityBand[] = ["Strong", "Moderate", "Weak", "Critical Risk"];

    if (!raw || typeof raw !== "object") {
      return {
        overallViability: "Moderate",
        confidenceScore: 50,
        rationale: "Insufficient data for detailed viability assessment.",
      };
    }

    return {
      overallViability: validBands.includes(raw.overallViability) ? raw.overallViability : "Moderate",
      confidenceScore: Math.max(0, Math.min(100, Number(raw.confidenceScore) || 50)),
      rationale: String(raw.rationale || "No rationale provided."),
    };
  }

  private buildConfidenceAssessment(
    consensus: AIConsensusResult,
    feasibility: IdeaFeasibility,
    strengths: IdeaStrength[],
    weaknesses: IdeaWeakness[],
    assumptions: AssumptionDependency[]
  ): ConfidenceAssessment {
    const keyFactors: string[] = [];
    const limitations: string[] = [];

    if (strengths.length > 0) {
      keyFactors.push(...strengths.slice(0, 2).map(s => s.title));
    }
    if (consensus.agreementScore > 0.7) {
      keyFactors.push("High agreement across AI providers on core assessment");
    }
    if (consensus.providerResponses.length >= 2) {
      keyFactors.push(`Analysis corroborated by ${consensus.providerResponses.length} independent providers`);
    }

    const unvalidated = assumptions.filter(a => a.status === "unvalidated");
    const risky = assumptions.filter(a => a.status === "risky");
    if (unvalidated.length > 0) {
      limitations.push(`${unvalidated.length} assumption(s) remain unvalidated`);
    }
    if (risky.length > 0) {
      limitations.push(`${risky.length} assumption(s) flagged as risky`);
    }
    if (weaknesses.filter(w => w.severity === "high").length > 0) {
      limitations.push("High-severity weaknesses identified");
    }

    let score = 50;
    score += keyFactors.length * 7;
    score -= limitations.length * 5;
    score += (consensus.confidence - 0.5) * 30;
    score = Math.max(15, Math.min(85, score));

    let rationale = `Score of ${Math.round(score)} reflects `;
    if (score >= 65) {
      rationale += "sufficient information to assess feasibility, though key assumptions remain unvalidated. ";
    } else if (score >= 40) {
      rationale += "incomplete information with significant unknowns affecting reliability. ";
    } else {
      rationale += "insufficient information to provide reliable assessment. ";
    }
    rationale += `Based on ${keyFactors.length} positive factors against ${limitations.length} limitations.`;

    return {
      score: Math.round(score),
      rationale,
      keyFactors,
      limitations,
    };
  }

  private buildFailureNarrative(
    aiNarrative: string,
    riskDrivers: RiskDriver[],
    input: IdeaInput
  ): FailureModeNarrative {
    const topRisk = riskDrivers[0];
    let narrative: string;

    if (aiNarrative && aiNarrative.length > 50) {
      narrative = aiNarrative;
    } else if (topRisk) {
      narrative = `This idea is most likely to fail by: ${topRisk.failureTrigger}. ` +
        `${topRisk.whyItMatters}`;
    } else {
      narrative = `"${input.title}" faces typical early-stage risks. The primary failure mode ` +
        `would be investing significant time before validating core assumptions.`;
    }

    const preventionHint = topRisk?.isControllable
      ? `Prevention: ${topRisk.controllabilityNote}`
      : topRisk
        ? `Mitigation: Focus on speed to market and rapid iteration.`
        : "Prevention: Validate core assumptions before investing significant build time.";

    return {
      title: "How This Idea Is Most Likely to Fail",
      narrative,
      likelihood: riskDrivers.filter(r => !r.isControllable).length >= 2 ? "high" : "medium",
      preventionHint,
    };
  }

  private computeWeightedScore(
    viability: ViabilityAssessment,
    technical: TechnicalProfile,
    commercial: CommercialProfile,
    execution: ExecutionProfile,
    feasibility: IdeaFeasibility
  ): number {
    const viabilityScore = viability.confidenceScore;

    const complexityScores: Record<ComplexityLevel, number> = { "Low": 90, "Moderate": 65, "High": 40, "Very High": 20 };
    const dataScores: Record<DataComplexity, number> = { "Simple": 90, "Structured": 70, "Complex": 45, "Highly Regulated": 20 };
    const techScore = Math.round(
      (complexityScores[technical.architectureComplexity] * 0.3) +
      (complexityScores[technical.integrationDifficulty] * 0.25) +
      (dataScores[technical.dataComplexity] * 0.25) +
      (feasibility.technical.score * 0.2)
    );

    const clarityScores: Record<ClarityLevel, number> = { "Defined": 90, "Partially Defined": 55, "Unclear": 20 };
    const revenueScores: Record<RevenueModelClarity, number> = { "Clear": 90, "Emerging": 55, "Unclear": 20 };
    const diffScores: Record<DifferentiationStrength, number> = { "Strong": 90, "Moderate": 55, "Weak": 20 };
    const commercialScore = Math.round(
      (clarityScores[commercial.marketClarity] * 0.3) +
      (revenueScores[commercial.revenueModelClarity] * 0.25) +
      (diffScores[commercial.differentiationStrength] * 0.25) +
      (feasibility.market.score * 0.2)
    );

    const teamScores: Record<TeamComplexity, number> = { "Solo": 80, "Small Team": 65, "Cross-Functional": 45, "Enterprise": 25 };
    const hiddenWorkScores: Record<LikelihoodLevel, number> = { "Low": 90, "Moderate": 55, "High": 20 };
    const execScore = Math.round(
      (teamScores[execution.teamComplexity] * 0.4) +
      (hiddenWorkScores[execution.hiddenWorkLikelihood] * 0.3) +
      (feasibility.timeline.score * 0.3)
    );

    const weighted = Math.round(
      (viabilityScore * 0.40) +
      (techScore * 0.25) +
      (commercialScore * 0.20) +
      (execScore * 0.15)
    );

    return Math.max(0, Math.min(100, weighted));
  }

  private determineRecommendation(
    overallScore: number,
    riskDrivers: RiskDriver[],
    assumptions: AssumptionDependency[],
    scopeWarnings: ScopeWarning[],
    technical?: TechnicalProfile,
    commercial?: CommercialProfile,
    execution?: ExecutionProfile
  ): { recommendation: "proceed" | "revise" | "stop"; rationale: string } {
    const uncontrollableRisks = riskDrivers.filter(r => !r.isControllable).length;
    const riskyAssumptions = assumptions.filter(a => a.status === "risky").length;
    const highScopeRisk = scopeWarnings.filter(w => w.underestimationRisk === "high").length;

    if (technical && execution) {
      if (technical.complianceExposure === "High" && execution.teamComplexity === "Solo") {
        return {
          recommendation: "stop",
          rationale: `High compliance exposure combined with solo execution is a critical risk combination. ` +
            `Regulated domains require dedicated legal/compliance expertise that a solo builder cannot sustain.`,
        };
      }
      if (technical.estimatedMvpEffortWeeks > 24 && execution.teamComplexity === "Solo") {
        return {
          recommendation: "revise",
          rationale: `Estimated MVP effort of ${technical.estimatedMvpEffortWeeks} weeks exceeds the 24-week threshold for a solo builder. ` +
            `Reduce scope aggressively to a core feature set achievable in under 12 weeks, or expand the team.`,
        };
      }
    }

    if (commercial) {
      if (commercial.differentiationStrength === "Weak" && commercial.competitionDensity === "High") {
        return {
          recommendation: "revise",
          rationale: `Weak differentiation in a highly competitive market signals a positioning problem. ` +
            `Identify a specific niche or unique angle before investing in development.`,
        };
      }
    }

    if (overallScore < 30) {
      return {
        recommendation: "stop",
        rationale: `Score of ${overallScore} indicates fundamental viability concerns. ` +
          `${riskyAssumptions} assumptions are flagged as risky. ` +
          `Recommend pivoting to a different approach or idea.`,
      };
    }

    if (uncontrollableRisks >= 3) {
      return {
        recommendation: "stop",
        rationale: `${uncontrollableRisks} uncontrollable risk factors exceed acceptable threshold. ` +
          `Success depends too heavily on external factors outside your influence.`,
      };
    }

    if (overallScore < 60 || riskyAssumptions >= 3 || highScopeRisk >= 2) {
      return {
        recommendation: "revise",
        rationale: `Analysis identified ${riskyAssumptions} risky assumptions and ${highScopeRisk} high-risk ` +
          `scope areas. Before proceeding: validate core assumptions, ` +
          `reduce scope aggressively, and address the top risk driver.`,
      };
    }

    return {
      recommendation: "proceed",
      rationale: `Score of ${overallScore} suggests viability, but ${assumptions.filter(a => a.status === "unvalidated").length} ` +
        `assumptions remain unvalidated. Proceed with caution: prioritize assumption validation ` +
        `in parallel with early development. Build the smallest possible version first.`,
    };
  }

  private async saveAsArtifact(analysis: IdeaAnalysis, stopAcknowledged = false) {
    const sections = [
      {
        heading: "Decision",
        level: 2 as const,
        content: `**Recommendation:** ${analysis.recommendation.toUpperCase()}\n\n${analysis.recommendationRationale}`,
      },
      {
        heading: "Executive Summary",
        level: 2 as const,
        content: analysis.summary,
      },
      {
        heading: "Idea Overview",
        level: 2 as const,
        content: `**Title:** ${analysis.input.title}\n\n**Description:** ${analysis.input.description}\n\n` +
          `**Purpose:** ${PURPOSE_LABELS[analysis.input.purpose || "commercial"] || "Not specified"}\n\n` +
          `**Overall Score:** ${analysis.overallScore}/100`,
      },
      {
        heading: "Confidence Assessment",
        level: 2 as const,
        content: `**Score:** ${analysis.confidenceAssessment.score}/100\n\n` +
          `**Rationale:** ${analysis.confidenceAssessment.rationale}\n\n` +
          `### Key Factors\n${analysis.confidenceAssessment.keyFactors.map(f => `- ${f}`).join("\n")}\n\n` +
          `### Analysis Limitations\n${analysis.confidenceAssessment.limitations.map(l => `- ${l}`).join("\n")}`,
      },
      {
        heading: "Primary Risk Drivers (Ranked)",
        level: 2 as const,
        content: analysis.primaryRiskDrivers.length > 0
          ? analysis.primaryRiskDrivers
              .map(r => `### ${r.rank}. ${r.title}\n` +
                `**Why it matters:** ${r.whyItMatters}\n\n` +
                `**Failure trigger:** ${r.failureTrigger}\n\n` +
                `**Controllable:** ${r.isControllable ? "Yes" : "No"} — ${r.controllabilityNote}`)
              .join("\n\n---\n\n")
          : "No specific risk drivers identified.",
      },
      {
        heading: "How This Idea Is Most Likely to Fail",
        level: 2 as const,
        content: `**Likelihood:** ${analysis.failureModeNarrative.likelihood.toUpperCase()}\n\n` +
          `${analysis.failureModeNarrative.narrative}\n\n` +
          `**${analysis.failureModeNarrative.preventionHint}**`,
      },
      {
        heading: "Assumption Dependencies",
        level: 2 as const,
        content: this.formatAssumptionDependencies(analysis.assumptionDependencies),
      },
      {
        heading: "Scope & Complexity Warnings",
        level: 2 as const,
        content: analysis.scopeWarnings.length > 0
          ? analysis.scopeWarnings
              .map(w => `### ${w.area.charAt(0).toUpperCase() + w.area.slice(1)} (${w.underestimationRisk} underestimation risk)\n` +
                `**Warning:** ${w.warning}\n\n` +
                `**Hidden complexity:** ${w.hiddenComplexity}`)
              .join("\n\n")
          : "No specific scope warnings identified.",
      },
      {
        heading: "Technical Profile",
        level: 2 as const,
        content: `| Dimension | Assessment |\n|-----------|------------|\n` +
          `| Architecture Complexity | ${analysis.technicalProfile.architectureComplexity} |\n` +
          `| Integration Difficulty | ${analysis.technicalProfile.integrationDifficulty} |\n` +
          `| Data Complexity | ${analysis.technicalProfile.dataComplexity} |\n` +
          `| Compliance Exposure | ${analysis.technicalProfile.complianceExposure} |\n` +
          `| Estimated MVP Effort | ${analysis.technicalProfile.estimatedMvpEffortWeeks} weeks |\n\n` +
          (analysis.technicalProfile.keyTechnicalRisks.length > 0
            ? `### Key Technical Risks\n${analysis.technicalProfile.keyTechnicalRisks.map(r => `- ${r}`).join("\n")}`
            : "No specific technical risks identified."),
      },
      {
        heading: "Commercial Profile",
        level: 2 as const,
        content: `| Dimension | Assessment |\n|-----------|------------|\n` +
          `| Market Clarity | ${analysis.commercialProfile.marketClarity} |\n` +
          `| Revenue Model Clarity | ${analysis.commercialProfile.revenueModelClarity} |\n` +
          `| Competition Density | ${analysis.commercialProfile.competitionDensity} |\n` +
          `| Differentiation Strength | ${analysis.commercialProfile.differentiationStrength} |\n` +
          `| Go-to-Market Complexity | ${analysis.commercialProfile.goToMarketComplexity} |\n\n` +
          (analysis.commercialProfile.keyCommercialRisks.length > 0
            ? `### Key Commercial Risks\n${analysis.commercialProfile.keyCommercialRisks.map(r => `- ${r}`).join("\n")}`
            : "No specific commercial risks identified."),
      },
      {
        heading: "Execution Profile",
        level: 2 as const,
        content: `| Dimension | Assessment |\n|-----------|------------|\n` +
          `| Team Complexity | ${analysis.executionProfile.teamComplexity} |\n` +
          `| Hidden Work Likelihood | ${analysis.executionProfile.hiddenWorkLikelihood} |\n\n` +
          (analysis.executionProfile.scalabilityChallenges.length > 0
            ? `### Scalability Challenges\n${analysis.executionProfile.scalabilityChallenges.map(c => `- ${c}`).join("\n")}\n\n`
            : "") +
          (analysis.executionProfile.operationalRisks.length > 0
            ? `### Operational Risks\n${analysis.executionProfile.operationalRisks.map(r => `- ${r}`).join("\n")}`
            : ""),
      },
      {
        heading: "Viability Assessment",
        level: 2 as const,
        content: `**Overall Viability:** ${analysis.viabilityAssessment.overallViability}\n\n` +
          `**Confidence Score:** ${analysis.viabilityAssessment.confidenceScore}/100\n\n` +
          `**Rationale:** ${analysis.viabilityAssessment.rationale}`,
      },
      {
        heading: "Strengths",
        level: 2 as const,
        content: analysis.strengths
          .map((s) => `### ${s.title}\n${s.description}\n*Confidence: ${(s.confidence * 100).toFixed(0)}%*`)
          .join("\n\n"),
      },
      {
        heading: "Weaknesses",
        level: 2 as const,
        content: analysis.weaknesses
          .map((w) => `### ${w.title} (${w.severity})\n${w.description}\n${w.mitigation ? `\n**Mitigation:** ${w.mitigation}` : ""}`)
          .join("\n\n"),
      },
      {
        heading: "Feasibility Assessment",
        level: 2 as const,
        content: `**Overall Feasibility:** ${analysis.feasibility.score}/100\n\n` +
          `| Dimension | Score | Notes |\n|-----------|-------|-------|\n` +
          `| Technical | ${analysis.feasibility.technical.score} | ${analysis.feasibility.technical.notes} |\n` +
          `| Market | ${analysis.feasibility.market.score} | ${analysis.feasibility.market.notes} |\n` +
          `| Financial | ${analysis.feasibility.financial.score} | ${analysis.feasibility.financial.notes} |\n` +
          `| Timeline | ${analysis.feasibility.timeline.score} | ${analysis.feasibility.timeline.notes} |`,
      },
      {
        heading: "Risk Flags",
        level: 2 as const,
        content: analysis.risks
          .map((r) => `### ${r.category.charAt(0).toUpperCase() + r.category.slice(1)} Risk (${r.severity})\n${r.description}\n${r.recommendation ? `\n**Recommendation:** ${r.recommendation}` : ""}`)
          .join("\n\n"),
      },
      {
        heading: "Next Steps",
        level: 2 as const,
        content: analysis.nextSteps
          .map((s) => `${s.priority}. **${s.action}** (${s.effort} effort)\n   ${s.description}`)
          .join("\n\n"),
      },
      {
        heading: "Requirements Module Input",
        level: 2 as const,
        content: `This analysis is ready for the Requirements Module.\n\n**Artifact ID:** \`${analysis.id}\`\n**Module:** ideas\n**Status:** Ready for requirements gathering`,
      },
    ];

    const stage: PipelineStage = "VALIDATED_IDEA";

    const aiNotes = [
      {
        provider: "system" as const,
        note: `Analysis: ${analysis.recommendation.toUpperCase()}. Score: ${analysis.overallScore}/100. Confidence: ${analysis.confidenceAssessment.score}/100.`,
        confidence: analysis.consensusConfidence,
      },
    ];

    if (stopAcknowledged) {
      aiNotes.push({
        provider: "system" as const,
        note: `STOP RECOMMENDATION ACKNOWLEDGED: User explicitly acknowledged the STOP recommendation and chose to proceed at ${new Date().toISOString()}.`,
        confidence: 1.0,
      });
    }

    const artifact = await artifactService.create({
      title: `Ideas Reference: ${analysis.input.title}`,
      module: "ideas",
      sections,
      aiNotes,
      tags: stopAcknowledged
        ? ["idea", "analysis", analysis.recommendation, "stop-acknowledged", "requirements-ready"]
        : ["idea", "analysis", analysis.recommendation, "requirements-ready"],
      stage,
      projectId: analysis.projectId,
      authorId: analysis.authorId,
      stopAcknowledged: stopAcknowledged || undefined,
      stopAcknowledgedAt: stopAcknowledged ? new Date().toISOString() : undefined,
    });

    return artifact;
  }

  private formatAssumptionDependencies(assumptions: AssumptionDependency[]): string {
    const validated = assumptions.filter(a => a.status === "validated");
    const unvalidated = assumptions.filter(a => a.status === "unvalidated");
    const risky = assumptions.filter(a => a.status === "risky");

    let content = "";

    if (risky.length > 0) {
      content += `### Risky Assumptions (${risky.length})\n`;
      content += risky.map(a =>
        `- **${a.assumption}**\n  - Risk if wrong: ${a.riskIfWrong || "Unknown"}`
      ).join("\n") + "\n\n";
    }

    if (unvalidated.length > 0) {
      content += `### Unvalidated Assumptions (${unvalidated.length})\n`;
      content += unvalidated.map(a =>
        `- **${a.assumption}**\n  - Validation method: ${a.validationMethod || "TBD"}\n  - Risk if wrong: ${a.riskIfWrong || "Unknown"}`
      ).join("\n") + "\n\n";
    }

    if (validated.length > 0) {
      content += `### Validated Assumptions (${validated.length})\n`;
      content += validated.map(a =>
        `- **${a.assumption}**${a.evidence ? `\n  - Evidence: ${a.evidence}` : ""}`
      ).join("\n") + "\n\n";
    }

    if (content === "") {
      content = "No specific assumptions identified.";
    }

    return content;
  }
}

export const ideasService = new IdeasService();
