/**
 * Prompt Module Type Definitions
 * 
 * Types for generating sequential, IDE-specific build prompts.
 */

// Supported IDE types
export type IDEType = "replit" | "cursor" | "lovable" | "antigravity" | "warp" | "other";

// IDE metadata
export interface IDEInfo {
  id: IDEType;
  name: string;
  description: string;
  features: string[];
  limitations: string[];
}

// Single build prompt
export interface BuildPrompt {
  step: number;
  title: string;
  objective: string;
  prompt: string;
  expectedOutcome: string;
  waitInstruction: string;
  dependencies?: number[];
  estimatedTime?: string;
  tags?: string[];
}

// Complete prompt document
export interface PromptDocument {
  id: string;
  requirementsArtifactId: string;
  ideaTitle: string;
  ide: IDEType;
  ideName: string;
  prompts: BuildPrompt[];
  summary: string;
  totalSteps: number;
  estimatedTotalTime: string;
  createdAt: string;
  artifactId?: string;
  sourceArtifactVersion?: number;
}

// Prompt generation request
export interface GeneratePromptsRequest {
  requirementsArtifactId: string;
  ide: IDEType;
}

// Prompt generation response
export interface GeneratePromptsResponse {
  prompts: PromptDocument;
  artifactPath: string;
}

// IDE options for UI
export const IDE_OPTIONS: IDEInfo[] = [
  {
    id: "replit",
    name: "Replit",
    description: "Browser-based IDE with AI assistance",
    features: ["AI Agent", "Instant deployment", "Collaborative editing", "Built-in database"],
    limitations: ["Some system-level access restricted"],
  },
  {
    id: "cursor",
    name: "Cursor",
    description: "AI-first code editor built on VS Code",
    features: ["AI code completion", "Chat with codebase", "Multi-file editing", "Local development"],
    limitations: ["Requires local environment setup"],
  },
  {
    id: "lovable",
    name: "Lovable",
    description: "AI-powered app builder for rapid prototyping",
    features: ["Visual UI generation", "Fast iteration", "Component library", "Deployment"],
    limitations: ["Best for frontend-focused apps"],
  },
  {
    id: "antigravity",
    name: "Antigravity",
    description: "AI development platform",
    features: ["Natural language coding", "Rapid prototyping", "Full-stack support"],
    limitations: ["Newer platform with evolving features"],
  },
  {
    id: "warp",
    name: "Warp",
    description: "Modern terminal with AI capabilities",
    features: ["AI command assistance", "Blocks workflow", "Team collaboration"],
    limitations: ["Terminal-focused, pair with code editor"],
  },
  {
    id: "other",
    name: "Other / Generic",
    description: "Generic prompts for any AI-assisted IDE",
    features: ["Universal instructions", "Adaptable format"],
    limitations: ["May need adjustment for specific IDE"],
  },
];
