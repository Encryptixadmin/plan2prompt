import Anthropic from "@anthropic-ai/sdk";
import type { AIPrompt, AIProviderResponse, AITokenUsage } from "@shared/types/ai";
import type { OpusCompilerInput, OpusCompilerOutput, OpusExecutionInstruction } from "@shared/types/opus-compiler";
import { BaseAIProvider, type ProviderConfig } from "./provider.interface";
import { providerValidationService } from "./provider-validation.service";

const DEFAULT_OPUS_MODEL = "claude-opus-4-6";

const OPUS_SYSTEM_PROMPT = `You are a COMPILER. You translate structured build instructions into IDE-executable steps.

RULES:
- Output executable IDE instructions ONLY.
- Follow constraints EXACTLY.
- Do NOT improvise or add features not specified.
- Do NOT inspect the repository.
- Do NOT run code.
- Do NOT suggest alternatives or multiple options.
- Do NOT include conversational text, commentary, or suggestions.
- Each instruction must be actionable and deterministic.

OUTPUT FORMAT (strict order):

## EXECUTION STEPS
Numbered steps the user must execute in their IDE. Each step must be concrete and unambiguous.

## CODE BLOCKS
Only where the step requires writing or modifying code. Include file path and language.

## VERIFICATION
What the user must check after executing this step. Include success criteria.

## STOP CONDITIONS
Conditions under which the user must STOP and not proceed to the next step.

## FAILURE RECOVERY
If a known failure mode occurs, state the symptom, cause, and recovery action. Reference only the failure modes provided in the input.`;

export class AnthropicOpusService extends BaseAIProvider {
  readonly provider = "anthropic-opus" as const;
  private client: Anthropic | null = null;

  constructor(config: Partial<ProviderConfig> = {}) {
    super({
      ...config,
      maxTokens: config.maxTokens ?? 8192,
      temperature: config.temperature ?? 0.1,
    });
    this.initializeClient();
  }

  get model(): string {
    return providerValidationService.getResolvedModelId("anthropic-opus") || DEFAULT_OPUS_MODEL;
  }

