import { randomUUID } from "crypto";
import * as fs from "fs/promises";
import * as path from "path";
import type {
  Artifact,
  ArtifactMetadata,
  ArtifactSection,
  ArtifactAINote,
  ArtifactReference,
  ArtifactVersion,
  ArtifactListItem,
  CreateArtifactInput,
  UpdateArtifactInput,
} from "@shared/types/artifact";
import type { PipelineStage } from "@shared/types/pipeline";

const ARTIFACTS_DIR = path.join(process.cwd(), "artifacts");

// Ensure artifacts directory exists
async function ensureArtifactsDir(): Promise<void> {
  try {
    await fs.access(ARTIFACTS_DIR);
  } catch {
    await fs.mkdir(ARTIFACTS_DIR, { recursive: true });
  }
}

// Generate a slug from title for file naming
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
}

// Build file path for an artefact
function getArtifactPath(module: string, slug: string, version: number): string {
  const moduleDir = path.join(ARTIFACTS_DIR, module);
  return path.join(moduleDir, `${slug}_v${version}.md`);
}

// Parse frontmatter from Markdown content
function parseFrontmatter(content: string): { metadata: Record<string, unknown>; body: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    return { metadata: {}, body: content };
  }

  const frontmatter = match[1];
  const body = match[2];
  const metadata: Record<string, unknown> = {};

  frontmatter.split("\n").forEach((line) => {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      let value: unknown = line.substring(colonIndex + 1).trim();
      
      // Parse arrays
      if (value === "") {
        return;
      }
      if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
        value = value
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim().replace(/^["']|["']$/g, ""));
      }
      // Parse numbers
      else if (typeof value === "string" && !isNaN(Number(value))) {
        value = Number(value);
      }
      
      metadata[key] = value;
    }
  });

  return { metadata, body };
}

// Build frontmatter string from metadata
function buildFrontmatter(metadata: ArtifactMetadata): string {
  const lines = [
    "---",
    `id: ${metadata.id}`,
    `title: ${metadata.title}`,
    `module: ${metadata.module}`,
    `version: ${metadata.version}`,
    `createdAt: ${metadata.createdAt}`,
    `updatedAt: ${metadata.updatedAt}`,
  ];

  if (metadata.parentId) {
    lines.push(`parentId: ${metadata.parentId}`);
  }
  if (metadata.tags && metadata.tags.length > 0) {
    lines.push(`tags: [${metadata.tags.map((t) => `"${t}"`).join(", ")}]`);
  }
  if (metadata.author) {
    lines.push(`author: ${metadata.author}`);
  }
  if (metadata.stage) {
    lines.push(`stage: ${metadata.stage}`);
  }
  if (metadata.sourceArtifactId) {
    lines.push(`sourceArtifactId: ${metadata.sourceArtifactId}`);
  }

  lines.push("---");
  return lines.join("\n");
}

// Build Markdown content from sections
function buildSections(sections: ArtifactSection[]): string {
  return sections
    .map((section) => {
      const hashes = "#".repeat(section.level);
      return `${hashes} ${section.heading}\n\n${section.content}`;
    })
    .join("\n\n");
}

// Build AI notes section
function buildAINotes(notes: ArtifactAINote[]): string {
  if (notes.length === 0) return "";

  const lines = ["\n\n---\n\n## AI Notes\n"];
  
  notes.forEach((note) => {
    lines.push(`### ${note.provider}${note.model ? ` (${note.model})` : ""}`);
    lines.push(`*${note.timestamp}*${note.confidence !== undefined ? ` | Confidence: ${note.confidence}` : ""}`);
    lines.push("");
    lines.push(note.note);
    lines.push("");
  });

  return lines.join("\n");
}

// Parse sections from Markdown body
function parseSections(body: string): ArtifactSection[] {
  const sections: ArtifactSection[] = [];
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const matches = [...body.matchAll(headingRegex)];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const nextMatch = matches[i + 1];
    const level = match[1].length as 1 | 2 | 3 | 4 | 5 | 6;
    const heading = match[2].trim();
    
    // Skip AI Notes section
    if (heading === "AI Notes") break;

    const startIndex = match.index! + match[0].length;
    const endIndex = nextMatch?.index ?? body.indexOf("---", startIndex);
    const content = body
      .substring(startIndex, endIndex > startIndex ? endIndex : undefined)
      .trim();

    sections.push({
      id: randomUUID(),
      heading,
      level,
      content,
    });
  }

  return sections;
}

