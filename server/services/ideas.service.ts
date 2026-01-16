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
} from "@shared/types/ideas";
import { consensusService } from "./ai";
import { artifactService } from "./artifact.service";
import type { AIConsensusResult } from "@shared/types/ai";
import type { PipelineStage } from "@shared/types/pipeline";
import type { UsageModule } from "@shared/schema";

/**
 * Ideas Service
 * 
 * Processes idea submissions through AI consensus and generates structured analysis.
 */
export class IdeasService {
  /**
   * Analyze an idea using AI consensus (without saving)
   * Returns analysis results for user review before acceptance
   */
  async analyzeIdea(input: IdeaInput, projectId?: string, userId?: string): Promise<IdeaAnalysis> {
    // Build prompt for AI analysis
    const prompt = this.buildAnalysisPrompt(input);

    // Build usage context if projectId is provided
    const usageContext = projectId
      ? { projectId, module: "ideas" as UsageModule, userId }
      : undefined;
    
    // Get consensus from all providers
    const consensus = await consensusService.getConsensus({
      prompt: {
        system: this.getSystemPrompt(),
        user: prompt,
        context: JSON.stringify(input.context || {}),
      },
    }, usageContext);
    
    // Parse consensus into structured analysis
    const analysis = this.parseConsensusToAnalysis(input, consensus);
    
    // NOTE: Do NOT save as artifact here - user must explicitly accept
    return analysis;
  }

  /**
   * Accept a validated idea and save as artifact
   * This is the conscious decision point for the user
   * @param stopAcknowledged - If true, user explicitly acknowledged STOP recommendation
   */
  async acceptIdea(analysis: IdeaAnalysis, stopAcknowledged = false): Promise<IdeaAnalysis> {
    // Save as artifact only when user explicitly accepts
    const artifact = await this.saveAsArtifact(analysis, stopAcknowledged);
    analysis.artifactId = artifact.metadata.id;
    
    return analysis;
  }
  
  /**
   * Build the analysis prompt from idea input
   */
  private buildAnalysisPrompt(input: IdeaInput): string {
    let prompt = `Analyze the following app/platform idea:\n\n`;
    prompt += `**Title:** ${input.title}\n\n`;
    prompt += `**Description:** ${input.description}\n\n`;
    
    if (input.context) {
      prompt += `**Context:**\n`;
      if (input.context.targetMarket) {
        prompt += `- Target Market: ${input.context.targetMarket}\n`;
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
        prompt += `- Known Competitors: ${input.context.competitors}\n`;
      }
      
      if (input.context.workshopRefinement) {
        prompt += `\n${input.context.workshopRefinement}\n`;
      }
    }
    
    prompt += `\nProvide a comprehensive analysis including:\n`;
    prompt += `1. Key strengths of this idea\n`;
    prompt += `2. Potential weaknesses or concerns\n`;
    prompt += `3. Feasibility assessment (technical, market, financial, timeline)\n`;
    prompt += `4. Risk flags to consider\n`;
    prompt += `5. Recommended next steps\n`;
    
    if (input.context?.workshopRefinement) {
      prompt += `\nIMPORTANT: The user completed a Guided Refinement Workshop. You MUST factor the workshop findings into your analysis. Do NOT ignore the evidence provided. Adjust scores and severity levels based on the validated assumptions and reduced uncertainties.\n`;
    }
    
    return prompt;
  }
  
  /**
   * Get the system prompt for idea analysis
   * Enhanced for signal sharpening - reduces encouragement bias
   */
  private getSystemPrompt(): string {
    return `You are a critical-minded startup advisor and product strategist. Your job is to prevent bad ideas from becoming expensive builds.

CORE MANDATE:
- Be direct and specific, not diplomatic
- Identify reasons this idea could FAIL, not just succeed
- Call out hidden complexity and scope underestimation
- Flag unvalidated assumptions explicitly
- Reduce false positives - it's better to caution a good idea than to encourage a bad one

ANALYSIS PRINCIPLES:
1. Assume constraints are tighter than stated
2. Assume timelines will be longer than planned
3. Assume technical complexity is underestimated
4. Assume market assumptions are unvalidated

OUTPUT REQUIREMENTS:
- No encouragement language ("great idea", "promising", "exciting")
- Every positive must be balanced with a specific risk
- Confidence scores must be justified with specific evidence
- Failure modes must be specific to THIS idea, not generic

The user should be able to decide: Proceed, Revise, or Stop based on your analysis alone.`;
  }
  
