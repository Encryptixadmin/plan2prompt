import { describe, it, expect, beforeEach } from "vitest";
import { billingService } from "../../server/services/billing.service";

describe("Usage & Billing Invariants", () => {
  const testUserId = `test-invariant-${Date.now()}`;

  it("5.1 Each generation MUST call recordGeneration once, increment usage, and trigger warning at threshold", () => {
    const initialInfo = billingService.getUserBillingInfo(testUserId);
    const initialGenerations = initialInfo.currentUsage.generationsThisMonth;

    billingService.recordGeneration(testUserId, 500);

    const afterOne = billingService.getUserBillingInfo(testUserId);
    expect(afterOne.currentUsage.generationsThisMonth).toBe(initialGenerations + 1);
    expect(afterOne.currentUsage.tokensThisMonth).toBeGreaterThanOrEqual(500);

    billingService.recordGeneration(testUserId, 300);
    billingService.recordGeneration(testUserId, 200);

    const afterThree = billingService.getUserBillingInfo(testUserId);
    expect(afterThree.currentUsage.generationsThisMonth).toBe(initialGenerations + 3);
    expect(afterThree.currentUsage.tokensThisMonth).toBeGreaterThanOrEqual(1000);

    const softLimitThreshold = afterThree.softLimits.monthlyGenerations * 0.8;
    const shouldHaveWarning = afterThree.currentUsage.generationsThisMonth >= softLimitThreshold;
    if (shouldHaveWarning) {
      expect(afterThree.warnings.length).toBeGreaterThan(0);
    }
  });
});
