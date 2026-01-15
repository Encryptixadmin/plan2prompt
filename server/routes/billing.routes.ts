import { Router } from "express";
import { billingService } from "../services/billing.service";
import { isAuthenticated } from "../replit_integrations/auth";

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

router.get("/my-plan", isAuthenticated, async (req, res) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
    }
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
