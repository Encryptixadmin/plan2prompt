import { QueryClient, QueryFunction } from "@tanstack/react-query";

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

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    
    try {
      const json = JSON.parse(text);
      if (json.error?.code === "MISSING_PROJECT_CONTEXT") {
        throw new MissingProjectContextError();
      }
    } catch (e) {
      if (e instanceof MissingProjectContextError) throw e;
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
