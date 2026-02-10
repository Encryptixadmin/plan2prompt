import type { IdeaAnalysis, IdeaPurpose } from "@shared/types/ideas";
import { consensusService } from "./ai";
import type { UsageModule } from "@shared/schema";

export interface WorkshopTurn {
  question: string;
  answer: string;
  turnNumber: number;
}

export interface NextQuestionResult {
  question: string;
  turnNumber: number;
  shouldComplete: boolean;
  reasoning: string;
}

const MAX_TURNS = 7;
const MIN_TURNS_BEFORE_COMPLETE = 3;

const PURPOSE_LABELS: Record<string, string> = {
  commercial: "Commercial Product",
  developer_tool: "Developer Tool",
  internal: "Internal/Personal Tool",
  open_source: "Open Source Project",
  learning: "Learning/Experiment",
};

function buildNextQuestionPrompt(
  analysis: IdeaAnalysis,
  conversationHistory: WorkshopTurn[],
  researchBrief?: string
): string {
  const parts: string[] = [];

  parts.push(`You are conducting a structured refinement interview for the following idea.`);
  parts.push(`Your goal is to ask ONE focused follow-up question that will surface the most valuable information the builder hasn't provided yet.`);
  parts.push(``);
  parts.push(`=== IDEA ===`);
  parts.push(`Title: ${analysis.input.title}`);
  parts.push(`Description: ${analysis.input.description}`);
  parts.push(`Project Type: ${PURPOSE_LABELS[analysis.input.purpose || "commercial"]}`);
  parts.push(``);

  parts.push(`=== KEY FINDINGS FROM INITIAL ANALYSIS ===`);
  parts.push(`Overall Score: ${analysis.overallScore}/100`);
  parts.push(`Recommendation: ${analysis.recommendation.toUpperCase()}`);
  parts.push(``);

  if (analysis.primaryRiskDrivers.length > 0) {
    parts.push(`Top Risks:`);
    for (const rd of analysis.primaryRiskDrivers.slice(0, 3)) {
      parts.push(`- ${rd.title} (${rd.isControllable ? "controllable" : "external"})`);
    }
    parts.push(``);
  }

  if (analysis.assumptionDependencies.length > 0) {
    const unvalidated = analysis.assumptionDependencies.filter(a => a.status === "unvalidated" || a.status === "risky");
    if (unvalidated.length > 0) {
      parts.push(`Unvalidated Assumptions:`);
      for (const a of unvalidated.slice(0, 4)) {
        parts.push(`- [${a.status.toUpperCase()}] ${a.assumption}`);
      }
      parts.push(``);
    }
  }

  if (analysis.risks.length > 0) {
    parts.push(`Risk Categories:`);
    for (const r of analysis.risks) {
      parts.push(`- ${r.category} (${r.severity}): ${r.description.substring(0, 120)}`);
    }
    parts.push(``);
  }

  if (analysis.scopeWarnings.length > 0) {
    parts.push(`Scope Warnings:`);
    for (const sw of analysis.scopeWarnings) {
      parts.push(`- ${sw.area}: ${sw.warning.substring(0, 120)}`);
    }
    parts.push(``);
  }

  if (researchBrief) {
    parts.push(`=== DOMAIN RESEARCH BRIEF ===`);
    parts.push(researchBrief.substring(0, 2000));
    parts.push(``);
  }

  if (conversationHistory.length > 0) {
    parts.push(`=== CONVERSATION SO FAR ===`);
    for (const turn of conversationHistory) {
      parts.push(`Q${turn.turnNumber}: ${turn.question}`);
      parts.push(`A${turn.turnNumber}: ${turn.answer}`);
      parts.push(``);
    }
  }

  const turnNumber = conversationHistory.length + 1;
  const canComplete = turnNumber > MIN_TURNS_BEFORE_COMPLETE;
  const mustComplete = turnNumber >= MAX_TURNS;

  parts.push(`=== YOUR TASK ===`);
  parts.push(`Turn ${turnNumber} of ${MAX_TURNS} maximum.`);
  parts.push(``);

  if (mustComplete) {
    parts.push(`This is the FINAL turn. You MUST set shouldComplete to true.`);
    parts.push(`Ask one last question that wraps up the most important remaining gap.`);
  } else {
    parts.push(`QUESTION SELECTION STRATEGY:`);
    parts.push(`1. Review what the builder has already told you. Do NOT re-ask anything they've covered.`);
    parts.push(`2. Identify the single biggest remaining gap or unvalidated assumption.`);
    parts.push(`3. If the analysis flagged specific risks or assumptions, and the builder hasn't addressed them yet, ask about those.`);
    parts.push(`4. If domain research revealed specific competitors, regulations, or technical challenges, ask the builder how they'll handle those specifically.`);
    parts.push(`5. Reference the builder's OWN words from previous answers when asking follow-ups. For example: "You mentioned targeting Robinson R44 pilots — how would the weight calculations differ for the R22 vs R44?"
`);
    parts.push(`6. Do NOT ask generic questions. Every question must be specific to THIS idea and THIS conversation.`);
    parts.push(`7. Ask about CONCRETE specifics: specific user workflows, specific numbers (pricing, timeline, team size), specific technical approaches, specific competitors they'll differentiate against.`);
    parts.push(``);

    if (canComplete) {
      parts.push(`Set shouldComplete to true ONLY if:`);
      parts.push(`- The builder has addressed the major risks and assumptions from the analysis`);
      parts.push(`- You have enough information to meaningfully improve the re-analysis`);
      parts.push(`- Asking more questions would yield diminishing returns`);
      parts.push(`Otherwise, set shouldComplete to false and ask the next question.`);
    } else {
      parts.push(`You must set shouldComplete to false (not enough turns yet).`);
    }
  }

  parts.push(``);
  parts.push(`RESPONSE FORMAT (valid JSON only, no markdown wrapping):`);
  parts.push(`{`);
  parts.push(`  "question": "Your specific, contextual question here",`);
  parts.push(`  "reasoning": "Brief explanation of why this question matters (what gap it fills)",`);
  parts.push(`  "shouldComplete": false`);
  parts.push(`}`);

  return parts.join("\n");
}