  private initializeClient(): void {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.client) return false;
    const resolved = providerValidationService.getResolvedModelId("anthropic-opus");
    return resolved !== null;
  }

  async generate(prompt: AIPrompt): Promise<AIProviderResponse> {
    const startTime = Date.now();

    if (!this.client) {
      return this.generateMockResponse(prompt, startTime);
    }

    const resolvedModel = providerValidationService.getResolvedModelId("anthropic-opus");
    if (!resolvedModel) {
      return this.generateMockResponse(prompt, startTime);
    }

    try {
      const response = await this.withRetry(() =>
        this.withTimeout(
          this.client!.messages.create({
            model: resolvedModel,
            max_tokens: prompt.maxTokens ?? this.config.maxTokens,
            system: prompt.system || OPUS_SYSTEM_PROMPT,
            messages: [{ role: "user", content: prompt.user }],
          }),
          60000
        )
      );

      const content = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n");

      const tokenUsage: AITokenUsage = {
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
        totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
      };

      return this.createResponse(
        content,
        `Opus compiled step instructions`,
        0.95,
        "Deterministic compilation via Opus compiler mode.",
        Date.now() - startTime,
        tokenUsage,
        false
      );
    } catch (error) {
      console.error(`[Anthropic Opus] API error: ${error instanceof Error ? error.message : error}`);
      return this.generateMockResponse(prompt, startTime);
    }
  }

  async executePrompt(input: OpusCompilerInput): Promise<OpusCompilerOutput> {
    const startTime = Date.now();

    const resolvedModel = providerValidationService.getResolvedModelId("anthropic-opus");

    if (!this.client || !resolvedModel) {
      return this.generateMockCompilerOutput(input, startTime);
    }

    const userPrompt = this.buildCompilerPrompt(input);

    try {
      const response = await this.withRetry(() =>
        this.withTimeout(
          this.client!.messages.create({
            model: resolvedModel,
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature,
            system: OPUS_SYSTEM_PROMPT,
            messages: [{ role: "user", content: userPrompt }],
          }),
          60000
        )
      );

      const content = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n");

      const tokenUsage = {
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
        totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
      };

      const parsed = this.parseCompilerOutput(content, input);

      return {
        provider: "anthropic-opus",
        model: resolvedModel,
        stepId: input.stepId,
        executionInstructions: parsed.executionInstructions,
        verification: parsed.verification,
        failureRecovery: parsed.failureRecovery,
        warnings: parsed.warnings,
        tokenUsage,
        latencyMs: Date.now() - startTime,
        isMock: false,
      };
    } catch (error) {
      console.error(`[Anthropic Opus] Compilation error: ${error instanceof Error ? error.message : error}`);
      return this.generateMockCompilerOutput(input, startTime);
    }
  }

  private buildCompilerPrompt(input: OpusCompilerInput): string {
    const sections: string[] = [];

    sections.push(`# BUILD STEP COMPILATION REQUEST`);
    sections.push(`## Step ${input.stepNumber} of ${input.executionContext.totalSteps}: ${input.objective}`);
    sections.push(``);
    sections.push(`### Target IDE: ${input.executionContext.ideName} (${input.executionContext.ide})`);
    sections.push(`### Project: ${input.executionContext.ideaTitle}`);
    sections.push(``);
    sections.push(`### Prompt Content`);
    sections.push(input.promptContent);
    sections.push(``);

    if (input.constraints.length > 0) {
      sections.push(`### Constraints (MUST follow exactly)`);
      input.constraints.forEach((c, i) => sections.push(`${i + 1}. ${c}`));
      sections.push(``);
    }

    sections.push(`### Expected Outcome`);
    sections.push(input.expectedOutcome);
    sections.push(``);

    if (input.verificationSteps.length > 0) {
      sections.push(`### Verification Steps`);
      input.verificationSteps.forEach((v, i) => sections.push(`${i + 1}. ${v}`));
      sections.push(``);
    }

    if (input.failureModes.length > 0) {
      sections.push(`### Known Failure Modes`);
      input.failureModes.forEach((f, i) => {
        sections.push(`${i + 1}. Symptom: ${f.symptom}`);
        sections.push(`   Cause: ${f.likelyCause}`);
        sections.push(`   Recovery: ${f.recoveryAction}`);
      });
      sections.push(``);
    }

    if (input.scopeGuardrails.length > 0) {
      sections.push(`### Scope Guardrails (DO NOT exceed)`);
      input.scopeGuardrails.forEach((g, i) => sections.push(`${i + 1}. ${g}`));
      sections.push(``);
    }

    sections.push(`Compile the above into executable IDE instructions. Follow the output format exactly.`);

    return sections.join("\n");
  }

  private parseCompilerOutput(content: string, input: OpusCompilerInput): {
    executionInstructions: OpusExecutionInstruction[];
    verification: { check: string; successCriteria: string }[];
    failureRecovery: { symptom: string; cause: string; action: string }[];
    warnings: string[];
  } {
    const executionInstructions: OpusExecutionInstruction[] = [];
    const verification: { check: string; successCriteria: string }[] = [];
    const failureRecovery: { symptom: string; cause: string; action: string }[] = [];
    const warnings: string[] = [];

    const executionMatch = content.match(/## EXECUTION STEPS\s*([\s\S]*?)(?=## CODE BLOCKS|## VERIFICATION|## STOP CONDITIONS|## FAILURE RECOVERY|$)/i);
    const codeBlocksMatch = content.match(/## CODE BLOCKS\s*([\s\S]*?)(?=## VERIFICATION|## STOP CONDITIONS|## FAILURE RECOVERY|$)/i);
    const verificationMatch = content.match(/## VERIFICATION\s*([\s\S]*?)(?=## STOP CONDITIONS|## FAILURE RECOVERY|$)/i);
    const stopMatch = content.match(/## STOP CONDITIONS\s*([\s\S]*?)(?=## FAILURE RECOVERY|$)/i);
    const failureMatch = content.match(/## FAILURE RECOVERY\s*([\s\S]*?)$/i);

    if (executionMatch) {
      const stepRegex = /(\d+)\.\s*([\s\S]*?)(?=\d+\.|$)/g;
      let match;
      while ((match = stepRegex.exec(executionMatch[1])) !== null) {
        const stepNum = parseInt(match[1], 10);
        const text = match[2].trim();
        if (text) {
          executionInstructions.push({
            stepNumber: stepNum,
            instructionText: text,
            stopAfter: false,
          });
        }
      }
    }

    if (codeBlocksMatch) {
      const codeRegex = /```(\w+)?\n([\s\S]*?)```/g;
      let codeMatch;
      let codeIdx = 0;
      while ((codeMatch = codeRegex.exec(codeBlocksMatch[1])) !== null) {
        const language = codeMatch[1] || "text";
        const code = codeMatch[2].trim();
        const filePathMatch = codeBlocksMatch[1].slice(0, codeMatch.index).match(/(?:file|path):\s*`?([^\n`]+)`?\s*$/i);
        if (codeIdx < executionInstructions.length) {
          executionInstructions[codeIdx].codeBlock = {
            language,
            code,
            filePath: filePathMatch ? filePathMatch[1].trim() : undefined,
          };
        }
        codeIdx++;
      }
    }

    if (verificationMatch) {
      const lines = verificationMatch[1].trim().split("\n").filter(l => l.trim());
      for (let i = 0; i < lines.length; i += 2) {
        const check = lines[i].replace(/^[-*\d.]+\s*/, "").trim();
        const criteria = lines[i + 1] ? lines[i + 1].replace(/^[-*\d.]+\s*/, "").trim() : check;
        if (check) {
          verification.push({ check, successCriteria: criteria });
        }
      }
    }

    if (stopMatch) {
      const stopLines = stopMatch[1].trim().split("\n").filter(l => l.trim());
      for (const line of stopLines) {
        const cleaned = line.replace(/^[-*\d.]+\s*/, "").trim();
        if (cleaned) {
          warnings.push(`STOP: ${cleaned}`);
        }
      }

      if (executionInstructions.length > 0) {
        executionInstructions[executionInstructions.length - 1].stopAfter = true;
      }
    }

    if (failureMatch) {
      const entries = failureMatch[1].split(/(?=\d+\.|\*\s+Symptom:)/);
      for (const entry of entries) {
        const symptomM = entry.match(/[Ss]ymptom:\s*(.*)/);
        const causeM = entry.match(/[Cc]ause:\s*(.*)/);
        const actionM = entry.match(/(?:[Rr]ecovery|[Aa]ction):\s*(.*)/);
        if (symptomM) {
          failureRecovery.push({
            symptom: symptomM[1].trim(),
            cause: causeM ? causeM[1].trim() : "Unknown",
            action: actionM ? actionM[1].trim() : "STOP. DO NOT CONTINUE.",
          });
        }
      }
    }

    if (executionInstructions.length === 0) {
      executionInstructions.push({
        stepNumber: 1,
        instructionText: content.trim(),
        stopAfter: true,
      });
      warnings.push("Output did not match expected section format. Raw content returned as single instruction.");
    }

    return { executionInstructions, verification, failureRecovery, warnings };
  }

  private generateMockCompilerOutput(input: OpusCompilerInput, startTime: number): OpusCompilerOutput {
    const instructions: OpusExecutionInstruction[] = [
      {
        stepNumber: 1,
        instructionText: `Open ${input.executionContext.ideName} and navigate to the project workspace.`,
        stopAfter: false,
      },
      {
        stepNumber: 2,
        instructionText: `Execute the following for step "${input.objective}": ${input.promptContent.slice(0, 200)}`,
        codeBlock: {
          language: "bash",
          code: `# Step ${input.stepNumber}: ${input.objective}\necho "Executing step ${input.stepNumber}"`,
        },
        stopAfter: false,
      },
      {
        stepNumber: 3,
        instructionText: `Verify: ${input.expectedOutcome}`,
        stopAfter: true,
      },
    ];

    const estimatedTokens = this.estimateInputTokens(input.promptContent) + 200;

    return {
      provider: "anthropic-opus",
      model: "mock-opus",
      stepId: input.stepId,
      executionInstructions: instructions,
      verification: input.verificationSteps.map(v => ({
        check: v,
        successCriteria: `Confirmed: ${v}`,
      })),
      failureRecovery: input.failureModes.map(f => ({
        symptom: f.symptom,
        cause: f.likelyCause,
        action: f.recoveryAction,
      })),
      warnings: ["Mock compilation - Anthropic Opus not configured or unavailable"],
      tokenUsage: {
        inputTokens: estimatedTokens,
        outputTokens: 200,
        totalTokens: estimatedTokens + 200,
      },
      latencyMs: Date.now() - startTime,
      isMock: true,
    };
  }

  private async generateMockResponse(prompt: AIPrompt, startTime: number): Promise<AIProviderResponse> {
    await this.delay(100 + Math.random() * 100);

    const inputTokens = this.estimateInputTokens(prompt.user + (prompt.context || "") + (prompt.system || ""));
    const mockContent = `[Opus Compiler - Mock]\n\n## EXECUTION STEPS\n1. This is a mock compilation output.\n2. Configure ANTHROPIC_API_KEY with Opus model access for real compilation.\n\n## VERIFICATION\n- Verify mock output is displayed.\n\n## STOP CONDITIONS\n- STOP: This is mock output. Do not execute.\n\n## FAILURE RECOVERY\nNone applicable for mock mode.`;
    const outputTokens = this.estimateInputTokens(mockContent);

    return this.createResponse(
      mockContent,
      "Mock Opus compiler output",
      0.5,
      "Mock response - Opus model not available.",
      Date.now() - startTime,
      { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
      true
    );
  }
}

export const anthropicOpusService = new AnthropicOpusService();