  /**
   * Parse AI consensus into structured analysis
   * Enhanced with signal sharpening for decisive outputs
   */
  private parseConsensusToAnalysis(
    input: IdeaInput,
    consensus: AIConsensusResult
  ): IdeaAnalysis {
    const id = randomUUID();
    
    // Generate mock structured analysis based on consensus
    const strengths = this.generateStrengths(input, consensus);
    const weaknesses = this.generateWeaknesses(input, consensus);
    const feasibility = this.generateFeasibility(input, consensus);
    const risks = this.generateRisks(input, consensus);
    const nextSteps = this.generateNextSteps(input, consensus);
    
    // Signal Sharpening: Generate enhanced assessment fields
    const confidenceAssessment = this.generateConfidenceAssessment(input, consensus, feasibility);
    const primaryRiskDrivers = this.generatePrimaryRiskDrivers(input, consensus);
    const scopeWarnings = this.generateScopeWarnings(input);
    const assumptionDependencies = this.generateAssumptionDependencies(input);
    const failureModeNarrative = this.generateFailureModeNarrative(input, primaryRiskDrivers);
    
    // Calculate overall score with stricter criteria
    const highRiskCount = primaryRiskDrivers.filter(r => !r.isControllable).length;
    const unvalidatedAssumptions = assumptionDependencies.filter(a => a.status === "unvalidated" || a.status === "risky").length;
    
    const overallScore = Math.round(
      (feasibility.score * 0.3) +
      (confidenceAssessment.score * 0.3) -
      (highRiskCount * 12) -
      (unvalidatedAssumptions * 5) -
      (scopeWarnings.filter(w => w.underestimationRisk === "high").length * 8)
    );
    
    // Determine recommendation based on signals
    const { recommendation, rationale } = this.determineRecommendation(
      overallScore,
      primaryRiskDrivers,
      assumptionDependencies,
      scopeWarnings
    );
    
    return {
      id,
      input,
      strengths,
      weaknesses,
      feasibility,
      risks,
      nextSteps,
      summary: this.generateSummary(input, consensus, overallScore),
      overallScore: Math.max(0, Math.min(100, overallScore)),
      consensusConfidence: consensus.confidence,
      providerAgreement: consensus.agreementScore,
      createdAt: new Date().toISOString(),
      // Signal Sharpening fields
      confidenceAssessment,
      primaryRiskDrivers,
      scopeWarnings,
      assumptionDependencies,
      failureModeNarrative,
      recommendation,
      recommendationRationale: rationale,
    };
  }
  
  /**
   * Generate strengths from consensus
   */
  private generateStrengths(input: IdeaInput, consensus: AIConsensusResult): IdeaStrength[] {
    const strengths: IdeaStrength[] = [];
    
    // Mock strengths based on input characteristics
    if (input.description.length > 100) {
      strengths.push({
        title: "Clear Vision",
        description: "The idea has a well-articulated description that demonstrates thorough thinking.",
        confidence: 0.85,
      });
    }
    
    if (input.context?.targetMarket) {
      strengths.push({
        title: "Defined Target Market",
        description: `Clear target market identified: ${input.context.targetMarket}. This focus enables targeted development and marketing.`,
        confidence: 0.9,
      });
    }
    
    if (input.context?.skills && input.context.skills.length > 0) {
      strengths.push({
        title: "Available Expertise",
        description: `Team has relevant skills (${input.context.skills.join(", ")}) that can accelerate development.`,
        confidence: 0.88,
      });
    }
    
    strengths.push({
      title: "Innovation Potential",
      description: "The concept shows potential for differentiation in the market.",
      confidence: consensus.confidence,
    });
    
    return strengths;
  }
  
