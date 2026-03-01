import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { storage } from "../../storage";
import { artifactService } from "../../services/artifact.service";
import { classifierService } from "../../services/classifier.service";
import { createHash } from "crypto";
import { getSessionAuth } from "../server";

function getAuth(extra: any): { userId: string; projectId: string } {
  const sessionId = extra?.sessionId;
  if (!sessionId) throw new Error("No session ID");
  const auth = getSessionAuth(sessionId);
  if (!auth) throw new Error("Session not authenticated");
  return auth;
}

export function registerExecutionTools(server: McpServer) {
  server.tool(
    "start_session",
    "Start or resume an execution session for a prompt artifact",
    {
      promptArtifactId: z.string().describe("The ID of the prompt artifact to execute"),
      totalSteps: z.number().int().min(1).describe("Total number of steps in the prompt"),
    },
    async (args, extra) => {
      const { projectId } = getAuth(extra);

      const artifact = await artifactService.getById(args.promptArtifactId);
      if (!artifact) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Prompt artifact not found" }) }] };
      }

      const existing = await storage.getActiveSessionForArtifact(projectId, args.promptArtifactId);
      if (existing) {
        const steps = await storage.listExecutionSteps(existing.id);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ session: existing, steps, resumed: true }) }],
        };
      }

      const session = await storage.createExecutionSession({
        projectId,
        promptArtifactId: args.promptArtifactId,
        promptArtifactVersion: artifact.metadata.version || 1,
        status: "active",
      });

      const steps = [];
      for (let i = 1; i <= args.totalSteps; i++) {
        const step = await storage.createExecutionStep({
          sessionId: session.id,
          stepNumber: i,
          status: "not_started",
          attempts: 0,
          escalationLevel: 0,
          reexecutionCount: 0,
        });
        steps.push(step);
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ session, steps, resumed: false }) }],
      };
    }
  );

  server.tool(
    "get_session_status",
    "Get the current execution session status and all step states",
    {
      sessionId: z.string().describe("The execution session ID"),
    },
    async (args, extra) => {
      const { projectId } = getAuth(extra);

      const session = await storage.getExecutionSession(args.sessionId);
      if (!session || session.projectId !== projectId) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Session not found" }) }] };
      }

      const steps = await storage.listExecutionSteps(session.id);

      let upstreamChanged = false;
      try {
        const artifact = await artifactService.getById(session.promptArtifactId);
        if (artifact && (artifact.metadata.version || 1) !== session.promptArtifactVersion) {
          upstreamChanged = true;
        }
      } catch {}

      const completed = steps.filter(s => s.status === "completed").length;
      const failed = steps.filter(s => s.status === "failed").length;
      const inProgress = steps.filter(s => s.status === "in_progress").length;

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            session,
            steps,
            upstreamChanged,
            progress: {
              total: steps.length,
              completed,
              failed,
              inProgress,
              notStarted: steps.length - completed - failed - inProgress,
              percentComplete: steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0,
            },
          }),
        }],
      };
    }
  );

  server.tool(
    "get_current_step",
    "Get the current active step with full prompt content, integrity level, and traceability",
    {
      sessionId: z.string().describe("The execution session ID"),
    },
    async (args, extra) => {
      const { projectId } = getAuth(extra);

      const session = await storage.getExecutionSession(args.sessionId);
      if (!session || session.projectId !== projectId) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Session not found" }) }] };
      }

      const steps = await storage.listExecutionSteps(session.id);
      const currentStep = steps.find(s => s.status === "in_progress")
        || steps.find(s => s.status === "not_started")
        || steps[steps.length - 1];

      if (!currentStep) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "No steps found" }) }] };
      }

      let stepContent: any = null;
      try {
        const artifact = await artifactService.getById(session.promptArtifactId);
        if (artifact && artifact.metadata?.steps) {
          const stepsData = artifact.metadata.steps as any[];
          const stepData = stepsData.find((s: any) => s.stepNumber === currentStep.stepNumber || s.order === currentStep.stepNumber);
          if (stepData) {
            stepContent = {
              title: stepData.title,
              body: stepData.body || stepData.content,
              integrityLevel: stepData.integrityLevel || "safe",
              isIdempotent: stepData.isIdempotent !== false,
              requirementsCovered: stepData.requirementsCovered || stepData.traceability || [],
            };
          }
        }
      } catch {}

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            step: currentStep,
            stepContent,
            sessionStatus: session.status,
            totalSteps: steps.length,
          }),
        }],
      };
    }
  );

  server.tool(
    "complete_step",
    "Mark the current step as completed and advance the session",
    {
      sessionId: z.string().describe("The execution session ID"),
      stepNumber: z.number().int().min(1).describe("The step number to complete"),
    },
    async (args, extra) => {
      const { projectId } = getAuth(extra);

      const session = await storage.getExecutionSession(args.sessionId);
      if (!session || session.projectId !== projectId) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Session not found" }) }] };
      }

      if (session.status === "blocked") {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Session is blocked due to upstream artifact changes" }) }] };
      }

      if (session.status === "completed") {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Session is already completed" }) }] };
      }

      const steps = await storage.listExecutionSteps(args.sessionId);
      const step = steps.find(s => s.stepNumber === args.stepNumber);
      if (!step) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Step ${args.stepNumber} not found` }) }] };
      }

      if (args.stepNumber > 1) {
        const prev = steps.find(s => s.stepNumber === args.stepNumber - 1);
        if (!prev || prev.status !== "completed") {
          return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Step ${args.stepNumber - 1} must be completed first` }) }] };
        }
      }

      const completionHash = createHash("sha256")
        .update(`step-${args.stepNumber}-completed-${Date.now()}`)
        .digest("hex")
        .substring(0, 16);

      await storage.updateExecutionStepStatus(step.id, "completed");
      await storage.setSuccessHash(step.id, completionHash);

      const allCompleted = steps.every(s =>
        s.stepNumber === args.stepNumber ? true : s.status === "completed"
      );
      if (allCompleted) {
        await storage.updateExecutionSessionStatus(args.sessionId, "completed");
      }

      const updatedSteps = await storage.listExecutionSteps(args.sessionId);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            completed: true,
            stepNumber: args.stepNumber,
            successHash: completionHash,
            sessionCompleted: allCompleted,
            nextStep: allCompleted ? null : args.stepNumber + 1,
            steps: updatedSteps,
          }),
        }],
      };
    }
  );

  server.tool(
    "report_failure",
    "Report a step failure with error output. Runs failure classification and returns recovery steps.",
    {
      sessionId: z.string().describe("The execution session ID"),
      stepNumber: z.number().int().min(1).describe("The step number that failed"),
      failureOutput: z.string().describe("The raw error output from the IDE"),
    },
    async (args, extra) => {
      const { projectId } = getAuth(extra);

      const session = await storage.getExecutionSession(args.sessionId);
      if (!session || session.projectId !== projectId) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Session not found" }) }] };
      }

      const steps = await storage.listExecutionSteps(args.sessionId);
      const step = steps.find(s => s.stepNumber === args.stepNumber);
      if (!step) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Step ${args.stepNumber} not found` }) }] };
      }

      const failureHash = createHash("sha256")
        .update(args.failureOutput || "unknown")
        .digest("hex")
        .substring(0, 16);

      const previousHash = step.lastFailureHash;
      const updatedStep = await storage.incrementStepAttempts(step.id, failureHash);

      let duplicateFailure = false;
      let escalated = false;
      let clarificationCreated = false;
      let blocked = false;

      if (previousHash === failureHash && updatedStep && updatedStep.attempts >= 2) {
        duplicateFailure = true;
        await storage.setDuplicateFailureDetected(step.id);
      }

      if (updatedStep && updatedStep.attempts >= 3 && updatedStep.attempts % 3 === 0) {
        const escalatedStep = await storage.incrementStepEscalation(step.id);
        escalated = true;

        if (escalatedStep && escalatedStep.escalationLevel >= 2) {
          blocked = true;
          try {
            const blockerHash = createHash("sha256")
              .update(`escalation-blocker-step-${args.stepNumber}-${args.sessionId}`)
              .digest("hex")
              .substring(0, 16);

            await storage.createClarificationContract({
              projectId: session.projectId,
              contractHash: blockerHash,
              originatingModule: "execution",
              currentArtifactId: session.promptArtifactId,
              currentArtifactVersion: session.promptArtifactVersion,
              upstreamArtifactId: session.promptArtifactId,
              upstreamArtifactVersion: session.promptArtifactVersion,
              category: "execution_failure",
              severity: "blocker",
              title: `Escalation: Step ${args.stepNumber} blocked`,
              description: `Step ${args.stepNumber} has reached escalation after ${updatedStep.attempts} failures.`,
              requiredClarifications: JSON.stringify([{
                field: "upstream_review",
                question: `Review requirements and prompts for Step ${args.stepNumber}.`,
                expectedAnswerType: "long_text",
              }]),
              resolutionStatus: "pending",
              occurrenceCount: escalatedStep.escalationLevel,
            });
            clarificationCreated = true;
          } catch {}
        }
      }

      const classification = classifierService.classifyFailure(args.failureOutput);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            stepNumber: args.stepNumber,
            failureHash,
            attempts: updatedStep?.attempts || 0,
            duplicateFailure,
            escalated,
            clarificationCreated,
            blocked,
            classification: {
              pattern: classification.pattern.id,
              patternName: classification.pattern.name,
              category: classification.pattern.category,
              instructionType: classification.instructionType,
              recommendation: classification.response.type === "known"
                ? (classification.response as any).suggestedAction
                : "Unknown failure pattern. Review the error output manually.",
              recoverySteps: classification.response.type === "known"
                ? (classification.response as any).recoverySteps || []
                : [],
              shouldRetry: classification.instructionType === "retry",
              shouldStop: classification.instructionType === "stop",
            },
          }),
        }],
      };
    }
  );

  server.tool(
    "skip_to_step",
    "Skip to a specific step number (all prior steps must be completed)",
    {
      sessionId: z.string().describe("The execution session ID"),
      stepNumber: z.number().int().min(1).describe("The step number to skip to"),
    },
    async (args, extra) => {
      const { projectId } = getAuth(extra);

      const session = await storage.getExecutionSession(args.sessionId);
      if (!session || session.projectId !== projectId) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Session not found" }) }] };
      }

      const steps = await storage.listExecutionSteps(args.sessionId);
      const targetStep = steps.find(s => s.stepNumber === args.stepNumber);
      if (!targetStep) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Step ${args.stepNumber} not found` }) }] };
      }

      for (let i = 1; i < args.stepNumber; i++) {
        const prev = steps.find(s => s.stepNumber === i);
        if (!prev || prev.status !== "completed") {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ error: `Cannot skip to step ${args.stepNumber}. Step ${i} is not completed.` }),
            }],
          };
        }
      }

      await storage.updateExecutionStepStatus(targetStep.id, "in_progress");
      const updatedSteps = await storage.listExecutionSteps(args.sessionId);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            skippedTo: args.stepNumber,
            steps: updatedSteps,
          }),
        }],
      };
    }
  );

  server.tool(
    "classify_failure",
    "Classify a failure output without advancing execution state",
    {
      failureOutput: z.string().describe("The raw error output to classify"),
    },
    async (args) => {
      const classification = classifierService.classifyFailure(args.failureOutput);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            pattern: classification.pattern.id,
            patternName: classification.pattern.name,
            category: classification.pattern.category,
            instructionType: classification.instructionType,
            response: classification.response,
          }),
        }],
      };
    }
  );
}
