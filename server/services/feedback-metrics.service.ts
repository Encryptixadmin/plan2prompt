import { randomUUID, createHash } from "crypto";
import type {
  IDEType,
  FeedbackInstructionType,
} from "@shared/types/prompts";
import {
  promptFeedbackEvents,
  type PromptFeedbackEvent,
  type FeedbackClassification,
  type FeedbackInstructionType as DbFeedbackInstructionType,
} from "@shared/schema";
import { db } from "../db";
import { desc, eq, sql } from "drizzle-orm";

class FeedbackMetricsService {
  private eventCache: PromptFeedbackEvent[] = [];
  private readonly MAX_CACHE = 1000;

  async recordEvent(params: {
    userId: string;
    projectId: string;
    promptArtifactId: string;
    promptStepNumber: number;
    ide: IDEType;
    classification: "known_failure" | "unknown_failure";
    failurePatternId?: string;
    instructionType: FeedbackInstructionType;
    rawOutput: string;
  }): Promise<PromptFeedbackEvent | null> {
    const id = randomUUID();
    const rawOutputHash = this.hashOutput(params.rawOutput);

    try {
      // Persist to database (authoritative storage)
      const [inserted] = await db
        .insert(promptFeedbackEvents)
        .values({
          id,
          userId: params.userId,
          projectId: params.projectId,
          promptArtifactId: params.promptArtifactId,
          promptStepNumber: params.promptStepNumber,
          ide: params.ide,
          classification: params.classification as FeedbackClassification,
          failurePatternId: params.failurePatternId ?? null,
          instructionType: params.instructionType as DbFeedbackInstructionType,
          rawOutputHash,
        })
        .returning();

      if (!inserted) {
        console.warn("[FeedbackMetrics] Database insert returned no result");
        return null;
      }

      const event: PromptFeedbackEvent = {
        id: inserted.id,
        timestamp: inserted.timestamp,
        userId: inserted.userId,
        projectId: inserted.projectId,
        promptArtifactId: inserted.promptArtifactId,
        promptStepNumber: inserted.promptStepNumber,
        ide: inserted.ide,
        classification: inserted.classification,
        failurePatternId: inserted.failurePatternId,
        instructionType: inserted.instructionType,
        rawOutputHash: inserted.rawOutputHash,
      };

      // Keep in-memory cache for quick access
      this.eventCache.push(event);
      if (this.eventCache.length > this.MAX_CACHE) {
        this.eventCache = this.eventCache.slice(-this.MAX_CACHE);
      }

      console.log(
        `[FeedbackMetrics] Event persisted: id=${event.id}, ` +
          `classification=${event.classification}, pattern=${event.failurePatternId || "none"}`
      );

      return event;
    } catch (error) {
      // Failure to persist feedback events must NOT block user recovery response
      console.warn(
        `[FeedbackMetrics] Failed to persist event: ${error instanceof Error ? error.message : error}`
      );
      return null;
    }
  }

  private hashOutput(rawOutput: string): string {
    return createHash("sha256")
      .update(rawOutput.trim().toLowerCase())
      .digest("hex")
      .substring(0, 16);
  }

  async getEventCount(): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(promptFeedbackEvents);
    return Number(result[0]?.count || 0);
  }

  async getEventsByClassification(classification: "known_failure" | "unknown_failure"): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(promptFeedbackEvents)
      .where(eq(promptFeedbackEvents.classification, classification));
    return Number(result[0]?.count || 0);
  }

  async getEventsByPattern(patternId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(promptFeedbackEvents)
      .where(eq(promptFeedbackEvents.failurePatternId, patternId));
    return Number(result[0]?.count || 0);
  }

  async getRecentEvents(limit: number = 100): Promise<PromptFeedbackEvent[]> {
    return await db
      .select()
      .from(promptFeedbackEvents)
      .orderBy(desc(promptFeedbackEvents.timestamp))
      .limit(limit);
  }

  async getHashClusters(): Promise<Map<string, number>> {
    const rows = await db
      .select({
        hash: promptFeedbackEvents.rawOutputHash,
        count: sql<number>`count(*)`,
      })
      .from(promptFeedbackEvents)
      .groupBy(promptFeedbackEvents.rawOutputHash);

    const clusters = new Map<string, number>();
    for (const row of rows) {
      clusters.set(row.hash, Number(row.count));
    }
    return clusters;
  }

  async getProjectsForHash(hash: string): Promise<Set<string>> {
    const rows = await db
      .select({ projectId: promptFeedbackEvents.projectId })
      .from(promptFeedbackEvents)
      .where(eq(promptFeedbackEvents.rawOutputHash, hash));

    return new Set(rows.map((r) => r.projectId));
  }
}

export const feedbackMetricsService = new FeedbackMetricsService();