  /**
   * Generate weaknesses from consensus
   */
  private generateWeaknesses(input: IdeaInput, consensus: AIConsensusResult): IdeaWeakness[] {
    const weaknesses: IdeaWeakness[] = [];
    
    if (!input.context?.targetMarket) {
      weaknesses.push({
        title: "Undefined Target Market",
        description: "No specific target market defined, which may lead to unfocused development.",
        severity: "medium",
        mitigation: "Conduct market research to identify and validate target segments.",
      });
    }
    
    if (!input.context?.budget || input.context.budget === "low") {
      weaknesses.push({
        title: "Resource Constraints",
        description: "Limited budget may restrict development scope and timeline.",
        severity: input.context?.budget === "low" ? "high" : "medium",
        mitigation: "Consider MVP approach and phased development to manage costs.",
      });
    }
    
    if (input.context?.competitors) {
      weaknesses.push({
        title: "Competitive Landscape",
        description: `Existing competitors (${input.context.competitors}) present market challenges.`,
        severity: "medium",
        mitigation: "Develop clear differentiation strategy and unique value proposition.",
      });
    }
    
    // Add consensus-based weakness if disagreement exists
    if (consensus.disagreements.length > 0) {
      weaknesses.push({
        title: "Strategic Uncertainty",
        description: "Analysis revealed some uncertainty in approach, suggesting further validation needed.",
        severity: "low",
        mitigation: "Conduct additional research in areas of uncertainty.",
      });
    }
    
    return weaknesses;
  }
  
  /**
   * Generate feasibility assessment
   */
  private generateFeasibility(input: IdeaInput, consensus: AIConsensusResult): IdeaFeasibility {
    const baseScore = consensus.confidence * 100;
    
    const technical = {
      score: Math.round(baseScore * (input.context?.skills?.length ? 1.1 : 0.8)),
      notes: input.context?.skills?.length
        ? "Available skills align with technical requirements."
        : "Technical feasibility depends on team capabilities.",
    };
    
    const market = {
      score: Math.round(baseScore * (input.context?.targetMarket ? 1.05 : 0.75)),
      notes: input.context?.targetMarket
        ? "Target market is defined, enabling focused validation."
        : "Market validation needed to assess demand.",
    };
    
    const budgetMultiplier = {
      low: 0.6,
      medium: 0.85,
      high: 1.0,
      enterprise: 1.1,
    };
    
    const financial = {
      score: Math.round(baseScore * (budgetMultiplier[input.context?.budget || "medium"])),
      notes: input.context?.budget === "low"
        ? "Limited budget requires careful prioritization."
        : "Budget appears adequate for initial development.",
    };
    
    const timeline = {
      score: Math.round(baseScore * 0.9),
      notes: input.context?.timeline
        ? `Timeline of ${input.context.timeline} noted for planning.`
        : "Timeline estimation requires further scoping.",
    };
    
    return {
      score: Math.round((technical.score + market.score + financial.score + timeline.score) / 4),
      technical,
      market,
      financial,
      timeline,
    };
  }
  
  /**
   * Generate risk flags
   */
  private generateRisks(input: IdeaInput, consensus: AIConsensusResult): IdeaRisk[] {
    const risks: IdeaRisk[] = [];
    
    // Market risk
    if (!input.context?.targetMarket) {
      risks.push({
        category: "market",
        description: "Product-market fit unvalidated without defined target audience.",
        severity: "high",
        recommendation: "Conduct customer discovery interviews before development.",
      });
    }
    
    // Competitive risk
    if (input.context?.competitors) {
      risks.push({
        category: "competitive",
        description: "Established competitors may have market advantages.",
        severity: "medium",
        recommendation: "Analyze competitor weaknesses and identify underserved niches.",
      });
    }
    
    // Technical risk
    if (!input.context?.skills || input.context.skills.length === 0) {
      risks.push({
        category: "technical",
        description: "Team skill gaps may impact development timeline.",
        severity: "medium",
        recommendation: "Identify key technical requirements and assess build vs. buy options.",
      });
    }
    
    // Financial risk
    if (input.context?.budget === "low") {
      risks.push({
        category: "financial",
        description: "Budget constraints may force difficult tradeoffs.",
        severity: "high",
        recommendation: "Prioritize ruthlessly and consider revenue-generating features first.",
      });
    }
    
    // Execution risk
    risks.push({
      category: "execution",
      description: "Scope creep and timeline slippage are common challenges.",
      severity: "low",
      recommendation: "Use agile methodology with clear milestones and regular reviews.",
    });
    
    return risks;
  }
  
