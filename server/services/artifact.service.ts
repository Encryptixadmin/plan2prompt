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
  DownstreamArtifact,
} from "@shared/types/artifact";
import type { PipelineStage } from "@shared/types/pipeline";
import { storage } from "../storage";
import { db } from "../db";

const ARTIFACTS_DIR = path.join(process.cwd(), "artifacts");

// Generate a slug from title for file naming
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
}

// Build relative path for display (module/filename)
function buildRelativePath(module: string, filename: string): string {
  return `${module}/${filename}`;
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
  if (metadata.sourceArtifactVersion !== undefined) {
    lines.push(`sourceArtifactVersion: ${metadata.sourceArtifactVersion}`);
  }
  if (metadata.projectId) {
    lines.push(`projectId: ${metadata.projectId}`);
  }
  if (metadata.authorId) {
    lines.push(`authorId: ${metadata.authorId}`);
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
      sourceArtifactVersion: metadata.sourceArtifactVersion as number | undefined,
      projectId: metadata.projectId as string | undefined,
      authorId: metadata.authorId as string | undefined,
      stopAcknowledged: metadata.stopAcknowledged as boolean | undefined,
      stopAcknowledgedAt: metadata.stopAcknowledgedAt as string | undefined,
    },
    sections: parseSections(body),
    aiNotes: parseAINotes(body),
    rawContent: content,
  };
}

// Idempotent migration: scan filesystem artifacts/ dir and insert into DB if not already present
export async function migrateFilesystemArtifacts(): Promise<void> {
  try {
    await fs.access(ARTIFACTS_DIR);
  } catch {
    return;
  }

  const files = await getAllFilesFromDisk();
  let migrated = 0;

  for (const file of files) {
    try {
      const content = await fs.readFile(file, "utf-8");
      const { metadata } = parseFrontmatter(content);
      const id = metadata.id as string | undefined;
      if (!id) continue;

      const exists = await storage.artifactExistsById(id);
      if (exists) continue;

      const moduleName = metadata.module as string || path.basename(path.dirname(file));
      const filename = path.basename(file);

      await storage.insertArtifact({
        id,
        projectId: metadata.projectId as string | undefined,
        module: moduleName,
        filename,
        parentId: metadata.parentId as string | undefined,
        sourceArtifactId: metadata.sourceArtifactId as string | undefined,
        content,
        artifactMetadata: metadata,
      });
      migrated++;
    } catch {
      // Skip files that can't be parsed
    }
  }

  if (migrated > 0) {
    console.log(`[ArtifactService] Migrated ${migrated} filesystem artifact(s) to database`);
  }
}

