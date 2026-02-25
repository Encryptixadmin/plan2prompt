import { Router, Request, Response } from "express";
import { z } from "zod";
import { clarificationService } from "../services/clarification.service";
import { requireProjectContext } from "../middleware/project-context";

const router = Router();

router.get("/", requireProjectContext, async (req: Request, res: Response) => {
  try {
    const contracts = await clarificationService.listAllByProject(req.projectId!);
    res.json({ success: true, data: contracts });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: "LIST_ERROR", message: "Failed to list clarifications" },
    });
  }
});

router.get("/pending", requireProjectContext, async (req: Request, res: Response) => {
  try {
    const module = req.query.module as string | undefined;
    const contracts = module
      ? await clarificationService.listPendingByModule(req.projectId!, module)
      : await clarificationService.listPendingByProject(req.projectId!);
    
    const hasBlockers = contracts.some(c => c.severity === "blocker");
    
    res.json({
      success: true,
      data: { contracts, hasBlockers },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: "LIST_ERROR", message: "Failed to list pending clarifications" },
    });
  }
});

router.get("/blockers", requireProjectContext, async (req: Request, res: Response) => {
  try {
    const module = req.query.module as string | undefined;
    const hasBlockers = await clarificationService.hasBlockers(req.projectId!, module);
    res.json({ success: true, data: { hasBlockers } });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: "CHECK_ERROR", message: "Failed to check blockers" },
    });
  }
});

const resolveSchema = z.object({
  resolutionData: z.record(z.unknown()),
});

router.post("/:id/resolve", requireProjectContext, async (req: Request, res: Response) => {
  try {
    const validation = resolveSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid resolution data" },
      });
    }

    const contract = await clarificationService.resolve(
      req.params.id,
      validation.data.resolutionData
    );

    if (!contract) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Clarification contract not found" },
      });
    }

    res.json({ success: true, data: contract });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: "RESOLVE_ERROR", message: "Failed to resolve clarification" },
    });
  }
});

router.get("/resolved", requireProjectContext, async (req: Request, res: Response) => {
  try {
    const module = req.query.module as string | undefined;
    if (!module) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "module query param is required" },
      });
    }
    const contracts = await clarificationService.listResolvedByModule(req.projectId!, module);
    res.json({ success: true, data: contracts });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: "LIST_ERROR", message: "Failed to list resolved clarifications" },
    });
  }
});

router.post("/:id/dismiss", requireProjectContext, async (req: Request, res: Response) => {
  try {
    const contract = await clarificationService.dismiss(req.params.id);

    if (!contract) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Clarification contract not found" },
      });
    }

    res.json({ success: true, data: contract });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: "DISMISS_ERROR", message: "Failed to dismiss clarification" },
    });
  }
});

export default router;