  /**
   * Generate next step recommendations
   */
  private generateNextSteps(input: IdeaInput, consensus: AIConsensusResult): IdeaNextStep[] {
    const steps: IdeaNextStep[] = [];
    let priority = 1;
    
    // Always recommend validation first
    steps.push({
      priority: priority++,
      action: "Validate the Problem",
      description: "Interview 10-15 potential users to confirm the problem exists and understand their current solutions.",
      effort: "medium",
    });
    
    if (!input.context?.targetMarket) {
      steps.push({
        priority: priority++,
        action: "Define Target Market",
        description: "Create detailed user personas and identify your ideal customer profile.",
        effort: "low",
      });
    }
    
    if (input.context?.competitors) {
      steps.push({
        priority: priority++,
        action: "Competitive Analysis",
        description: "Deep-dive into competitor offerings to identify differentiation opportunities.",
        effort: "medium",
      });
    }
    
    steps.push({
      priority: priority++,
      action: "Create Requirements Document",
      description: "Document core features, user stories, and acceptance criteria for MVP.",
      effort: "medium",
    });
    
    steps.push({
      priority: priority++,
      action: "Build Prototype",
      description: "Create a low-fidelity prototype to test core user flows.",
      effort: "high",
    });
    
    return steps;
  }
  
  /**
   * Generate summary text (enhanced - no encouragement language)
   */
  private generateSummary(
    input: IdeaInput,
    consensus: AIConsensusResult,
    overallScore: number
  ): string {
    let assessment: string;
    if (overallScore >= 70) {
      assessment = "Analysis indicates viability pending assumption validation.";
    } else if (overallScore >= 45) {
      assessment = "Analysis reveals significant gaps requiring resolution before proceeding.";
    } else {
      assessment = "Analysis suggests fundamental issues that question viability.";
    }
    
    return `"${input.title}" scored ${overallScore}/100. ${assessment} ` +
      `Confidence: ${(consensus.confidence * 100).toFixed(0)}% across ${consensus.providerResponses.length} providers ` +
      `(${(consensus.agreementScore * 100).toFixed(0)}% agreement). See risk drivers and failure modes below.`;
  }

  // ===============================================
  // SIGNAL SHARPENING METHODS (Step 6)
  // ===============================================

