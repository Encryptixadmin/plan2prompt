/**
 * Artifact Type Definitions
 * 
 * Markdown artefacts are the primary data exchange format between modules.
 * Each artefact is versioned and immutable - new versions are appended.
 */

import type { PipelineStage } from "./pipeline";

// Metadata embedded in artefact frontmatter
export interface ArtifactMetadata {
  id: string;
  title: string;
  module: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  parentId?: string; // Reference to previous version
  tags?: string[];
  author?: string;
  stage?: PipelineStage; // Current pipeline stage
  sourceArtifactId?: string; // Reference to parent artifact in pipeline
}

// A section within the Markdown artefact
export interface ArtifactSection {
  id: string;
  heading: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  content: string;
}

// AI-generated notes attached to the artefact
export interface ArtifactAINote {
  id: string;
  provider: "openai" | "anthropic" | "gemini" | "system";
  model?: string;
  timestamp: string;
  note: string;
  confidence?: number;
}

// Complete artefact structure
export interface Artifact {
  metadata: ArtifactMetadata;
  sections: ArtifactSection[];
  aiNotes: ArtifactAINote[];
  rawContent: string;
}

// Input for creating a new artefact
export interface CreateArtifactInput {
  title: string;
  module: string;
  sections: Omit<ArtifactSection, "id">[];
  aiNotes?: Omit<ArtifactAINote, "id" | "timestamp">[];
  tags?: string[];
  author?: string;
  stage?: PipelineStage;
  sourceArtifactId?: string;
}

// Input for updating an artefact (creates new version)
export interface UpdateArtifactInput {
  title?: string;
  sections?: Omit<ArtifactSection, "id">[];
  aiNotes?: Omit<ArtifactAINote, "id" | "timestamp">[];
  tags?: string[];
}

// Artefact reference for passing between modules
export interface ArtifactReference {
  id: string;
  version: number;
  module: string;
  title: string;
  path: string;
}

// Version history entry
export interface ArtifactVersion {
  version: number;
  id: string;
  createdAt: string;
  path: string;
}

// List response for artefacts
export interface ArtifactListItem {
  id: string;
  title: string;
  module: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  path: string;
  stage?: PipelineStage;
  sourceArtifactId?: string;
}
