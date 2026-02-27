import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { AnalysisTimeoutError } from "./error-messages";

let activeProjectId: string | null = null;

export function setActiveProjectId(projectId: string | null) {
  activeProjectId = projectId;
}

export function getActiveProjectId(): string | null {
  return activeProjectId;
}

export class MissingProjectContextError extends Error {
  constructor() {
    super("Please select or create a project before continuing.");
    this.name = "MissingProjectContextError";
  }
}

const PROJECT_SCOPED_ROUTES = [
  "/api/ideas",
  "/api/requirements",
  "/api/prompts",
  "/api/artifacts",
];

function isProjectScopedRoute(url: string): boolean {
  return PROJECT_SCOPED_ROUTES.some((route) => url.startsWith(route));
}

function getProjectHeaders(url: string): Record<string, string> {
  if (!isProjectScopedRoute(url)) {
    return {};
  }
  if (!activeProjectId) {
    throw new MissingProjectContextError();
  }
  return { "X-Project-Id": activeProjectId };
}

export class RateLimitError extends Error {
  public retryAfter: number;
  constructor(message: string, retryAfter: number) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    
    try {
      const json = JSON.parse(text);
      if (json.error?.code === "MISSING_PROJECT_CONTEXT") {
        throw new MissingProjectContextError();
      }
      if (res.status === 429 || json.error?.code === "RATE_LIMIT_EXCEEDED") {
        throw new RateLimitError(
          json.error?.message || "Too many requests. Please try again later.",
          json.error?.retryAfter || 60
        );
      }
    } catch (e) {
      if (e instanceof MissingProjectContextError || e instanceof RateLimitError) throw e;
    }
    
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const projectHeaders = getProjectHeaders(url);
  
  const res = await fetch(url, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...projectHeaders,
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

export async function downloadArtifactExport(artifactId: string, fallbackFilename = "artifact.md") {
  const projectHeaders = getProjectHeaders("/api/artifacts");

  const res = await fetch(`/api/artifacts/${artifactId}/export?format=markdown`, {
    credentials: "include",
    headers: projectHeaders,
  });

  if (!res.ok) {
    let errorMessage = `Export failed (${res.status})`;
    try {
      const errorBody = await res.json();
      errorMessage = errorBody?.error?.message || errorBody?.message || errorMessage;
    } catch { /* not JSON */ }
    throw new Error(errorMessage);
  }

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition");
  let filename = fallbackFilename;
  if (disposition) {
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match) filename = match[1];
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const ANALYSIS_TIMEOUT_MS = 45000;

export async function timedApiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  timeoutMs: number = ANALYSIS_TIMEOUT_MS,
): Promise<Response> {
  const projectHeaders = getProjectHeaders(url);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method,
      headers: {
        ...(data ? { "Content-Type": "application/json" } : {}),
        ...projectHeaders,
      },
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
      signal: controller.signal,
    });

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new AnalysisTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    const projectHeaders = getProjectHeaders(url);
    
    const res = await fetch(url, {
      credentials: "include",
      headers: projectHeaders,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
