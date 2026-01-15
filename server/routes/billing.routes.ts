import { Router } from "express";
import { billingService } from "../services/billing.service";

const router = Router();

router.get("/plans", async (_req, res) => {
  try {
    const plans = billingService.getAllPlans();
    res.json({
      success: true,
      data: { plans },
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "PLANS_ERROR",
        message: error instanceof Error ? error.message : "Failed to get billing plans",
      },
    });
  }
});

router.get("/my-plan", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string || "default-user";
    const billingInfo = billingService.getUserBillingInfo(userId);
    res.json({
      success: true,
      data: billingInfo,
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "BILLING_ERROR",
        message: error instanceof Error ? error.message : "Failed to get billing info",
      },
    });
  }
});

export default router;
