import type { IDEType } from "./prompts";

export interface OpusCompilerInput {
  stepId: string;
  stepNumber: number;
  objective: string;
  promptContent: string;
  executionContext: {
    ideaTitle: string;
    ide: IDEType;
    ideName: string;
    totalSteps: number;
    currentStep: number;
    previousStepsCompleted: number[];
  };
  constraints: string[];
  expectedOutcome: string;
  verificationSteps: string[];
  failureModes: {
    symptom: string;
    likelyCause: string;
    recoveryAction: string;
  }[];
  scopeGuardrails: string[];
}

export interface OpusExecutionInstruction {
  stepNumber: number;
  instructionText: string;
  codeBlock?: {
    language: string;
    code: string;
    filePath?: string;
  };
  stopAfter: boolean;
}

export interface OpusCompilerOutput {
  provider: "anthropic-opus";
  model: string;
  stepId: string;
  executionInstructions: OpusExecutionInstruction[];
  verification: {
    check: string;
    successCriteria: string;
  }[];
  failureRecovery: {
    symptom: string;
    cause: string;
    action: string;
  }[];
  warnings: string[];
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
  isMock: boolean;
}

export interface CompilePromptRequest {
  promptArtifactId: string;
  stepNumber: number;
  ide: IDEType;
}

export interface CompilePromptResponse {
  success: boolean;
  data?: OpusCompilerOutput;
  error?: {
    code: string;
    message: string;
  };
}
