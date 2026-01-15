export type PlanStatus = "active" | "legacy";

export interface BillingPlan {
  id: string;
  name: string;
  description: string;
  softLimits: {
    monthlyGenerations: number;
    monthlyTokenBudget: number;
  };
  status: PlanStatus;
}

export interface UserBillingInfo {
  planId: string;
  planName: string;
  currentUsage: {
    generationsThisMonth: number;
    tokensThisMonth: number;
  };
  softLimits: {
    monthlyGenerations: number;
    monthlyTokenBudget: number;
  };
  warnings: string[];
}

const BILLING_PLANS: Map<string, BillingPlan> = new Map([
  ["free", {
    id: "free",
    name: "Free",
    description: "Get started with essential features. Perfect for exploring and personal projects.",
    softLimits: {
      monthlyGenerations: 10,
      monthlyTokenBudget: 50000,
    },
    status: "active" as PlanStatus,
  }],
  ["pro", {
    id: "pro",
    name: "Pro",
    description: "For serious builders. Higher limits and priority support.",
    softLimits: {
      monthlyGenerations: 100,
      monthlyTokenBudget: 500000,
    },
    status: "active" as PlanStatus,
  }],
  ["team", {
    id: "team",
    name: "Team",
    description: "For growing teams. Collaboration features and shared billing.",
    softLimits: {
      monthlyGenerations: 500,
      monthlyTokenBudget: 2000000,
    },
    status: "active" as PlanStatus,
  }],
]);

interface UserUsageTracker {
  generationsThisMonth: number;
  tokensThisMonth: number;
  lastResetMonth: number;
}

class BillingService {
  private userPlans: Map<string, string> = new Map();
  private userUsage: Map<string, UserUsageTracker> = new Map();

  constructor() {
    this.initializeDefaultUsers();
  }

  private initializeDefaultUsers(): void {
    this.userPlans.set("default-user", "free");
    this.userPlans.set("user-alice", "free");
    this.userPlans.set("user-bob", "free");
    this.userPlans.set("user-carol", "free");

    const currentMonth = new Date().getMonth();
    this.userUsage.set("default-user", { generationsThisMonth: 3, tokensThisMonth: 12500, lastResetMonth: currentMonth });
    this.userUsage.set("user-alice", { generationsThisMonth: 8, tokensThisMonth: 32000, lastResetMonth: currentMonth });
    this.userUsage.set("user-bob", { generationsThisMonth: 2, tokensThisMonth: 8000, lastResetMonth: currentMonth });
    this.userUsage.set("user-carol", { generationsThisMonth: 0, tokensThisMonth: 0, lastResetMonth: currentMonth });
  }

  getAllPlans(): BillingPlan[] {
    return Array.from(BILLING_PLANS.values());
  }

  getPlan(planId: string): BillingPlan | undefined {
    return BILLING_PLANS.get(planId);
  }

  getUserPlanId(userId: string): string {
    return this.userPlans.get(userId) || "free";
  }

  private getUserUsage(userId: string): UserUsageTracker {
    const currentMonth = new Date().getMonth();
    let usage = this.userUsage.get(userId);

    if (!usage) {
      usage = { generationsThisMonth: 0, tokensThisMonth: 0, lastResetMonth: currentMonth };
      this.userUsage.set(userId, usage);
    }

    if (usage.lastResetMonth !== currentMonth) {
      usage.generationsThisMonth = 0;
      usage.tokensThisMonth = 0;
      usage.lastResetMonth = currentMonth;
    }

    return usage;
  }

  getUserBillingInfo(userId: string): UserBillingInfo {
    const planId = this.getUserPlanId(userId);
    const plan = this.getPlan(planId) || BILLING_PLANS.get("free")!;
    const usage = this.getUserUsage(userId);

    const warnings: string[] = [];

    const genPercentage = (usage.generationsThisMonth / plan.softLimits.monthlyGenerations) * 100;
    const tokenPercentage = (usage.tokensThisMonth / plan.softLimits.monthlyTokenBudget) * 100;

    if (genPercentage >= 80 && genPercentage < 100) {
      warnings.push(`You've used ${Math.round(genPercentage)}% of your monthly generations.`);
    } else if (genPercentage >= 100) {
      warnings.push(`You've reached your monthly generation limit. Upgraded plans coming soon.`);
    }

    if (tokenPercentage >= 80 && tokenPercentage < 100) {
      warnings.push(`You've used ${Math.round(tokenPercentage)}% of your monthly token budget.`);
    } else if (tokenPercentage >= 100) {
      warnings.push(`You've reached your monthly token budget. Upgraded plans coming soon.`);
    }

    return {
      planId: plan.id,
      planName: plan.name,
      currentUsage: {
        generationsThisMonth: usage.generationsThisMonth,
        tokensThisMonth: usage.tokensThisMonth,
      },
      softLimits: plan.softLimits,
      warnings,
    };
  }

  recordGeneration(userId: string, tokenCount: number): void {
    const usage = this.getUserUsage(userId);
    usage.generationsThisMonth++;
    usage.tokensThisMonth += tokenCount;
  }

  getUsageByPlan(): Record<string, { userCount: number; totalGenerations: number; totalTokens: number }> {
    const result: Record<string, { userCount: number; totalGenerations: number; totalTokens: number }> = {};

    Array.from(BILLING_PLANS.values()).forEach(plan => {
      result[plan.id] = { userCount: 0, totalGenerations: 0, totalTokens: 0 };
    });

    Array.from(this.userPlans.entries()).forEach(([userId, planId]) => {
      const usage = this.getUserUsage(userId);
      if (!result[planId]) {
        result[planId] = { userCount: 0, totalGenerations: 0, totalTokens: 0 };
      }
      result[planId].userCount++;
      result[planId].totalGenerations += usage.generationsThisMonth;
      result[planId].totalTokens += usage.tokensThisMonth;
    });

    return result;
  }
}

export const billingService = new BillingService();
