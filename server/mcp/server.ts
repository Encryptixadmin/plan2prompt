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

const projectOverrides = new Map<string, string>();

interface RateLimitEntry {
  count: number;
  windowStart: number;
}
const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitMap.delete(key);
    }
  }
}, 60_000);

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(userId, { count: 1, windowStart: now });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

export function getSessionAuth(sessionId: string): { userId: string; projectId: string } | null {
  const entry = sessions.get(sessionId);
  if (!entry) return null;
  const override = projectOverrides.get(sessionId);
  return { userId: entry.userId, projectId: override || entry.projectId };
}

function createMcpServerInstance(): McpServer {
  const server = new McpServer(
    {
      name: "plan2prompt",
      version: "1.2.0",
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

    if (!checkRateLimit(authResult.auth.userId)) {
      return res.status(429).json({
        jsonrpc: "2.0",
        error: { code: -32029, message: "Rate limit exceeded. Maximum 60 requests per minute. Please wait before retrying." },
        id: null,
      });
    }

    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && sessions.has(sessionId)) {
      const entry = sessions.get(sessionId)!;
      const requestProjectId = req.headers["x-project-id"] as string;
      if (requestProjectId && requestProjectId !== entry.projectId) {
        const member = await storage.getProjectMember(requestProjectId, authResult.auth.userId);
        if (member) {
          projectOverrides.set(sessionId, requestProjectId);
        }
      } else {
        projectOverrides.delete(sessionId);
      }
      await entry.transport.handleRequest(req, res, req.body);
      return;
    }

    if (sessionId && !sessions.has(sessionId)) {
      const isInitialize = Array.isArray(req.body)
        ? req.body.some((m: any) => m.method === "initialize")
        : req.body?.method === "initialize";

      if (!isInitialize) {
        return res.status(409).json({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Session expired or server restarted. Send a new initialize request to reconnect." },
          id: null,
        });
      }
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
        projectOverrides.delete(newSessionId);
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
      error: { code: -32000, message: "No valid session. Send an initialize request with a valid Authorization and X-Project-Id header to start." },
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
  if (!sessionId) {
    return res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "No session ID provided." },
      id: null,
    });
  }
  if (!sessions.has(sessionId)) {
    return res.status(409).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Session expired or server restarted. Send a new initialize request to reconnect." },
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
    projectOverrides.delete(sessionId);
    return;
  }
  res.status(200).end();
});

export default router;