async function getAllFilesFromDisk(module?: string): Promise<string[]> {
  const searchDir = module ? path.join(ARTIFACTS_DIR, module) : ARTIFACTS_DIR;
  const files: string[] = [];

  try {
    const entries = await fs.readdir(searchDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(searchDir, entry.name);

      if (entry.isDirectory() && !module) {
        const subFiles = await getAllFilesFromDisk(entry.name);
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

export class ArtifactService {
  // Create a new artefact
  async create(input: CreateArtifactInput): Promise<Artifact> {
    const now = new Date().toISOString();
    const id = randomUUID();
    const slug = slugify(input.title);

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
      sourceArtifactVersion: input.sourceArtifactVersion,
      projectId: input.projectId,
      authorId: input.authorId,
      stopAcknowledged: input.stopAcknowledged,
      stopAcknowledgedAt: input.stopAcknowledgedAt,
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
    const filename = `${slug}_v1.md`;

    await db.transaction(async (tx) => {
      await storage.insertArtifact({
        id,
        projectId: input.projectId,
        module: input.module,
        filename,
        parentId: undefined,
        sourceArtifactId: input.sourceArtifactId,
        content: artifact.rawContent,
        artifactMetadata: metadata as unknown as Record<string, unknown>,
      }, tx);
    });

    return artifact;
  }

  // Read an artefact by ID
  async getById(id: string): Promise<Artifact | null> {
    const record = await storage.getArtifactById(id);
    if (!record) return null;
    return parseMarkdown(record.content, "");
  }

  // Read an artefact by path (module/filename or absolute path)
  async getByPath(filePath: string): Promise<Artifact | null> {
    const filename = path.basename(filePath);
    const records = await storage.listAllArtifacts();
    const record = records.find((r) => r.filename === filename);
    if (record) return parseMarkdown(record.content, "");

    // Fallback: try filesystem for backward compatibility
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
    const filename = `${slug}_v${newVersion}.md`;

    await db.transaction(async (tx) => {
      await storage.insertArtifact({
        id: newId,
        projectId: existing.metadata.projectId,
        module: existing.metadata.module,
        filename,
        parentId: id,
        sourceArtifactId: existing.metadata.sourceArtifactId,
        content: artifact.rawContent,
        artifactMetadata: metadata as unknown as Record<string, unknown>,
      }, tx);
    });

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
      const record = await storage.getArtifactById(currentId);
      if (!record) break;
      const meta = parseMarkdown(record.content, "").metadata;

      versions.push({
        version: meta.version,
        id: meta.id,
        createdAt: meta.updatedAt,
        path: buildRelativePath(record.module, record.filename),
      });

      currentId = meta.parentId;
    }

    // Also find all versions that reference this artifact as parent
    const children = await storage.getArtifactsByParentId(id);
    for (const child of children) {
      if (!versions.find((v) => v.id === child.id)) {
        const meta = parseMarkdown(child.content, "").metadata;
        versions.push({
          version: meta.version,
          id: meta.id,
          createdAt: meta.updatedAt,
          path: buildRelativePath(child.module, child.filename),
        });
      }
    }

    return versions.sort((a, b) => a.version - b.version);
  }

  // List all artefacts
  async list(module?: string): Promise<ArtifactListItem[]> {
    const records = await storage.listAllArtifacts(module);
    return records.map((record) => {
      const meta = record.artifactMetadata as Record<string, unknown>;
      return {
        id: record.id,
        title: (meta.title as string) || record.filename,
        module: record.module,
        version: (meta.version as number) || 1,
        createdAt: (meta.createdAt as string) || record.createdAt.toISOString(),
        updatedAt: (meta.updatedAt as string) || record.createdAt.toISOString(),
        path: buildRelativePath(record.module, record.filename),
        stage: meta.stage as PipelineStage | undefined,
        sourceArtifactId: record.sourceArtifactId ?? undefined,
        projectId: record.projectId ?? undefined,
        authorId: meta.authorId as string | undefined,
      };
    });
  }

  // List artifacts filtered by project
  async listByProject(projectId: string, module?: string): Promise<ArtifactListItem[]> {
    const records = await storage.listArtifactsByProject(projectId, module);
    return records.map((record) => {
      const meta = record.artifactMetadata as Record<string, unknown>;
      return {
        id: record.id,
        title: (meta.title as string) || record.filename,
        module: record.module,
        version: (meta.version as number) || 1,
        createdAt: (meta.createdAt as string) || record.createdAt.toISOString(),
        updatedAt: (meta.updatedAt as string) || record.createdAt.toISOString(),
        path: buildRelativePath(record.module, record.filename),
        stage: meta.stage as PipelineStage | undefined,
        sourceArtifactId: record.sourceArtifactId ?? undefined,
        projectId: record.projectId ?? undefined,
        authorId: meta.authorId as string | undefined,
      };
    });
  }

  // Get artefact reference for module passing
  async getReference(id: string): Promise<ArtifactReference | null> {
    const record = await storage.getArtifactById(id);
    if (!record) return null;

    const meta = parseMarkdown(record.content, "").metadata;
    return {
      id: meta.id,
      version: meta.version,
      module: record.module,
      title: meta.title,
      path: buildRelativePath(record.module, record.filename),
    };
  }

  // Get downstream artifacts that were derived from this artifact
  async getDownstreamArtifacts(id: string): Promise<DownstreamArtifact[]> {
    const artifact = await this.getById(id);
    if (!artifact) return [];

    // Build the version chain for this artifact
    const versions = await this.getVersionHistory(id);
    const versionMap = new Map<string, number>();
    for (const v of versions) {
      versionMap.set(v.id, v.version);
    }
    if (!versionMap.has(id)) {
      versionMap.set(id, artifact.metadata.version);
    }

    const latestVersion = Math.max(...Array.from(versionMap.values()));
    const chainIds = Array.from(versionMap.keys());

    const downstream: DownstreamArtifact[] = [];

    for (const chainId of chainIds) {
      const derived = await storage.getArtifactsBySourceId(chainId);
      for (const record of derived) {
        const meta = parseMarkdown(record.content, "").metadata;
        let sourceVersion = meta.sourceArtifactVersion;
        if (sourceVersion === undefined && versionMap.has(chainId)) {
          sourceVersion = versionMap.get(chainId);
        }
        const isOutdated = sourceVersion !== undefined && sourceVersion < latestVersion;
        const derivedFromVersion = sourceVersion ?? artifact.metadata.version;

        if (!downstream.find((d) => d.id === record.id)) {
          downstream.push({
            id: record.id,
            title: meta.title,
            module: record.module,
            stage: meta.stage as PipelineStage | undefined,
            derivedFromVersion,
            isOutdated,
            outdatedReason: isOutdated
              ? `Derived from version ${derivedFromVersion}, but version ${latestVersion} is now available`
              : undefined,
          });
        }
      }
    }

    return downstream;
  }

  // Check if artifact has downstream dependencies
  async hasDownstreamDependencies(id: string): Promise<boolean> {
    const downstream = await this.getDownstreamArtifacts(id);
    return downstream.length > 0;
  }

  // Check if an artifact is outdated (its source artifact has a newer version)
  async isArtifactOutdated(id: string): Promise<{ outdated: boolean; reason?: string }> {
    const artifact = await this.getById(id);
    if (!artifact) return { outdated: false };

    const sourceArtifactId = artifact.metadata.sourceArtifactId;
    const sourceArtifactVersion = artifact.metadata.sourceArtifactVersion;

    if (!sourceArtifactId) return { outdated: false };

    const sourceArtifact = await this.getById(sourceArtifactId);
    if (!sourceArtifact) return { outdated: false };

    const versions = await this.getVersionHistory(sourceArtifactId);
    const latestVersion = Math.max(
      sourceArtifact.metadata.version,
      ...versions.map((v) => v.version)
    );

    if (sourceArtifactVersion !== undefined && sourceArtifactVersion < latestVersion) {
      return {
        outdated: true,
        reason: `This artifact was derived from version ${sourceArtifactVersion} of "${sourceArtifact.metadata.title}", but version ${latestVersion} is now available. Regenerate from the latest version.`,
      };
    }

    return { outdated: false };
  }
}

export const artifactService = new ArtifactService();
