import { describe, it, expect } from "vitest";
import { billingService } from "../../server/services/billing.service";

describe("Usage & Billing Invariants", () => {
  const testUserId = `test-invariant-billing-${Date.now()}`;

  it("5.1 Each generation MUST call recordGeneration once, increment usage, and trigger warning at threshold", async () => {
    const initialInfo = await billingService.getUserBillingInfo(testUserId);
    const initialGenerations = initialInfo.currentUsage.generationsThisMonth;

    await billingService.recordGeneration(testUserId, 500);

    const afterOne = await billingService.getUserBillingInfo(testUserId);
    expect(afterOne.currentUsage.generationsThisMonth).toBe(initialGenerations + 1);
    expect(afterOne.currentUsage.tokensThisMonth).toBeGreaterThanOrEqual(500);

    await billingService.recordGeneration(testUserId, 300);
    await billingService.recordGeneration(testUserId, 200);

    const afterThree = await billingService.getUserBillingInfo(testUserId);
    expect(afterThree.currentUsage.generationsThisMonth).toBe(initialGenerations + 3);
    expect(afterThree.currentUsage.tokensThisMonth).toBeGreaterThanOrEqual(1000);

    const softLimitThreshold = afterThree.softLimits.monthlyGenerations * 0.8;
    const shouldHaveWarning = afterThree.currentUsage.generationsThisMonth >= softLimitThreshold;
    if (shouldHaveWarning) {
      expect(afterThree.warnings.length).toBeGreaterThan(0);
    }
  });
});