  /**
   * Generate confidence assessment with clear rationale
   */
  private generateConfidenceAssessment(
    input: IdeaInput,
    consensus: AIConsensusResult,
    feasibility: IdeaFeasibility
  ): ConfidenceAssessment {
    const keyFactors: string[] = [];
    const limitations: string[] = [];
    
    // Positive factors
    if (input.description.length > 150) {
      keyFactors.push("Detailed description suggests clear thinking about the problem");
    }
    if (input.context?.targetMarket) {
      keyFactors.push(`Target market defined: ${input.context.targetMarket}`);
    }
    if (input.context?.skills && input.context.skills.length >= 2) {
      keyFactors.push("Multiple relevant skills available for execution");
    }
    if (consensus.agreementScore > 0.7) {
      keyFactors.push("High agreement across AI providers on core assessment");
    }
    
    // Limitations (what we couldn't assess)
    limitations.push("Market demand not validated with real users");
    limitations.push("Competitor analysis based on stated information only");
    if (!input.context?.budget) {
      limitations.push("Budget constraints unknown - feasibility uncertain");
    }
    if (!input.context?.timeline) {
      limitations.push("Timeline not specified - cannot assess execution risk");
    }
    limitations.push("Technical complexity estimated without detailed requirements");
    
    // Calculate confidence score
    let score = 50; // Start neutral
    score += keyFactors.length * 8;
    score -= limitations.length * 3;
    score += (consensus.confidence - 0.5) * 30;
    score = Math.max(15, Math.min(85, score)); // Cap between 15-85
    
    // Build rationale
    let rationale = `Score of ${Math.round(score)} reflects `;
    if (score >= 65) {
      rationale += "sufficient information to assess feasibility, though key assumptions remain unvalidated. ";
    } else if (score >= 40) {
      rationale += "incomplete information with significant unknowns affecting reliability. ";
    } else {
      rationale += "insufficient information to provide reliable assessment. ";
    }
    rationale += `Analysis based on ${keyFactors.length} positive factors against ${limitations.length} assessment limitations.`;
    
    return {
      score: Math.round(score),
      rationale,
      keyFactors,
      limitations,
    };
  }

  /**
   * Generate primary risk drivers ranked by impact
   */
  private generatePrimaryRiskDrivers(
    input: IdeaInput,
    consensus: AIConsensusResult
  ): RiskDriver[] {
    const drivers: RiskDriver[] = [];
    let rank = 1;
    
    // Market validation risk (almost always #1)
    if (!input.context?.targetMarket || input.context.targetMarket.length < 20) {
      drivers.push({
        rank: rank++,
        title: "Unvalidated Market Demand",
        whyItMatters: "Building for a market that doesn't exist or doesn't want this solution wastes all invested resources.",
        failureTrigger: "Launch to discover no one is willing to pay, or that the problem isn't painful enough to drive adoption.",
        isControllable: true,
        controllabilityNote: "Controllable through customer discovery before building. Talk to 15+ potential users.",
      });
    }
    
    // Scope creep / complexity risk
    drivers.push({
      rank: rank++,
      title: "Scope Underestimation",
      whyItMatters: "Most ideas are 3-5x more complex than initially perceived, leading to timeline and budget overruns.",
      failureTrigger: "Discovery of 'obvious' features that weren't planned: auth, notifications, admin panels, edge cases.",
      isControllable: true,
      controllabilityNote: "Controllable through ruthless MVP scoping. Cut features aggressively.",
    });
    
    // Competitive risk
    if (input.context?.competitors) {
      drivers.push({
        rank: rank++,
        title: "Competitive Moat Weakness",
        whyItMatters: `Existing players (${input.context.competitors}) have resources, users, and iteration advantage.`,
        failureTrigger: "Competitors copy differentiating features or acquire key distribution channels.",
        isControllable: false,
        controllabilityNote: "Not directly controllable. Requires unique positioning or speed advantage.",
      });
    }
    
    // Resource/execution risk
    if (input.context?.budget === "low" || !input.context?.skills?.length) {
      drivers.push({
        rank: rank++,
        title: "Resource-Ambition Mismatch",
        whyItMatters: "Insufficient resources to reach minimum viability before running out of runway.",
        failureTrigger: "Running out of time/money at 60% completion with no path to revenue.",
        isControllable: true,
        controllabilityNote: "Controllable by reducing scope or increasing resources before starting.",
      });
    }
    
    // Technical risk
    drivers.push({
      rank: rank++,
      title: "Technical Feasibility Unknown",
      whyItMatters: "Core technical assumptions may be wrong, requiring fundamental rearchitecture.",
      failureTrigger: "Discovering a key feature is technically infeasible or requires expertise not available.",
      isControllable: true,
      controllabilityNote: "Controllable through technical spike/prototype before full build.",
    });
    
    return drivers.slice(0, 5); // Top 5 only
  }

