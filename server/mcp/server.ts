import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import { authenticateApiKey, type McpAuthInfo } from "./auth";
import { storage } from "../storage";
import { registerExecutionTools } from "./tools/execution";
import { registerClarificationTools } from "./tools/clarifications";
import { registerContextResources } from "./resources/context";

const router = Router();

interface SessionEntry {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  userId: string;
  projectId: string;
}

const sessions = new Map<string, SessionEntry>();

export function getSessionAuth(sessionId: string): { userId: string; projectId: string } | null {
  const entry = sessions.get(sessionId);
  if (!entry) return null;
  return { userId: entry.userId, projectId: entry.projectId };
}

function createMcpServerInstance(): McpServer {
  const server = new McpServer(
    {
      name: "plan2prompt",
      version: "1.1.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  registerExecutionTools(server);
  registerClarificationTools(server);
  registerContextResources(server);

  return server;
}

async function extractAuth(req: Request): Promise<{ auth: McpAuthInfo; projectId: string } | null> {
  const authHeader = req.headers.authorization;
  const auth = await authenticateApiKey(authHeader);
  if (!auth) return null;

  const projectId = req.headers["x-project-id"] as string;
  if (!projectId) return null;

  const member = await storage.getProjectMember(projectId, auth.userId);
  if (!member) return null;

  return { auth, projectId };
}

router.post("/", async (req: Request, res: Response) => {
  try {
    const authResult = await extractAuth(req);
    if (!authResult) {
      return res.status(401).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Authentication required. Use Authorization: Bearer <api_key> and X-Project-Id headers." },
        id: null,
      });
    }

    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && sessions.has(sessionId)) {
      const entry = sessions.get(sessionId)!;
      await entry.transport.handleRequest(req, res, req.body);
      return;
    }

    const isInitialize = Array.isArray(req.body)
      ? req.body.some((m: any) => m.method === "initialize")
      : req.body?.method === "initialize";

    if (isInitialize) {
      const newSessionId = randomUUID();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => newSessionId,
      });

      const mcpServer = createMcpServerInstance();

      transport.onclose = () => {
        sessions.delete(newSessionId);
      };

      await mcpServer.connect(transport);

      sessions.set(newSessionId, {
        transport,
        server: mcpServer,
        userId: authResult.auth.userId,
        projectId: authResult.projectId,
      });

      await transport.handleRequest(req, res, req.body);
      return;
    }

    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "No valid session. Send an initialize request first." },
      id: null,
    });
  } catch (error) {
    console.error("MCP request error:", error);
    res.status(500).json({
      jsonrpc: "2.0",
      error: { code: -32603, message: "Internal server error" },
      id: null,
    });
  }
});

router.get("/", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "No valid session." },
      id: null,
    });
  }

  const entry = sessions.get(sessionId)!;
  await entry.transport.handleRequest(req, res);
});

router.delete("/", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId && sessions.has(sessionId)) {
    const entry = sessions.get(sessionId)!;
    await entry.transport.handleRequest(req, res);
    sessions.delete(sessionId);
    return;
  }
  res.status(200).end();
});

export default router;
