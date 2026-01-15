import { randomUUID, createHash } from "crypto";
import type {
  IDEType,
  PromptFeedbackEvent,
  FeedbackInstructionType,
} from "@shared/types/prompts";

class FeedbackMetricsService {
  private eventLog: PromptFeedbackEvent[] = [];
  private readonly MAX_EVENTS = 10000;

  recordEvent(params: {
    userId: string;
    projectId: string;
    promptArtifactId: string;
    promptStepNumber: number;
    ide: IDEType;
    classification: "known_failure" | "unknown_failure";
    failurePatternId?: string;
    instructionType: FeedbackInstructionType;
    rawOutput: string;
  }): PromptFeedbackEvent {
    const event: PromptFeedbackEvent = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      userId: params.userId,
      projectId: params.projectId,
      promptArtifactId: params.promptArtifactId,
      promptStepNumber: params.promptStepNumber,
      ide: params.ide,
      classification: params.classification,
      failurePatternId: params.failurePatternId,
      instructionType: params.instructionType,
      rawOutputHash: this.hashOutput(params.rawOutput),
    };

    this.eventLog.push(event);

    if (this.eventLog.length > this.MAX_EVENTS) {
      this.eventLog = this.eventLog.slice(-this.MAX_EVENTS);
    }

    console.log(
      `[FeedbackMetrics] Event recorded: id=${event.id}, ` +
        `classification=${event.classification}, pattern=${event.failurePatternId || "none"}`
    );

    return event;
  }

  private hashOutput(rawOutput: string): string {
    return createHash("sha256")
      .update(rawOutput.trim().toLowerCase())
      .digest("hex")
      .substring(0, 16);
  }

  getEventCount(): number {
    return this.eventLog.length;
  }

  getEventsByClassification(classification: "known_failure" | "unknown_failure"): number {
    return this.eventLog.filter((e) => e.classification === classification).length;
  }

  getEventsByPattern(patternId: string): number {
    return this.eventLog.filter((e) => e.failurePatternId === patternId).length;
  }

  getRecentEvents(limit: number = 100): PromptFeedbackEvent[] {
    return this.eventLog.slice(-limit);
  }

  getHashClusters(): Map<string, number> {
    const clusters = new Map<string, number>();
    for (const event of this.eventLog) {
      const count = clusters.get(event.rawOutputHash) || 0;
      clusters.set(event.rawOutputHash, count + 1);
    }
    return clusters;
  }

  getProjectsForHash(hash: string): Set<string> {
    const projects = new Set<string>();
    for (const event of this.eventLog) {
      if (event.rawOutputHash === hash) {
        projects.add(event.projectId);
      }
    }
    return projects;
  }
}

export const feedbackMetricsService = new FeedbackMetricsService();