// Parse AI notes from Markdown body
function parseAINotes(body: string): ArtifactAINote[] {
  const notes: ArtifactAINote[] = [];
  const aiNotesIndex = body.indexOf("## AI Notes");
  
  if (aiNotesIndex === -1) return notes;

  const aiSection = body.substring(aiNotesIndex);
  const noteRegex = /### (\w+)(?:\s+\(([^)]+)\))?\n\*([^*]+)\*(?:\s+\|\s+Confidence:\s+([\d.]+))?\n\n([\s\S]*?)(?=###|$)/g;
  
  let match;
  while ((match = noteRegex.exec(aiSection)) !== null) {
    notes.push({
      id: randomUUID(),
      provider: match[1].toLowerCase() as ArtifactAINote["provider"],
      model: match[2] || undefined,
      timestamp: match[3].trim(),
      confidence: match[4] ? parseFloat(match[4]) : undefined,
      note: match[5].trim(),
    });
  }

  return notes;
}

// Build complete Markdown content
function buildMarkdown(artifact: Artifact): string {
  const frontmatter = buildFrontmatter(artifact.metadata);
  const sections = buildSections(artifact.sections);
  const aiNotes = buildAINotes(artifact.aiNotes);
  
  return `${frontmatter}\n\n${sections}${aiNotes}`;
}

// Parse complete Markdown content
function parseMarkdown(content: string, filePath: string): Artifact {
  const { metadata, body } = parseFrontmatter(content);
  
  return {
    metadata: {
      id: metadata.id as string,
      title: metadata.title as string,
      module: metadata.module as string,
      version: metadata.version as number,
      createdAt: metadata.createdAt as string,
      updatedAt: metadata.updatedAt as string,
      parentId: metadata.parentId as string | undefined,
      tags: metadata.tags as string[] | undefined,
      author: metadata.author as string | undefined,
      stage: metadata.stage as PipelineStage | undefined,
      sourceArtifactId: metadata.sourceArtifactId as string | undefined,
    },
    sections: parseSections(body),
    aiNotes: parseAINotes(body),
    rawContent: content,
  };
}

export class ArtifactService {
  // Create a new artefact
  async create(input: CreateArtifactInput): Promise<Artifact> {
    await ensureArtifactsDir();

    const now = new Date().toISOString();
    const id = randomUUID();
    const slug = slugify(input.title);

    // Ensure module directory exists
    const moduleDir = path.join(ARTIFACTS_DIR, input.module);
    await fs.mkdir(moduleDir, { recursive: true });

    const metadata: ArtifactMetadata = {
      id,
      title: input.title,
      module: input.module,
      version: 1,
      createdAt: now,
      updatedAt: now,
      tags: input.tags,
      author: input.author,
      stage: input.stage,
      sourceArtifactId: input.sourceArtifactId,
    };

    const sections: ArtifactSection[] = input.sections.map((s) => ({
      ...s,
      id: randomUUID(),
    }));

    const aiNotes: ArtifactAINote[] = (input.aiNotes || []).map((n) => ({
      ...n,
      id: randomUUID(),
      timestamp: now,
    }));

    const artifact: Artifact = {
      metadata,
      sections,
      aiNotes,
      rawContent: "",
    };

    artifact.rawContent = buildMarkdown(artifact);

    const filePath = getArtifactPath(input.module, slug, 1);
    await fs.writeFile(filePath, artifact.rawContent, "utf-8");

    return artifact;
  }

  // Read an artefact by ID
  async getById(id: string): Promise<Artifact | null> {
    await ensureArtifactsDir();

    const files = await this.getAllFiles();
    
    for (const file of files) {
      const content = await fs.readFile(file, "utf-8");
      const { metadata } = parseFrontmatter(content);
      
      if (metadata.id === id) {
        return parseMarkdown(content, file);
      }
    }

    return null;
  }

  // Read an artefact by path
  async getByPath(filePath: string): Promise<Artifact | null> {
    try {
      const fullPath = path.isAbsolute(filePath) 
        ? filePath 
        : path.join(ARTIFACTS_DIR, filePath);
      const content = await fs.readFile(fullPath, "utf-8");
      return parseMarkdown(content, fullPath);
    } catch {
      return null;
    }
  }

  // Update an artefact (creates new version)
  async update(id: string, input: UpdateArtifactInput): Promise<Artifact | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const newVersion = existing.metadata.version + 1;
    const newId = randomUUID();
    const slug = slugify(input.title || existing.metadata.title);

