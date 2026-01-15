import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CreditCard, AlertTriangle } from "lucide-react";

interface UserBillingInfo {
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

export function BillingStatus() {
  const { data, isLoading } = useQuery<{ success: boolean; data: UserBillingInfo }>({
    queryKey: ["/api/billing/my-plan"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-4">
          <div className="animate-pulse h-20 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const billingInfo = data?.data;
  if (!billingInfo) return null;

  const genPercent = Math.min(
    (billingInfo.currentUsage.generationsThisMonth / billingInfo.softLimits.monthlyGenerations) * 100,
    100
  );
  const tokenPercent = Math.min(
    (billingInfo.currentUsage.tokensThisMonth / billingInfo.softLimits.monthlyTokenBudget) * 100,
    100
  );

  return (
    <Card data-testid="card-billing-status">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Your Plan</CardTitle>
          </div>
          <Badge variant="secondary" className="capitalize">
            {billingInfo.planName}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          You're currently on the {billingInfo.planName} plan. Billing and upgrades are coming soon.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Generations this month</span>
            <span className="font-medium">
              {billingInfo.currentUsage.generationsThisMonth} / {billingInfo.softLimits.monthlyGenerations}
            </span>
          </div>
          <Progress value={genPercent} className="h-2" />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tokens used</span>
            <span className="font-medium">
              {billingInfo.currentUsage.tokensThisMonth.toLocaleString()} / {billingInfo.softLimits.monthlyTokenBudget.toLocaleString()}
            </span>
          </div>
          <Progress value={tokenPercent} className="h-2" />
        </div>

        {billingInfo.warnings.length > 0 && (
          <div className="pt-2 space-y-1">
            {billingInfo.warnings.map((warning, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
