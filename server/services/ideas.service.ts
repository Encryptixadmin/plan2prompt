import { randomUUID } from "crypto";
import type {
  IdeaInput,
  IdeaAnalysis,
  IdeaStrength,
  IdeaWeakness,
  IdeaRisk,
  IdeaFeasibility,
  IdeaNextStep,
} from "@shared/types/ideas";
import { consensusService } from "./ai";
import { artifactService } from "./artifact.service";
import type { AIConsensusResult } from "@shared/types/ai";

/**
 * Ideas Service
 * 
 * Processes idea submissions through AI consensus and generates structured analysis.
 */
export class IdeasService {
  /**
   * Analyze an idea using AI consensus
   */
  async analyzeIdea(input: IdeaInput): Promise<IdeaAnalysis> {
    // Build prompt for AI analysis
    const prompt = this.buildAnalysisPrompt(input);
    
    // Get consensus from all providers
    const consensus = await consensusService.getConsensus({
      prompt: {
        system: this.getSystemPrompt(),
        user: prompt,
        context: JSON.stringify(input.context || {}),
      },
    });
    
    // Parse consensus into structured analysis
    const analysis = this.parseConsensusToAnalysis(input, consensus);
    
    // Save as artifact
    const artifact = await this.saveAsArtifact(analysis);
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
    }
    
    prompt += `\nProvide a comprehensive analysis including:\n`;
    prompt += `1. Key strengths of this idea\n`;
    prompt += `2. Potential weaknesses or concerns\n`;
    prompt += `3. Feasibility assessment (technical, market, financial, timeline)\n`;
    prompt += `4. Risk flags to consider\n`;
    prompt += `5. Recommended next steps\n`;
    
    return prompt;
  }
  
  /**
   * Get the system prompt for idea analysis
   */
  private getSystemPrompt(): string {
    return `You are an expert startup advisor and product strategist. Analyze business and app ideas with a balanced perspective, identifying both opportunities and risks. Be constructive but honest about challenges. Focus on actionable insights.`;
  }
  
  /**
   * Parse AI consensus into structured analysis
   */
  private parseConsensusToAnalysis(
    input: IdeaInput,
    consensus: AIConsensusResult
  ): IdeaAnalysis {
    const id = randomUUID();
    
    // Generate mock structured analysis based on consensus
    // In production, this would parse the actual AI response
    const strengths = this.generateStrengths(input, consensus);
    const weaknesses = this.generateWeaknesses(input, consensus);
    const feasibility = this.generateFeasibility(input, consensus);
    const risks = this.generateRisks(input, consensus);
    const nextSteps = this.generateNextSteps(input, consensus);
    
    // Calculate overall score
    const overallScore = Math.round(
      (feasibility.score * 0.4) +
      (strengths.length * 10) -
      (weaknesses.filter(w => w.severity === "high").length * 15) -
      (risks.filter(r => r.severity === "high").length * 10) +
      (consensus.confidence * 20)
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
   * Generate summary text
   */
  private generateSummary(
    input: IdeaInput,
    consensus: AIConsensusResult,
    overallScore: number
  ): string {
    let sentiment: string;
    if (overallScore >= 75) {
      sentiment = "shows strong potential";
    } else if (overallScore >= 50) {
      sentiment = "has merit but requires refinement";
    } else {
      sentiment = "needs significant development before proceeding";
    }
    
    return `"${input.title}" ${sentiment} with an overall score of ${overallScore}/100. ` +
      `Analysis was conducted with ${(consensus.confidence * 100).toFixed(0)}% confidence across ` +
      `${consensus.providerResponses.length} AI providers with ${(consensus.agreementScore * 100).toFixed(0)}% agreement. ` +
      `Key focus areas include validation, market definition, and iterative development.`;
  }
  
  /**
   * Save analysis as Markdown artifact
   */
  private async saveAsArtifact(analysis: IdeaAnalysis) {
    const sections = [
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
    
    const artifact = await artifactService.create({
      title: `Ideas Reference: ${analysis.input.title}`,
      module: "ideas",
      sections,
      aiNotes: [
        {
          provider: "system",
          note: `Analysis generated with ${(analysis.consensusConfidence * 100).toFixed(0)}% consensus confidence from ${3} AI providers.`,
          confidence: analysis.consensusConfidence,
        },
      ],
      tags: ["idea", "analysis", "requirements-ready"],
    });
    
    return artifact;
  }
}

export const ideasService = new IdeasService();
