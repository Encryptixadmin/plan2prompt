import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { storage } from "../../storage";
import { getSessionAuth } from "../server";

function getAuth(extra: any): { userId: string; projectId: string } {
  const sessionId = extra?.sessionId;
  if (!sessionId) throw new Error("No session ID");
  const auth = getSessionAuth(sessionId);
  if (!auth) throw new Error("Session not authenticated");
  return auth;
}

export function registerClarificationTools(server: McpServer) {
  server.tool(
    "list_clarifications",
    "List active clarification contracts for the current project",
    {
      module: z.string().optional().describe("Filter by originating module (e.g., 'execution', 'ideas', 'requirements')"),
    },
    async (args, extra) => {
      const { projectId } = getAuth(extra);

      let contracts;
      if (args.module) {
        contracts = await storage.listPendingClarificationsByModule(projectId, args.module);
      } else {
        contracts = await storage.listPendingClarificationsByProject(projectId);
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            count: contracts.length,
            contracts: contracts.map(c => ({
              id: c.id,
              title: c.title,
              category: c.category,
              severity: c.severity,
              originatingModule: c.originatingModule,
              occurrenceCount: c.occurrenceCount,
              createdAt: c.createdAt,
            })),
          }),
        }],
      };
    }
  );

  server.tool(
    "get_clarification",
    "Get detailed information about a specific clarification contract",
    {
      clarificationId: z.string().describe("The clarification contract ID"),
    },
    async (args, extra) => {
      const { projectId } = getAuth(extra);

      const contract = await storage.getClarificationContract(args.clarificationId);
      if (!contract || contract.projectId !== projectId) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Clarification not found" }) }] };
      }

      let requiredClarifications: any[] = [];
      try {
        requiredClarifications = JSON.parse(contract.requiredClarifications || "[]");
      } catch {}

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            id: contract.id,
            title: contract.title,
            description: contract.description,
            category: contract.category,
            severity: contract.severity,
            originatingModule: contract.originatingModule,
            resolutionStatus: contract.resolutionStatus,
            occurrenceCount: contract.occurrenceCount,
            requiredClarifications,
            createdAt: contract.createdAt,
          }),
        }],
      };
    }
  );

  server.tool(
    "resolve_clarification",
    "Submit a resolution for a clarification contract",
    {
      clarificationId: z.string().describe("The clarification contract ID"),
      resolutionData: z.record(z.unknown()).describe("Resolution data matching the required clarification fields"),
    },
    async (args, extra) => {
      const { projectId } = getAuth(extra);

      const contract = await storage.getClarificationContract(args.clarificationId);
      if (!contract || contract.projectId !== projectId) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Clarification not found" }) }] };
      }

      if (contract.resolutionStatus !== "pending") {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Clarification is not pending" }) }] };
      }

      const updated = await storage.updateClarificationStatus(
        args.clarificationId,
        "resolved",
        JSON.stringify(args.resolutionData)
      );

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            resolved: true,
            clarificationId: args.clarificationId,
            status: updated?.resolutionStatus || "resolved",
          }),
        }],
      };
    }
  );
}