function getFirstQuestionPrompt(analysis: IdeaAnalysis, researchBrief?: string): string {
  return buildNextQuestionPrompt(analysis, [], researchBrief);
}

function getSystemPrompt(purpose?: IdeaPurpose): string {
  const purposeType = PURPOSE_LABELS[purpose || "commercial"];

  return `You are a sharp, experienced product advisor conducting a refinement interview. Your role is to ask the single most important question that will help validate or invalidate this ${purposeType} idea.

INTERVIEW STYLE:
- Be direct and specific. Reference the idea by name.
- Ask questions that surface CONCRETE details — numbers, names, workflows, evidence.
- Never ask vague questions like "tell me more about your idea" or "what's your vision?"
- Each question should feel like a natural follow-up, not a survey item.
- If the builder gave a strong answer, acknowledge it briefly before moving to the next gap.
- Adapt your questioning based on what they've already revealed.

Respond with valid JSON only. No markdown wrapping.`;
}

export class WorkshopService {
  async generateNextQuestion(
    analysis: IdeaAnalysis,
    conversationHistory: WorkshopTurn[],
    researchBrief?: string,
    projectId?: string,
    userId?: string
  ): Promise<NextQuestionResult> {
    const turnNumber = conversationHistory.length + 1;

    if (turnNumber > MAX_TURNS) {
      return {
        question: "",
        turnNumber,
        shouldComplete: true,
        reasoning: "Maximum number of questions reached.",
      };
    }

    const prompt = buildNextQuestionPrompt(analysis, conversationHistory, researchBrief);
    const systemPrompt = getSystemPrompt(analysis.input.purpose);

    const usageContext = projectId
      ? { projectId, module: "ideas" as UsageModule, userId }
      : undefined;

    try {
      const consensus = await consensusService.getConsensus({
        prompt: {
          system: systemPrompt,
          user: prompt,
        },
        providers: ["openai"],
      }, usageContext);

      const content = consensus.providerResponses
        .sort((a, b) => b.confidence - a.confidence)[0]?.content
        || consensus.unifiedContent;

      const parsed = this.parseQuestionResponse(content, turnNumber);
      return parsed;
    } catch (error) {
      console.error(`[Workshop] Failed to generate question: ${error}`);
      return this.getFallbackQuestion(analysis, conversationHistory, turnNumber);
    }
  }

  private parseQuestionResponse(content: string, turnNumber: number): NextQuestionResult {
    try {
      let jsonStr = content.trim();
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(jsonStr);

      if (!parsed.question || typeof parsed.question !== "string") {
        throw new Error("Missing or invalid question field");
      }

      return {
        question: parsed.question,
        turnNumber,
        shouldComplete: !!parsed.shouldComplete,
        reasoning: parsed.reasoning || "",
      };
    } catch (parseError) {
      const questionMatch = content.match(/"question"\s*:\s*"([^"]+)"/);
      if (questionMatch) {
        return {
          question: questionMatch[1],
          turnNumber,
          shouldComplete: content.includes('"shouldComplete": true') || content.includes('"shouldComplete":true'),
          reasoning: "",
        };
      }

      throw new Error(`Failed to parse workshop question response: ${parseError}`);
    }
  }

  private getFallbackQuestion(
    analysis: IdeaAnalysis,
    history: WorkshopTurn[],
    turnNumber: number
  ): NextQuestionResult {
    const ideaTitle = analysis.input.title;
    const coveredTopics = history.map(h => h.question.toLowerCase()).join(" ");

    if (!coveredTopics.includes("user") && !coveredTopics.includes("audience") && !coveredTopics.includes("who")) {
      return {
        question: `Who specifically would use "${ideaTitle}" first? Describe a real person or role, their current workflow, and why they'd switch to your solution.`,
        turnNumber,
        shouldComplete: false,
        reasoning: "Target user not yet discussed",
      };
    }

    if (!coveredTopics.includes("competitor") && !coveredTopics.includes("alternative") && !coveredTopics.includes("existing")) {
      return {
        question: `What existing tools or approaches compete with "${ideaTitle}"? What specific frustrations do users have with those alternatives?`,
        turnNumber,
        shouldComplete: false,
        reasoning: "Competitive landscape not yet discussed",
      };
    }

    if (!coveredTopics.includes("scope") && !coveredTopics.includes("version 1") && !coveredTopics.includes("mvp")) {
      return {
        question: `What is the ONE thing "${ideaTitle}" must do well in version 1 to prove the concept? What are you explicitly leaving out?`,
        turnNumber,
        shouldComplete: false,
        reasoning: "Scope boundaries not yet discussed",
      };
    }

    return {
      question: `What's the biggest risk you see with "${ideaTitle}" that we haven't discussed yet? What would make you abandon this idea?`,
      turnNumber,
      shouldComplete: turnNumber >= MIN_TURNS_BEFORE_COMPLETE,
      reasoning: "General gap-filling question",
    };
  }
}

export const workshopService = new WorkshopService();