  /**
   * Generate scope and complexity warnings
   */
  private generateScopeWarnings(input: IdeaInput): ScopeWarning[] {
    const warnings: ScopeWarning[] = [];
    
    // Technical complexity
    warnings.push({
      area: "technical",
      warning: "Authentication, authorization, and session management add 20-40 hours minimum",
      hiddenComplexity: "Password reset, email verification, OAuth integrations, security headers, rate limiting",
      underestimationRisk: "high",
    });
    
    // UX complexity
    warnings.push({
      area: "ux",
      warning: "Error states, loading states, and edge cases typically double frontend work",
      hiddenComplexity: "Empty states, offline handling, form validation, accessibility, responsive design",
      underestimationRisk: "medium",
    });
    
    // Operations complexity
    warnings.push({
      area: "operations",
      warning: "Production infrastructure requires monitoring, logging, backups, and incident response",
      hiddenComplexity: "Deployment pipelines, database migrations, environment management, secret rotation",
      underestimationRisk: "medium",
    });
    
    // Data complexity
    warnings.push({
      area: "data",
      warning: "Data modeling decisions made early become expensive to change later",
      hiddenComplexity: "Schema migrations, data validation, referential integrity, audit trails, GDPR compliance",
      underestimationRisk: "high",
    });
    
    // Integration complexity (if competitors mentioned, likely needs integrations)
    if (input.context?.competitors) {
      warnings.push({
        area: "integration",
        warning: "Third-party integrations require ongoing maintenance as APIs change",
        hiddenComplexity: "API versioning, rate limits, error handling, authentication tokens, webhook reliability",
        underestimationRisk: "medium",
      });
    }
    
    return warnings;
  }

  /**
   * Generate assumption dependencies with validation status
   */
  private generateAssumptionDependencies(input: IdeaInput): AssumptionDependency[] {
    const assumptions: AssumptionDependency[] = [];
    
    // Core assumption: problem exists
    assumptions.push({
      assumption: "The problem described is painful enough that users will pay/adopt a solution",
      status: "unvalidated",
      validationMethod: "Conduct 15+ customer discovery interviews asking about current workarounds and willingness to pay",
      riskIfWrong: "Complete project failure - building something nobody wants",
    });
    
    // Target market assumption
    if (input.context?.targetMarket) {
      assumptions.push({
        assumption: `"${input.context.targetMarket}" is the right target market for initial launch`,
        status: "unvalidated",
        validationMethod: "Interview representatives from this segment specifically. Validate size and accessibility.",
        riskIfWrong: "Wasted marketing spend and misaligned product features",
      });
    } else {
      assumptions.push({
        assumption: "A viable target market exists and is accessible",
        status: "risky",
        riskIfWrong: "No clear path to first users, acquisition costs may be prohibitive",
      });
    }
    
    // Technical feasibility
    assumptions.push({
      assumption: "The core functionality can be built with available technology and skills",
      status: input.context?.skills?.length ? "unvalidated" : "risky",
      validationMethod: "Build a technical spike proving the hardest technical component",
      riskIfWrong: "Project stalls at technical blocker, requiring pivot or hiring",
    });
    
    // Resource assumption
    assumptions.push({
      assumption: "Available resources (time, money, team) are sufficient to reach MVP",
      status: input.context?.budget && input.context.budget !== "low" ? "unvalidated" : "risky",
      validationMethod: "Create detailed project estimate with 2x buffer. Compare against available resources.",
      riskIfWrong: "Project abandoned at 60% completion with nothing to show",
    });
    
    // Differentiation assumption
    if (input.context?.competitors) {
      assumptions.push({
        assumption: "The proposed differentiation is meaningful to users and defensible",
        status: "risky",
        validationMethod: "Ask potential users to compare your value proposition against existing solutions",
        riskIfWrong: "Users see no reason to switch from existing solutions",
      });
    }
    
    // Revenue model assumption
    assumptions.push({
      assumption: "Users will pay for this solution at a price point that makes the business viable",
      status: "unvalidated",
      validationMethod: "Test pricing in customer interviews. Look for reactions, not just agreement.",
      riskIfWrong: "Product works but cannot sustain itself financially",
    });
    
    return assumptions;
  }

