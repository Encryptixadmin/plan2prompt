import { useState, useCallback, useRef } from "react";
import { getActiveProjectId } from "@/lib/queryClient";

export interface ProgressStage {
  stage: string;
  message: string;
  percent: number;
  timestamp: number;
  status: "pending" | "active" | "complete";
}

interface SSEGenerationState<T> {
  stages: ProgressStage[];
  currentStage: string | null;
  result: T | null;
  error: string | null;
  isGenerating: boolean;
  startTime: number | null;
}

interface SSEGenerationReturn<T> extends SSEGenerationState<T> {
  startGeneration: (url: string, body: unknown) => void;
  reset: () => void;
}

const STAGE_DEFINITIONS: Record<string, { label: string; stages: { id: string; label: string }[] }> = {
  ideas: {
    label: "Idea Analysis",
    stages: [
      { id: "researching", label: "Researching domain" },
      { id: "analyzing", label: "Building prompts" },
      { id: "building_consensus", label: "AI consensus" },
      { id: "synthesizing", label: "Synthesizing results" },
      { id: "complete", label: "Complete" },
    ],
  },
  requirements: {
    label: "Requirements Generation",
    stages: [
      { id: "loading_idea", label: "Loading idea" },
      { id: "generating", label: "Generating with AI" },
      { id: "parsing", label: "Parsing response" },
      { id: "validating", label: "Validating structure" },
      { id: "complete", label: "Complete" },
    ],
  },
  prompts: {
    label: "Prompt Generation",
    stages: [
      { id: "loading_requirements", label: "Loading requirements" },
      { id: "generating", label: "Generating prompts" },
      { id: "enriching", label: "Enriching with AI" },
      { id: "structuring", label: "Structuring document" },
      { id: "complete", label: "Complete" },
    ],
  },
};

export function getStageDefinitions(module: "ideas" | "requirements" | "prompts") {
  return STAGE_DEFINITIONS[module];
}

export function useSSEGeneration<T = unknown>(module: "ideas" | "requirements" | "prompts"): SSEGenerationReturn<T> {
  const [state, setState] = useState<SSEGenerationState<T>>({
    stages: [],
    currentStage: null,
    result: null,
    error: null,
    isGenerating: false,
    startTime: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setState({
      stages: [],
      currentStage: null,
      result: null,
      error: null,
      isGenerating: false,
      startTime: null,
    });
  }, []);

  const startGeneration = useCallback((url: string, body: unknown) => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    const defs = STAGE_DEFINITIONS[module];
    const initialStages: ProgressStage[] = defs.stages
      .filter(s => s.id !== "complete")
      .map(s => ({
        stage: s.id,
        message: s.label,
        percent: 0,
        timestamp: 0,
        status: "pending" as const,
      }));

    setState({
      stages: initialStages,
      currentStage: null,
      result: null,
      error: null,
      isGenerating: true,
      startTime: Date.now(),
    });

    const projectId = getActiveProjectId();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (projectId) {
      headers["X-Project-Id"] = projectId;
    }

    fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          let errorMessage = `Server error: ${response.status}`;
          try {
            const errorBody = await response.json();
            errorMessage = errorBody?.error?.message || errorBody?.message || errorMessage;
          } catch { /* ignore parse error */ }
          throw new Error(errorMessage);
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("text/event-stream") && !response.body) {
          throw new Error("Unexpected response format");
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let receivedResult = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          let eventType = "";
          let dataLines: string[] = [];

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              if (eventType && dataLines.length > 0) {
                processEvent(eventType, dataLines.join("\n"));
                dataLines = [];
              }
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              dataLines.push(line.slice(6));
            } else if (line === "" && eventType && dataLines.length > 0) {
              processEvent(eventType, dataLines.join("\n"));
              eventType = "";
              dataLines = [];
            }
          }

          if (eventType && dataLines.length > 0) {
            processEvent(eventType, dataLines.join("\n"));
          }
        }

        if (buffer.trim()) {
          const remainingLines = buffer.split("\n");
          let eventType = "";
          let dataLines: string[] = [];
          for (const line of remainingLines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              dataLines.push(line.slice(6));
            }
          }
          if (eventType && dataLines.length > 0) {
            processEvent(eventType, dataLines.join("\n"));
          }
        }

        if (!receivedResult) {
          setState(prev => {
            if (prev.isGenerating) {
              return { ...prev, error: "Stream ended without result", isGenerating: false };
            }
            return prev;
          });
        }

        function processEvent(type: string, data: string) {
          try {
            const parsed = JSON.parse(data);

            if (type === "progress") {
              setState(prev => {
                const updatedStages = prev.stages.map(s => {
                  if (s.stage === parsed.stage) {
                    return { ...s, status: "active" as const, message: parsed.message, percent: parsed.percent, timestamp: Date.now() };
                  }
                  const stageIndex = defs.stages.findIndex(d => d.id === s.stage);
                  const currentIndex = defs.stages.findIndex(d => d.id === parsed.stage);
                  if (stageIndex < currentIndex && s.status !== "complete") {
                    return { ...s, status: "complete" as const, timestamp: s.timestamp || Date.now() };
                  }
                  return s;
                });
                return { ...prev, stages: updatedStages, currentStage: parsed.stage };
              });
            } else if (type === "result") {
              receivedResult = true;
              setState(prev => ({
                ...prev,
                stages: prev.stages.map(s => ({ ...s, status: "complete" as const })),
                currentStage: "complete",
                result: parsed as T,
                isGenerating: false,
              }));
            } else if (type === "error") {
              receivedResult = true;
              setState(prev => ({
                ...prev,
                error: parsed.message || "Generation failed",
                isGenerating: false,
              }));
            }
          } catch {
            // skip malformed JSON
          }
        }
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setState(prev => ({
          ...prev,
          error: err instanceof Error ? err.message : "Generation failed",
          isGenerating: false,
        }));
      });
  }, [module]);

  return { ...state, startGeneration, reset };
}
