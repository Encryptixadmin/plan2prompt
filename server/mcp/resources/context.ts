import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { storage } from "../../storage";
import { artifactService } from "../../services/artifact.service";
import { getSessionAuth } from "../server";
function getAuth(extra: any): { userId: string; projectId: string } {
  const sessionId = extra?.sessionId;
  if (!sessionId) throw new Error("No session ID");
  const auth = getSessionAuth(sessionId);
  if (!auth) throw new Error("Session not authenticated");
  return auth;
}

export function registerContextResources(server: McpServer) {
  server.resource(
    "requirements",
    "project://requirements",
    { description: "Full requirements document for the active project (latest locked requirements artifact)" },
    async (_uri, extra) => {
      const { projectId } = getAuth(extra);

      const artifacts = await storage.listArtifactsByProject(projectId, "requirements");
      const latest = artifacts[0];

      if (!latest) {
        return {
          contents: [{
            uri: "project://requirements",
            mimeType: "text/plain",
            text: "No requirements document found for this project.",
          }],
        };
      }

      return {
        contents: [{
          uri: "project://requirements",
          mimeType: "text/markdown",
          text: latest.content,
        }],
      };
    }
  );

  server.resource(
    "idea-analysis",
    "project://idea-analysis",
    { description: "Latest idea analysis with structured metadata (strengths, weaknesses, risks, feasibility)" },
    async (_uri, extra) => {
      const { projectId } = getAuth(extra);

      const artifacts = await storage.listArtifactsByProject(projectId, "ideas");
      const latest = artifacts[0];

      if (!latest) {
        return {
          contents: [{
            uri: "project://idea-analysis",
            mimeType: "text/plain",
            text: "No idea analysis found for this project.",
          }],
        };
      }

      const metadata = latest.artifactMetadata || {};
      const enriched = `${latest.content}\n\n---\n## Structured Metadata\n\`\`\`json\n${JSON.stringify(metadata, null, 2)}\n\`\`\``;

      return {
        contents: [{
          uri: "project://idea-analysis",
          mimeType: "text/markdown",
          text: enriched,
        }],
      };
    }
  );

  server.resource(
    "prompt-steps",
    "project://prompt-steps",
    { description: "All prompt steps with content, integrity levels, and traceability links" },
    async (_uri, extra) => {
      const { projectId } = getAuth(extra);

      const artifacts = await storage.listArtifactsByProject(projectId, "prompts");
      const latest = artifacts[0];

      if (!latest) {
        return {
          contents: [{
            uri: "project://prompt-steps",
            mimeType: "text/plain",
            text: "No prompts found for this project.",
          }],
        };
      }

      const metadata = latest.artifactMetadata || {};
      const steps = (metadata as any).steps || [];

      const stepsText = steps.map((step: any, idx: number) => {
        return `## Step ${step.stepNumber || step.order || idx + 1}: ${step.title || "Untitled"}\n` +
          `**Integrity Level:** ${step.integrityLevel || "safe"}\n` +
          `**Idempotent:** ${step.isIdempotent !== false ? "Yes" : "No"}\n` +
          `**Requirements Covered:** ${(step.requirementsCovered || step.traceability || []).join(", ") || "None specified"}\n\n` +
          `${step.body || step.content || ""}\n`;
      }).join("\n---\n\n");

      return {
        contents: [{
          uri: "project://prompt-steps",
          mimeType: "text/markdown",
          text: `# Prompt Steps\n\nArtifact: ${latest.id}\n\n${stepsText}`,
        }],
      };
    }
  );

  server.resource(
    "session-state",
    "project://session-state",
    { description: "Current execution session state (progress, active step, failure history)" },
    async (_uri, extra) => {
      const { projectId } = getAuth(extra);

      const sessions = await storage.listExecutionSessionsByProject(projectId);
      const activeSession = sessions.find(s => s.status === "active") || sessions[0];

      if (!activeSession) {
        return {
          contents: [{
            uri: "project://session-state",
            mimeType: "text/plain",
            text: "No execution session found for this project.",
          }],
        };
      }

      const steps = await storage.listExecutionSteps(activeSession.id);
      const completed = steps.filter(s => s.status === "completed").length;
      const failed = steps.filter(s => s.status === "failed").length;
      const inProgress = steps.filter(s => s.status === "in_progress").length;

      const failureHistory = steps
        .filter(s => s.attempts > 0)
        .map(s => ({
          stepNumber: s.stepNumber,
          attempts: s.attempts,
          lastFailureHash: s.lastFailureHash,
          escalationLevel: s.escalationLevel,
          duplicateFailureDetected: s.duplicateFailureDetected === "true",
        }));

      const state = {
        session: {
          id: activeSession.id,
          status: activeSession.status,
          promptArtifactId: activeSession.promptArtifactId,
          createdAt: activeSession.createdAt,
        },
        progress: {
          total: steps.length,
          completed,
          failed,
          inProgress,
          notStarted: steps.length - completed - failed - inProgress,
          percentComplete: steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0,
        },
        activeStep: steps.find(s => s.status === "in_progress")?.stepNumber || null,
        failureHistory,
      };

      return {
        contents: [{
          uri: "project://session-state",
          mimeType: "application/json",
          text: JSON.stringify(state, null, 2),
        }],
      };
    }
  );

  server.resource(
    "execution-progress",
    "project://execution-progress",
    { description: "Overall execution progress with step-level detail" },
    async (_uri, extra) => {
      const { projectId } = getAuth(extra);

      const sessions = await storage.listExecutionSessionsByProject(projectId);
      const activeSession = sessions.find(s => s.status === "active") || sessions[0];

      if (!activeSession) {
        return {
          contents: [{
            uri: "project://execution-progress",
            mimeType: "application/json",
            text: JSON.stringify({ error: "No execution session found" }),
          }],
        };
      }

      const steps = await storage.listExecutionSteps(activeSession.id);
      const completed = steps.filter(s => s.status === "completed").length;
      const failed = steps.filter(s => s.status === "failed").length;
      const inProgress = steps.filter(s => s.status === "in_progress").length;
      const blocked = steps.filter(s => s.escalationLevel >= 2).length;

      return {
        contents: [{
          uri: "project://execution-progress",
          mimeType: "application/json",
          text: JSON.stringify({
            sessionId: activeSession.id,
            sessionStatus: activeSession.status,
            total: steps.length,
            completed,
            failed,
            inProgress,
            blocked,
            notStarted: steps.length - completed - failed - inProgress,
            percentComplete: steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0,
            currentStep: steps.find(s => s.status === "in_progress")?.stepNumber || null,
            failureHistory: steps
              .filter(s => s.attempts > 0)
              .map(s => ({
                stepNumber: s.stepNumber,
                attempts: s.attempts,
                lastFailureHash: s.lastFailureHash,
                escalationLevel: s.escalationLevel,
              })),
          }, null, 2),
        }],
      };
    }
  );
}