  /**
   * Generate failure mode narrative
   */
  private generateFailureModeNarrative(
    input: IdeaInput,
    riskDrivers: RiskDriver[]
  ): FailureModeNarrative {
    const topRisk = riskDrivers[0];
    const secondRisk = riskDrivers[1];
    
    // Build specific failure narrative based on top risks
    let narrative = `This idea is most likely to fail by: `;
    
    if (topRisk?.title.includes("Market")) {
      narrative += `Building a complete product only to discover the target users don't have the problem, ` +
        `don't prioritize solving it, or won't pay for a solution. `;
      narrative += `The team spends 3-6 months building features based on assumptions, launches to silence, ` +
        `and realizes too late that customer discovery should have come first. `;
    } else if (topRisk?.title.includes("Scope")) {
      narrative += `Underestimating complexity and running out of resources at 60% completion. `;
      narrative += `Initial estimates of "a few weeks" stretch to months as edge cases, authentication, ` +
        `error handling, and "obvious" features are discovered. The team burns out or pivots prematurely. `;
    } else if (topRisk?.title.includes("Competitive")) {
      narrative += `Launching an adequate product into a market where established competitors have ` +
        `distribution, brand recognition, and resources to respond quickly. `;
      narrative += `The product gains minimal traction, and attempts to differentiate are countered ` +
        `by competitors who have faster iteration cycles. `;
    } else {
      narrative += `Encountering a fundamental blocker (technical, market, or resource) that wasn't ` +
        `identified during planning because key assumptions weren't validated upfront. `;
    }
    
    // Add prevention hint
    const preventionHint = topRisk?.isControllable
      ? `Prevention: ${topRisk.controllabilityNote}`
      : `Mitigation: Focus on speed to market and rapid iteration to outpace uncontrollable factors.`;
    
    return {
      title: "How This Idea Is Most Likely to Fail",
      narrative,
      likelihood: riskDrivers.filter(r => !r.isControllable).length >= 2 ? "high" : "medium",
      preventionHint,
    };
  }