    const metadata: ArtifactMetadata = {
      id: newId,
      title: input.title || existing.metadata.title,
      module: existing.metadata.module,
      version: newVersion,
      createdAt: existing.metadata.createdAt,
      updatedAt: now,
      parentId: id,
      tags: input.tags || existing.metadata.tags,
      author: existing.metadata.author,
    };

    const sections: ArtifactSection[] = input.sections
      ? input.sections.map((s) => ({ ...s, id: randomUUID() }))
      : existing.sections;

    const aiNotes: ArtifactAINote[] = input.aiNotes
      ? [
          ...existing.aiNotes,
          ...input.aiNotes.map((n) => ({
            ...n,
            id: randomUUID(),
            timestamp: now,
          })),
        ]
      : existing.aiNotes;

    const artifact: Artifact = {
      metadata,
      sections,
      aiNotes,
      rawContent: "",
    };

    artifact.rawContent = buildMarkdown(artifact);

    const filePath = getArtifactPath(existing.metadata.module, slug, newVersion);
    await fs.writeFile(filePath, artifact.rawContent, "utf-8");

    return artifact;
  }

  // Get version history for an artefact
  async getVersionHistory(id: string): Promise<ArtifactVersion[]> {
    const artifact = await this.getById(id);
    if (!artifact) return [];

    const versions: ArtifactVersion[] = [];
    let currentId: string | undefined = id;

    // Walk back through parent chain
    while (currentId) {
      const current = await this.getById(currentId);
      if (!current) break;

      const slug = slugify(current.metadata.title);
      versions.push({
        version: current.metadata.version,
        id: current.metadata.id,
        createdAt: current.metadata.updatedAt,
        path: getArtifactPath(current.metadata.module, slug, current.metadata.version),
      });

      currentId = current.metadata.parentId;
    }

    // Also find all versions that reference this as parent
    const allFiles = await this.getAllFiles();
    for (const file of allFiles) {
      const content = await fs.readFile(file, "utf-8");
      const { metadata } = parseFrontmatter(content);
      
      if (metadata.parentId === id && !versions.find((v) => v.id === metadata.id)) {
        const slug = slugify(metadata.title as string);
        versions.push({
          version: metadata.version as number,
          id: metadata.id as string,
          createdAt: metadata.updatedAt as string,
          path: getArtifactPath(metadata.module as string, slug, metadata.version as number),
        });
      }
    }

    return versions.sort((a, b) => a.version - b.version);
  }

  // List all artefacts
  async list(module?: string): Promise<ArtifactListItem[]> {
    await ensureArtifactsDir();

    const files = await this.getAllFiles(module);
    const items: ArtifactListItem[] = [];

    for (const file of files) {
      const content = await fs.readFile(file, "utf-8");
      const { metadata } = parseFrontmatter(content);

      items.push({
        id: metadata.id as string,
        title: metadata.title as string,
        module: metadata.module as string,
        version: metadata.version as number,
        createdAt: metadata.createdAt as string,
        updatedAt: metadata.updatedAt as string,
        path: file.replace(ARTIFACTS_DIR + "/", ""),
        stage: metadata.stage as PipelineStage | undefined,
        sourceArtifactId: metadata.sourceArtifactId as string | undefined,
      });
    }

    return items.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  // Get artefact reference for module passing
  async getReference(id: string): Promise<ArtifactReference | null> {
    const artifact = await this.getById(id);
    if (!artifact) return null;

    const slug = slugify(artifact.metadata.title);
    
    return {
      id: artifact.metadata.id,
      version: artifact.metadata.version,
      module: artifact.metadata.module,
      title: artifact.metadata.title,
      path: getArtifactPath(artifact.metadata.module, slug, artifact.metadata.version),
    };
  }

  // Get all .md files in artifacts directory
  private async getAllFiles(module?: string): Promise<string[]> {
    const searchDir = module ? path.join(ARTIFACTS_DIR, module) : ARTIFACTS_DIR;
    const files: string[] = [];

    try {
      const entries = await fs.readdir(searchDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(searchDir, entry.name);
        
        if (entry.isDirectory() && !module) {
          const subFiles = await this.getAllFiles(entry.name);
          files.push(...subFiles);
        } else if (entry.isFile() && entry.name.endsWith(".md")) {
          files.push(fullPath);
        }
      }
    } catch {
      // Directory doesn't exist yet
    }

    return files;
  }
}

export const artifactService = new ArtifactService();
