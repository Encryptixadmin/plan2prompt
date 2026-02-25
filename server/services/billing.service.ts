import { storage } from "../storage";

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

function getCurrentYearMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function dbPlanToBillingPlanId(dbPlan: string): string {
  if (dbPlan === "professional") return "pro";
  if (dbPlan === "starter") return "free";
  return dbPlan;
}

function billingPlanIdToDbPlan(planId: string): "free" | "starter" | "professional" | "team" {
  if (planId === "pro") return "professional";
  return planId as "free" | "team";
}

class BillingService {
  getAllPlans(): BillingPlan[] {
    return Array.from(BILLING_PLANS.values());
  }

  getPlan(planId: string): BillingPlan | undefined {
    return BILLING_PLANS.get(planId);
  }

  async getUserPlanId(userId: string): Promise<string> {
    const user = await storage.getUser(userId);
    const rawPlan = user?.billingPlan ?? "free";
    return dbPlanToBillingPlanId(rawPlan);
  }

  async setUserPlan(userId: string, planId: string): Promise<void> {
    const dbPlan = billingPlanIdToDbPlan(planId);
    await storage.updateUserBillingPlan(userId, dbPlan);
  }

  async getUserBillingInfo(userId: string): Promise<UserBillingInfo> {
    const planId = await this.getUserPlanId(userId);
    const plan = this.getPlan(planId) || BILLING_PLANS.get("free")!;
    const yearMonth = getCurrentYearMonth();
    const usageRecord = await storage.getBillingUsage(userId, yearMonth);

    const generationsThisMonth = usageRecord?.generationsCount ?? 0;
    const tokensThisMonth = usageRecord?.tokensCount ?? 0;

    const warnings: string[] = [];

    const genPercentage = (generationsThisMonth / plan.softLimits.monthlyGenerations) * 100;
    const tokenPercentage = (tokensThisMonth / plan.softLimits.monthlyTokenBudget) * 100;

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
        generationsThisMonth,
        tokensThisMonth,
      },
      softLimits: plan.softLimits,
      warnings,
    };
  }

  async recordGeneration(userId: string, tokenCount: number): Promise<void> {
    const yearMonth = getCurrentYearMonth();
    await storage.incrementBillingUsage(userId, yearMonth, tokenCount);
  }

  async getUsageByPlan(): Promise<Record<string, { userCount: number; totalGenerations: number; totalTokens: number }>> {
    const yearMonth = getCurrentYearMonth();
    const rows = await storage.getBillingUsageByPlan(yearMonth);

    const result: Record<string, { userCount: number; totalGenerations: number; totalTokens: number }> = {};
    Array.from(BILLING_PLANS.values()).forEach((plan) => {
      result[plan.id] = { userCount: 0, totalGenerations: 0, totalTokens: 0 };
    });

    for (const row of rows) {
      if (!result[row.planId]) {
        result[row.planId] = { userCount: 0, totalGenerations: 0, totalTokens: 0 };
      }
      result[row.planId].userCount += row.userCount;
      result[row.planId].totalGenerations += row.totalGenerations;
      result[row.planId].totalTokens += row.totalTokens;
    }

    return result;
  }
}

export const billingService = new BillingService();
