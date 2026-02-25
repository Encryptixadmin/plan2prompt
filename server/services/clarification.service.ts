import { createHash } from "crypto";
import { storage } from "../storage";
import type {
  ClarificationContract,
  CreateClarificationRequest,
  ClarificationDetectionResult,
} from "@shared/types/clarification";
import type { ClarificationContractRecord } from "@shared/schema";

const LOOP_THRESHOLD = 3;

export class ClarificationService {
  computeHash(request: CreateClarificationRequest): string {
    const payload = JSON.stringify({
      module: request.originatingModule,
      category: request.category,
      upstreamArtifactId: request.upstreamArtifactId,
      title: request.title,
      affectedEntities: request.affectedEntities || {},
    });
    return createHash("sha256").update(payload).digest("hex").substring(0, 16);
  }

  async createOrIncrementContract(
    request: CreateClarificationRequest
  ): Promise<ClarificationContract> {
    const hash = this.computeHash(request);

    const existing = await storage.getClarificationByHash(request.projectId, hash);

    if (existing) {
      const updated = await storage.incrementClarificationOccurrence(existing.id);
      if (!updated) throw new Error("Failed to increment clarification occurrence");

      if (updated.occurrenceCount >= LOOP_THRESHOLD && updated.severity !== "blocker") {
        const escalated = await storage.escalateClarificationToBlocker(updated.id);
        if (escalated) {
          console.warn(
            `[ClarificationService] Loop detected: contract ${escalated.id} escalated to blocker (${escalated.occurrenceCount} occurrences)`
          );
          return this.recordToContract(escalated);
        }
      }

      return this.recordToContract(updated);
    }

    const record = await storage.createClarificationContract({
      projectId: request.projectId,
      originatingModule: request.originatingModule,
      currentArtifactId: request.currentArtifactId,
      currentArtifactVersion: request.currentArtifactVersion,
      upstreamArtifactId: request.upstreamArtifactId,
      upstreamArtifactVersion: request.upstreamArtifactVersion,
      severity: request.severity,
      category: request.category,
      title: request.title,
      description: request.description,
      affectedEntities: request.affectedEntities ? JSON.stringify(request.affectedEntities) : null,
      requiredClarifications: JSON.stringify(request.requiredClarifications),
      resolutionStatus: "pending",
      contractHash: hash,
      occurrenceCount: 1,
      resolutionData: null,
    });

    return this.recordToContract(record);
  }

  async listPendingByProject(projectId: string): Promise<ClarificationContract[]> {
    const records = await storage.listPendingClarificationsByProject(projectId);
    return records.map(r => this.recordToContract(r));
  }

  async listPendingByModule(projectId: string, module: string): Promise<ClarificationContract[]> {
    const records = await storage.listPendingClarificationsByModule(projectId, module);
    return records.map(r => this.recordToContract(r));
  }

  async listResolvedByModule(projectId: string, module: string): Promise<ClarificationContract[]> {
    const records = await storage.listResolvedClarificationsByModule(projectId, module);
    return records.map(r => this.recordToContract(r));
  }

  async listAllByProject(projectId: string): Promise<ClarificationContract[]> {
    const records = await storage.listClarificationsByProject(projectId);
    return records.map(r => this.recordToContract(r));
  }

  async hasBlockers(projectId: string, module?: string): Promise<boolean> {
    const pending = module
      ? await storage.listPendingClarificationsByModule(projectId, module)
      : await storage.listPendingClarificationsByProject(projectId);
    return pending.some(c => c.severity === "blocker");
  }

  async resolve(
    clarificationId: string,
    resolutionData: Record<string, unknown>
  ): Promise<ClarificationContract | null> {
    const updated = await storage.updateClarificationStatus(
      clarificationId,
      "resolved",
      JSON.stringify(resolutionData)
    );
    return updated ? this.recordToContract(updated) : null;
  }

  async dismiss(clarificationId: string): Promise<ClarificationContract | null> {
    const updated = await storage.updateClarificationStatus(clarificationId, "dismissed");
    return updated ? this.recordToContract(updated) : null;
  }

  async processDetectionResult(
    result: ClarificationDetectionResult
  ): Promise<ClarificationContract[]> {
    const created: ClarificationContract[] = [];
    for (const request of result.contracts) {
      const contract = await this.createOrIncrementContract(request);
      created.push(contract);
    }
    return created;
  }

  private recordToContract(record: ClarificationContractRecord): ClarificationContract {
    let affectedEntities;
    try {
      affectedEntities = record.affectedEntities ? JSON.parse(record.affectedEntities) : undefined;
    } catch {
      affectedEntities = undefined;
    }

    let requiredClarifications;
    try {
      requiredClarifications = JSON.parse(record.requiredClarifications);
    } catch {
      requiredClarifications = [];
    }

    let resolutionData;
    try {
      resolutionData = record.resolutionData ? JSON.parse(record.resolutionData) : undefined;
    } catch {
      resolutionData = undefined;
    }

    return {
      id: record.id,
      projectId: record.projectId,
      timestamp: record.timestamp.toISOString(),
      originatingModule: record.originatingModule as ClarificationContract["originatingModule"],
      currentArtifactId: record.currentArtifactId,
      currentArtifactVersion: record.currentArtifactVersion,
      upstreamArtifactId: record.upstreamArtifactId,
      upstreamArtifactVersion: record.upstreamArtifactVersion,
      severity: record.severity as ClarificationContract["severity"],
      category: record.category as ClarificationContract["category"],
      title: record.title,
      description: record.description,
      affectedEntities,
      requiredClarifications,
      resolutionStatus: record.resolutionStatus as ClarificationContract["resolutionStatus"],
      contractHash: record.contractHash,
      occurrenceCount: record.occurrenceCount,
      resolvedAt: record.resolvedAt?.toISOString(),
      resolutionData,
    };
  }
}

export const clarificationService = new ClarificationService();