  /**
   * Determine recommendation based on signals
   */
  private determineRecommendation(
    overallScore: number,
    riskDrivers: RiskDriver[],
    assumptions: AssumptionDependency[],
    scopeWarnings: ScopeWarning[]
  ): { recommendation: "proceed" | "revise" | "stop"; rationale: string } {
    const uncontrollableRisks = riskDrivers.filter(r => !r.isControllable).length;
    const riskyAssumptions = assumptions.filter(a => a.status === "risky").length;
    const highScopeRisk = scopeWarnings.filter(w => w.underestimationRisk === "high").length;
    
    // STOP conditions
    if (overallScore < 30) {
      return {
        recommendation: "stop",
        rationale: `Score of ${overallScore} indicates fundamental viability concerns. ` +
          `${riskyAssumptions} assumptions are flagged as risky with no clear path to validation. ` +
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
    
    // REVISE conditions
    if (overallScore < 60 || riskyAssumptions >= 3 || highScopeRisk >= 2) {
      return {
        recommendation: "revise",
        rationale: `Analysis identified ${riskyAssumptions} risky assumptions and ${highScopeRisk} high-risk ` +
          `scope areas. Before proceeding: validate core assumptions through customer interviews, ` +
          `reduce scope aggressively, and address the top risk driver.`,
      };
    }
    
    // PROCEED conditions (still with caution)
    return {
      recommendation: "proceed",
      rationale: `Score of ${overallScore} suggests viability, but ${assumptions.filter(a => a.status === "unvalidated").length} ` +
        `assumptions remain unvalidated. Proceed with caution: prioritize assumption validation ` +
        `in parallel with early development. Build the smallest possible version first.`,
    };
  }
  
  /**
   * Save analysis as Markdown artifact
   * Enhanced with signal sharpening sections
   * @param stopAcknowledged - If true, records that user acknowledged STOP recommendation
   */
  private async saveAsArtifact(analysis: IdeaAnalysis, stopAcknowledged = false) {
    const sections = [
      // Decision summary at the top
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
        content: `**Title:** ${analysis.input.title}\n\n**Description:** ${analysis.input.description}\n\n**Overall Score:** ${analysis.overallScore}/100`,
      },
      // Confidence Assessment (Signal Sharpening)
      {
        heading: "Confidence Assessment",
        level: 2 as const,
        content: `**Score:** ${analysis.confidenceAssessment.score}/100\n\n` +
          `**Rationale:** ${analysis.confidenceAssessment.rationale}\n\n` +
          `### Key Factors\n${analysis.confidenceAssessment.keyFactors.map(f => `- ${f}`).join("\n")}\n\n` +
          `### Analysis Limitations\n${analysis.confidenceAssessment.limitations.map(l => `- ${l}`).join("\n")}`,
      },
      // Primary Risk Drivers (Signal Sharpening)
      {
        heading: "Primary Risk Drivers (Ranked)",
        level: 2 as const,
        content: analysis.primaryRiskDrivers
          .map(r => `### ${r.rank}. ${r.title}\n` +
            `**Why it matters:** ${r.whyItMatters}\n\n` +
            `**Failure trigger:** ${r.failureTrigger}\n\n` +
            `**Controllable:** ${r.isControllable ? "Yes" : "No"} — ${r.controllabilityNote}`)
          .join("\n\n---\n\n"),
      },
      // Failure Mode Narrative (Signal Sharpening)
      {
        heading: "How This Idea Is Most Likely to Fail",
        level: 2 as const,
        content: `**Likelihood:** ${analysis.failureModeNarrative.likelihood.toUpperCase()}\n\n` +
          `${analysis.failureModeNarrative.narrative}\n\n` +
          `**${analysis.failureModeNarrative.preventionHint}**`,
      },
      // Assumption Dependencies (Signal Sharpening)
      {
        heading: "Assumption Dependencies",
        level: 2 as const,
        content: this.formatAssumptionDependencies(analysis.assumptionDependencies),
      },
      // Scope Warnings (Signal Sharpening)
      {
        heading: "Scope & Complexity Warnings",
        level: 2 as const,
        content: analysis.scopeWarnings
          .map(w => `### ${w.area.charAt(0).toUpperCase() + w.area.slice(1)} (${w.underestimationRisk} underestimation risk)\n` +
            `**Warning:** ${w.warning}\n\n` +
            `**Hidden complexity:** ${w.hiddenComplexity}`)
          .join("\n\n"),
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
        content: `This analysis is ready for the Requirements Module. Use the artifact ID below to load this idea reference.\n\n**Artifact ID:** \`${analysis.id}\`\n**Module:** ideas\n**Status:** Ready for requirements gathering`,
      },
    ];
    
    const stage: PipelineStage = "VALIDATED_IDEA";
    
    // Build AI notes, include STOP acknowledgement if applicable
    const aiNotes = [
      {
        provider: "system" as const,
        note: `Analysis: ${analysis.recommendation.toUpperCase()}. Score: ${analysis.overallScore}/100. Confidence: ${analysis.confidenceAssessment.score}/100.`,
        confidence: analysis.consensusConfidence,
      },
    ];
    
    // Record STOP acknowledgement in metadata if applicable
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
      // Project isolation (Step 7 - adversarial)
      projectId: analysis.projectId,
      authorId: analysis.authorId,
      // Record STOP acknowledgement in artifact metadata
      stopAcknowledged: stopAcknowledged || undefined,
      stopAcknowledgedAt: stopAcknowledged ? new Date().toISOString() : undefined,
    });
    
    return artifact;
  }

  /**
   * Format assumption dependencies for artifact output
   */
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
        `- **${a.assumption}**\n  - Evidence: ${a.evidence || "Stated"}`
      ).join("\n");
    }
    
    return content || "No assumptions identified.";
  }
}

export const ideasService = new IdeasService();
