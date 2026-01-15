import { describe, it, expect } from "vitest";

class MockBillingService {
  private records: number[] = [];
  private usage = 0;
  private softLimit = 10000;
  public warningTriggered = false;

  recordGeneration(tokens: number): void {
    this.records.push(tokens);
    const prevUsage = this.usage;
    this.usage += tokens;
    if (this.usage >= this.softLimit && prevUsage < this.softLimit) {
      this.warningTriggered = true;
    }
  }

  getRecordCount = () => this.records.length;
  getUsage = () => this.usage;
}

describe("Usage & Billing Invariants", () => {
  it("5.1 Each generation MUST call recordGeneration once, increment usage, and trigger warning at threshold", () => {
    const billing = new MockBillingService();

    billing.recordGeneration(500);
    expect(billing.getRecordCount()).toBe(1);
    expect(billing.getUsage()).toBe(500);

    billing.recordGeneration(300);
    billing.recordGeneration(200);
    expect(billing.getRecordCount()).toBe(3);
    expect(billing.getUsage()).toBe(1000);
    expect(billing.warningTriggered).toBe(false);

    billing.recordGeneration(9000);
    expect(billing.warningTriggered).toBe(true);
    expect(billing.getUsage()).toBe(10000);
  });
});
