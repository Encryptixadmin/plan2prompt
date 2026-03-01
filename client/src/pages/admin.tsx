import { useState, useEffect } from "react";
import { usePageTitle } from "@/hooks/use-page-title";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Power,
  PowerOff,
  RefreshCw,
  Search,
  Shield,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";


interface ProviderStatus {
  provider: string;
  enabled: boolean;
  validated: boolean;
  validationError: string | null;
  modelId: string;
  configured: boolean;
  disabledAt?: string;
  disabledBy?: string;
  disabledReason?: string;
  errorCount: number;
  timeoutCount: number;
  retryCount: number;
  lastSuccessfulRequest?: string;
}

interface UsageSummary {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  byProvider: Record<string, { requests: number; inputTokens: number; outputTokens: number; cost: number }>;
}

interface AdminActionLog {
  id: string;
  adminUserId: string;
  actionType: string;
  targetType: string;
  targetId: string;
  reason?: string;
  previousState?: string;
  newState?: string;
  timestamp: string;
}

interface ArtifactIntegrity {
  stageCounts: Record<string, number>;
  totalArtifacts: number;
  stopRecommendations: {
    issued: number;
    overridden: number;
  };
}

interface UserSummary {
  id: string;
  username: string;
  email?: string;
  role: "viewer" | "collaborator" | "owner" | "admin";
  isAdmin: boolean;
  generationDisabled: boolean;
  generationDisabledReason?: string;
  projectCount: number;
  lastActivityAt?: string;
  usageSummary: {
    totalRequests: number;
    estimatedCost: number;
  };
  billingPlan: string;
  createdAt: string;
}

interface ProjectSummary {
  id: string;
  name: string;
  description?: string;
  ownerName?: string;
  memberCount: number;
  generationDisabled: boolean;
  generationDisabledReason?: string;
  artifactCount: number;
  createdAt: string;
}

interface BillingPlan {
  id: string;
  name: string;
  description: string;
  softLimits: {
    monthlyGenerations: number;
    monthlyTokenBudget: number;
  };
  status: "active" | "legacy";
}

interface PlanUsage {
  userCount: number;
  totalGenerations: number;
  totalTokens: number;
}

interface DashboardStats {
  totalUsers: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  totalProjects: number;
  totalArtifacts: number;
  totalGenerations: number;
  recentSignups: Array<{
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    billingPlan: string;
    createdAt: string;
  }>;
  userGrowth: Array<{
    month: string;
    count: number;
  }>;
  planDistribution: Array<{
    plan: string;
    count: number;
  }>;
}

function StatCard({ title, value, subtitle, icon: Icon, trend }: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: { value: number; label: string };
}) {
  return (
    <Card data-testid={`stat-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className="rounded-lg bg-primary/10 p-2.5">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
        {trend && (
          <div className="mt-3 flex items-center gap-1 text-xs">
            <TrendingUp className="h-3 w-3 text-green-600" />
            <span className="font-medium text-green-600">+{trend.value}</span>
            <span className="text-muted-foreground">{trend.label}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GrowthChart({ data }: { data: Array<{ month: string; count: number }> }) {
  if (!data || data.length === 0) return null;
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const recent = data.slice(-12);

  return (
    <Card data-testid="chart-user-growth">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">User Growth</CardTitle>
        <CardDescription>Monthly signups over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-1.5 h-32">
          {recent.map((d) => (
            <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] font-medium text-muted-foreground">{d.count}</span>
              <div
                className="w-full bg-primary/80 rounded-t transition-all hover:bg-primary"
                style={{ height: `${Math.max((d.count / maxCount) * 100, 4)}%` }}
                title={`${d.month}: ${d.count} users`}
              />
              <span className="text-[9px] text-muted-foreground truncate w-full text-center">
                {d.month.slice(5)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PlanDistributionChart({ data }: { data: Array<{ plan: string; count: number }> }) {
  if (!data || data.length === 0) return null;
  const total = data.reduce((s, d) => s + d.count, 0);
  const colors: Record<string, string> = {
    free: "bg-slate-400",
    starter: "bg-blue-400",
    professional: "bg-indigo-500",
    pro: "bg-indigo-500",
    team: "bg-purple-500",
  };
  const labels: Record<string, string> = {
    free: "Free",
    starter: "Starter",
    professional: "Pro",
    pro: "Pro",
    team: "Team",
  };

  return (
    <Card data-testid="chart-plan-distribution">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Plan Distribution</CardTitle>
        <CardDescription>{total} total users</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex h-3 rounded-full overflow-hidden bg-muted">
          {data.map((d) => (
            <div
              key={d.plan}
              className={`${colors[d.plan] || "bg-gray-400"} transition-all`}
              style={{ width: `${(d.count / total) * 100}%` }}
              title={`${labels[d.plan] || d.plan}: ${d.count}`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          {data.map((d) => (
            <div key={d.plan} className="flex items-center gap-1.5 text-xs">
              <div className={`h-2.5 w-2.5 rounded-full ${colors[d.plan] || "bg-gray-400"}`} />
              <span className="text-muted-foreground">{labels[d.plan] || d.plan}</span>
              <span className="font-medium">{d.count}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewPanel() {
  const { data, isLoading } = useQuery<{ success: boolean; data: DashboardStats }>({
    queryKey: ["/api/admin/dashboard/stats"],
  });

  const stats = data?.data;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="animate-pulse h-28 bg-muted rounded-lg" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="animate-pulse h-48 bg-muted rounded-lg" />
          <div className="animate-pulse h-48 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6" data-testid="panel-overview-content">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Users"
          value={stats.totalUsers}
          icon={Users}
          trend={stats.newUsersThisWeek > 0 ? { value: stats.newUsersThisWeek, label: "this week" } : undefined}
        />
        <StatCard
          title="New This Month"
          value={stats.newUsersThisMonth}
          icon={UserPlus}
          subtitle="Last 30 days"
        />
        <StatCard
          title="Active Projects"
          value={stats.totalProjects}
          icon={FolderKanban}
        />
        <StatCard
          title="Total Generations"
          value={stats.totalGenerations}
          icon={BarChart3}
          subtitle={`${stats.totalArtifacts} artifacts`}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <GrowthChart data={stats.userGrowth} />
        <PlanDistributionChart data={stats.planDistribution} />
      </div>

      <Card data-testid="card-recent-signups">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent Signups</CardTitle>
              <CardDescription>Latest users who joined the platform</CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              <UserPlus className="h-3 w-3 mr-1" />
              {stats.recentSignups.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {stats.recentSignups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No signups yet</p>
          ) : (
            <div className="space-y-3">
              {stats.recentSignups.map((user) => (
                <div key={user.id} className="flex items-center justify-between py-2 border-b last:border-0" data-testid={`signup-${user.id}`}>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-medium text-primary">
                        {(user.firstName?.[0] || user.email?.[0] || "?").toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {[user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Anonymous"}
                      </p>
                      {user.email && (
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs capitalize">{user.billingPlan}</Badge>
                    <span className="text-xs text-muted-foreground">{formatTimeAgo(user.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface ProviderHealthPanelProps {
  onActionStateChange?: (isActive: boolean) => void;
}

function ProviderHealthPanel({ onActionStateChange }: ProviderHealthPanelProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [disableReason, setDisableReason] = useState("");
  const [hasOpenDialog, setHasOpenDialog] = useState(false);

  useEffect(() => {
    onActionStateChange?.(hasOpenDialog);
  }, [hasOpenDialog, onActionStateChange]);

  const { data: healthData, isLoading } = useQuery<{ success: boolean; data: { providers: ProviderStatus[] } }>({
    queryKey: ["/api/admin/health"],
  });

  const disableProvider = useMutation({
    mutationFn: async ({ provider, reason }: { provider: string; reason: string }) => {
      const response = await apiRequest("POST", `/api/admin/providers/${provider}/disable`, { reason, confirm: true });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/health"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/actions"] });
      toast({ title: "Provider disabled", description: "The AI provider has been disabled." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    },
  });

  const enableProvider = useMutation({
    mutationFn: async (provider: string) => {
      const response = await apiRequest("POST", `/api/admin/providers/${provider}/enable`, { confirm: true });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/health"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/actions"] });
      toast({ title: "Provider enabled", description: "The AI provider has been enabled." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    },
  });

  const providers = healthData?.data?.providers || [];

  if (isLoading) {
    return <div className="animate-pulse h-40 bg-muted rounded-lg" data-testid="loading-providers" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">AI Providers</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/health"] })}
          data-testid="button-refresh-providers"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {providers.map((provider) => (
          <Card key={provider.provider} data-testid={`card-provider-${provider.provider}`}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base capitalize">{provider.provider}</CardTitle>
                <CardDescription className="text-xs font-mono">
                  {provider.modelId}
                </CardDescription>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge 
                  variant={provider.validated ? "default" : (provider.configured ? "destructive" : "secondary")} 
                  data-testid={`badge-validation-${provider.provider}`}
                >
                  {provider.validated ? <CheckCircle className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                  {provider.validated 
                    ? (provider.configured ? "Validated" : "Mock Mode") 
                    : "Invalid"}
                </Badge>
                <Badge variant={provider.enabled ? "outline" : "secondary"} className="text-xs">
                  {provider.enabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {provider.validationError && (
                <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive" data-testid={`validation-error-${provider.provider}`}>
                  {provider.validationError}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center p-2 bg-muted rounded">
                  <div className="font-semibold text-destructive">{provider.errorCount}</div>
                  <div className="text-muted-foreground">Errors</div>
                </div>
                <div className="text-center p-2 bg-muted rounded">
                  <div className="font-semibold text-amber-600">{provider.timeoutCount}</div>
                  <div className="text-muted-foreground">Timeouts</div>
                </div>
                <div className="text-center p-2 bg-muted rounded">
                  <div className="font-semibold">{provider.retryCount}</div>
                  <div className="text-muted-foreground">Retries</div>
                </div>
              </div>

              {provider.lastSuccessfulRequest && (
                <p className="text-xs text-muted-foreground">
                  Last success: {new Date(provider.lastSuccessfulRequest).toLocaleTimeString()}
                </p>
              )}

              {!provider.enabled && provider.disabledReason && (
                <p className="text-xs text-destructive">
                  Reason: {provider.disabledReason}
                </p>
              )}

              <div className="pt-2">
                {provider.enabled ? (
                  <AlertDialog onOpenChange={setHasOpenDialog}>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" className="w-full" data-testid={`button-disable-${provider.provider}`}>
                        <PowerOff className="h-4 w-4 mr-2" />
                        Disable Provider
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Disable {provider.provider}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will prevent this provider from being used in consensus operations. Existing content remains accessible.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="py-4">
                        <Label htmlFor="reason">Reason (optional)</Label>
                        <Input
                          id="reason"
                          value={disableReason}
                          onChange={(e) => setDisableReason(e.target.value)}
                          placeholder="Enter reason for disabling..."
                          data-testid="input-disable-reason"
                        />
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel data-testid="button-cancel-disable">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            disableProvider.mutate({ provider: provider.provider, reason: disableReason });
                            setDisableReason("");
                          }}
                          data-testid="button-confirm-disable"
                        >
                          Disable
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <AlertDialog onOpenChange={setHasOpenDialog}>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full" data-testid={`button-enable-${provider.provider}`}>
                        <Power className="h-4 w-4 mr-2" />
                        Enable Provider
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Enable {provider.provider}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will allow this provider to be used in consensus operations again.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel data-testid="button-cancel-enable">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => enableProvider.mutate(provider.provider)}
                          data-testid="button-confirm-enable"
                        >
                          Enable
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function UsagePanel() {
  const { data: usageData, isLoading } = useQuery<{ success: boolean; data: { summary: UsageSummary } }>({
    queryKey: ["/api/admin/usage"],
  });

  const summary = usageData?.data?.summary;

  if (isLoading) {
    return <div className="animate-pulse h-40 bg-muted rounded-lg" data-testid="loading-usage" />;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Usage Overview</h3>

      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="card-total-requests">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalRequests || 0}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-input-tokens">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Input Tokens</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(summary?.totalInputTokens || 0).toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-output-tokens">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Output Tokens</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(summary?.totalOutputTokens || 0).toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-total-cost">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Estimated Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center">
              <DollarSign className="h-5 w-5" />
              {(summary?.totalCost || 0).toFixed(4)}
            </div>
          </CardContent>
        </Card>
      </div>

      {summary?.byProvider && Object.keys(summary.byProvider).length > 0 && (
        <Card data-testid="card-usage-by-provider">
          <CardHeader>
            <CardTitle className="text-base">Usage by Provider</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Input Tokens</TableHead>
                  <TableHead className="text-right">Output Tokens</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(summary.byProvider).map(([provider, stats]) => (
                  <TableRow key={provider} data-testid={`row-usage-${provider}`}>
                    <TableCell className="font-medium capitalize">{provider}</TableCell>
                    <TableCell className="text-right">{stats.requests}</TableCell>
                    <TableCell className="text-right">{stats.inputTokens.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{stats.outputTokens.toLocaleString()}</TableCell>
                    <TableCell className="text-right">${stats.cost.toFixed(4)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ArtifactIntegrityPanel() {
  const { data, isLoading } = useQuery<{ success: boolean; data: ArtifactIntegrity }>({
    queryKey: ["/api/admin/artifacts/integrity"],
  });

  const integrity = data?.data;

  if (isLoading) {
    return <div className="animate-pulse h-40 bg-muted rounded-lg" data-testid="loading-integrity" />;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Artifact Pipeline Integrity</h3>

      <div className="grid gap-4 md:grid-cols-5">
        <Card data-testid="card-total-artifacts">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Artifacts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{integrity?.totalArtifacts || 0}</div>
          </CardContent>
        </Card>

        {integrity?.stageCounts && Object.entries(integrity.stageCounts).map(([stage, count]) => (
          <Card key={stage} data-testid={`card-stage-${stage}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stage.replace(/_/g, " ")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{count}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

interface UsersPanelProps {
  onActionStateChange?: (isActive: boolean) => void;
}

function UsersPanel({ onActionStateChange }: UsersPanelProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [disableReason, setDisableReason] = useState("");
  const [hasOpenDialog, setHasOpenDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");

  useEffect(() => {
    onActionStateChange?.(hasOpenDialog);
  }, [hasOpenDialog, onActionStateChange]);

  const { data, isLoading } = useQuery<{ success: boolean; data: { users: UserSummary[] } }>({
    queryKey: ["/api/admin/users"],
  });

  const disableGeneration = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      const response = await apiRequest("POST", `/api/admin/users/${userId}/disable-generation`, { reason, confirm: true });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/actions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard/stats"] });
      toast({ title: "Generation disabled", description: "The user can no longer generate new content." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    },
  });

  const enableGeneration = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("POST", `/api/admin/users/${userId}/enable-generation`, { confirm: true });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/actions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard/stats"] });
      toast({ title: "Generation enabled", description: "The user can now generate content again." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    },
  });

  const changePlan = useMutation({
    mutationFn: async ({ userId, planId }: { userId: string; planId: string }) => {
      const response = await apiRequest("POST", `/api/admin/users/${userId}/plan`, { planId, confirm: true });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/billing/usage-by-plan"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard/stats"] });
      toast({ title: "Plan updated", description: "The user's subscription plan has been changed." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    },
  });

  const allUsers = data?.data?.users || [];

  const filteredUsers = allUsers.filter(user => {
    const matchesSearch = !searchQuery || 
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesPlan = planFilter === "all" || user.billingPlan === planFilter;
    return matchesSearch && matchesPlan;
  });

  if (isLoading) {
    return <div className="animate-pulse h-40 bg-muted rounded-lg" data-testid="loading-users" />;
  }

  if (allUsers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground" data-testid="empty-users">
        <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No users found</p>
      </div>
    );
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin": return "default";
      case "owner": return "secondary";
      case "collaborator": return "outline";
      default: return "outline";
    }
  };

  const formatLastActivity = (timestamp?: string) => {
    if (!timestamp) return "Never";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const planDisplayName = (plan: string) => {
    const names: Record<string, string> = { free: "Free", starter: "Starter", professional: "Pro", team: "Team" };
    return names[plan] || plan;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold">User Management</h3>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {filteredUsers.length} of {allUsers.length} users
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] })}
            data-testid="button-refresh-users"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-users"
          />
        </div>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-36" data-testid="select-plan-filter">
            <SelectValue placeholder="All plans" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Plans</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="starter">Starter</SelectItem>
            <SelectItem value="professional">Pro</SelectItem>
            <SelectItem value="team">Team</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card data-testid="card-users-list">
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Projects</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Usage</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-semibold text-primary">
                          {(user.username?.[0] || "?").toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-sm">{user.username}</div>
                        {user.email && (
                          <div className="text-xs text-muted-foreground">
                            {user.email}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(user.role)} className="capitalize text-xs">
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.billingPlan}
                      onValueChange={(newPlan) => changePlan.mutate({ userId: user.id, planId: newPlan })}
                    >
                      <SelectTrigger className="h-7 w-24 text-xs" data-testid={`select-plan-${user.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="starter">Starter</SelectItem>
                        <SelectItem value="professional">Pro</SelectItem>
                        <SelectItem value="team">Team</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {user.generationDisabled ? (
                      <Badge variant="destructive" className="text-xs">
                        <PowerOff className="h-3 w-3 mr-1" />
                        Disabled
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{user.projectCount}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="text-xs">
                      <div>{user.usageSummary.totalRequests} req</div>
                      <div className="text-muted-foreground">${user.usageSummary.estimatedCost.toFixed(2)}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {user.generationDisabled ? (
                      <AlertDialog onOpenChange={setHasOpenDialog}>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" data-testid={`button-enable-user-${user.id}`}>
                            <Power className="h-4 w-4 mr-1" />
                            Enable
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Enable generation for {user.username}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will allow the user to generate new content again.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          {user.generationDisabledReason && (
                            <div className="py-2 px-3 bg-muted rounded text-sm">
                              <span className="font-medium">Previously disabled:</span> {user.generationDisabledReason}
                            </div>
                          )}
                          <AlertDialogFooter>
                            <AlertDialogCancel data-testid="button-cancel-enable-user">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => enableGeneration.mutate(user.id)}
                              data-testid="button-confirm-enable-user"
                            >
                              Enable
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : (
                      <AlertDialog onOpenChange={setHasOpenDialog}>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            disabled={user.isAdmin}
                            data-testid={`button-disable-user-${user.id}`}
                          >
                            <PowerOff className="h-4 w-4 mr-1" />
                            Disable
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Disable generation for {user.username}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              The user will still be able to log in and view existing content, but cannot generate new content.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="py-4">
                            <Label htmlFor="disable-reason">Reason (required)</Label>
                            <Input
                              id="disable-reason"
                              value={disableReason}
                              onChange={(e) => setDisableReason(e.target.value)}
                              placeholder="Enter reason for disabling..."
                              data-testid="input-disable-user-reason"
                            />
                          </div>
                          <AlertDialogFooter>
                            <AlertDialogCancel 
                              onClick={() => setDisableReason("")}
                              data-testid="button-cancel-disable-user"
                            >
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              disabled={!disableReason.trim()}
                              onClick={() => {
                                disableGeneration.mutate({ userId: user.id, reason: disableReason });
                                setDisableReason("");
                              }}
                              data-testid="button-confirm-disable-user"
                            >
                              Disable
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ProjectsPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [disableReason, setDisableReason] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading } = useQuery<{ success: boolean; data: { projects: ProjectSummary[] } }>({
    queryKey: ["/api/admin/projects"],
  });

  const disableGeneration = useMutation({
    mutationFn: async ({ projectId, reason }: { projectId: string; reason: string }) => {
      const response = await apiRequest("POST", `/api/admin/projects/${projectId}/disable-generation`, { reason, confirm: true });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/actions"] });
      toast({ title: "Generation disabled", description: "Project generation has been disabled." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    },
  });

  const enableGeneration = useMutation({
    mutationFn: async (projectId: string) => {
      const response = await apiRequest("POST", `/api/admin/projects/${projectId}/enable-generation`, { confirm: true });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/actions"] });
      toast({ title: "Generation enabled", description: "Project generation has been enabled." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    },
  });

  const allProjects = data?.data?.projects || [];
  const filteredProjects = allProjects.filter(p =>
    !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return <div className="animate-pulse h-40 bg-muted rounded-lg" data-testid="loading-projects" />;
  }

  if (allProjects.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground" data-testid="empty-projects">
        <FolderKanban className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No projects found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold">All Projects</h3>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{allProjects.length} projects</Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/projects"] })}
            data-testid="button-refresh-projects"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
          data-testid="input-search-projects"
        />
      </div>

      <Card data-testid="card-projects-list">
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="text-right">Members</TableHead>
                <TableHead className="text-right">Artifacts</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.map((project) => (
                <TableRow key={project.id} data-testid={`row-project-${project.id}`}>
                  <TableCell>
                    <div>
                      <div className="font-medium text-sm">{project.name}</div>
                      {project.description && (
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">{project.description}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{project.ownerName || "—"}</TableCell>
                  <TableCell className="text-right">{project.memberCount}</TableCell>
                  <TableCell className="text-right">{project.artifactCount}</TableCell>
                  <TableCell>
                    {project.generationDisabled ? (
                      <Badge variant="destructive" className="text-xs">Disabled</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-600">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(project.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {project.generationDisabled ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => enableGeneration.mutate(project.id)}
                        data-testid={`button-enable-project-${project.id}`}
                      >
                        <Power className="h-4 w-4 mr-1" />
                        Enable
                      </Button>
                    ) : (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" data-testid={`button-disable-project-${project.id}`}>
                            <PowerOff className="h-4 w-4 mr-1" />
                            Disable
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Disable generation for "{project.name}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will prevent new content generation in this project. Existing content remains accessible.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="py-4">
                            <Label htmlFor="project-disable-reason">Reason (required)</Label>
                            <Input
                              id="project-disable-reason"
                              value={disableReason}
                              onChange={(e) => setDisableReason(e.target.value)}
                              placeholder="Enter reason..."
                              data-testid="input-disable-project-reason"
                            />
                          </div>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setDisableReason("")}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              disabled={!disableReason.trim()}
                              onClick={() => {
                                disableGeneration.mutate({ projectId: project.id, reason: disableReason });
                                setDisableReason("");
                              }}
                            >
                              Disable
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function BillingPanel() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<{ 
    success: boolean; 
    data: { 
      usageByPlan: Record<string, PlanUsage>; 
      plans: BillingPlan[] 
    } 
  }>({
    queryKey: ["/api/admin/billing/usage-by-plan"],
  });

  const usageByPlan = data?.data?.usageByPlan || {};
  const plans = data?.data?.plans || [];

  if (isLoading) {
    return <div className="animate-pulse h-40 bg-muted rounded-lg" data-testid="loading-billing" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold">Billing Overview</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/billing/usage-by-plan"] })}
          data-testid="button-refresh-billing"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const usage = usageByPlan[plan.id] || { userCount: 0, totalGenerations: 0, totalTokens: 0 };
          return (
            <Card key={plan.id} data-testid={`card-plan-${plan.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  <Badge variant={plan.status === "active" ? "default" : "secondary"}>
                    {plan.status}
                  </Badge>
                </div>
                <CardDescription className="text-xs">{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Users:</span>
                    <span className="ml-2 font-medium">{usage.userCount}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Generations:</span>
                    <span className="ml-2 font-medium">{usage.totalGenerations}</span>
                  </div>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Tokens used:</span>
                  <span className="ml-2 font-medium">{usage.totalTokens.toLocaleString()}</span>
                </div>
                <div className="pt-2 border-t text-xs text-muted-foreground">
                  <div>Limit: {plan.softLimits.monthlyGenerations} generations/month</div>
                  <div>Budget: {plan.softLimits.monthlyTokenBudget.toLocaleString()} tokens/month</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card data-testid="card-billing-note">
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">
            Billing foundations are in place. No payment processing is active. All users are on soft limits that show warnings but do not block generation.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ActionLogPanel() {
  const { data, isLoading } = useQuery<{ success: boolean; data: { actions: AdminActionLog[] } }>({
    queryKey: ["/api/admin/actions"],
  });

  const actions = data?.data?.actions || [];

  if (isLoading) {
    return <div className="animate-pulse h-40 bg-muted rounded-lg" data-testid="loading-actions" />;
  }

  if (actions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground" data-testid="empty-actions">
        <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No admin actions recorded yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Recent Admin Actions</h3>

      <Card data-testid="card-action-log">
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {actions.map((action) => (
                <TableRow key={action.id} data-testid={`row-action-${action.id}`}>
                  <TableCell className="text-xs">
                    {new Date(action.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {action.actionType.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {action.targetType}: {action.targetId.slice(0, 8)}...
                  </TableCell>
                  <TableCell className="text-xs">{action.adminUserId.slice(0, 8)}...</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {action.reason || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Admin() {
  usePageTitle("Admin Console");
  const [hasActiveAction, setHasActiveAction] = useState(false);
  
  const { data: healthData, isError } = useQuery<{ success: boolean }>({
    queryKey: ["/api/admin/health"],
    retry: false,
  });

  if (isError) {
    return (
      <div className="flex items-center justify-center flex-1" data-testid="admin-access-denied">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Shield className="h-5 w-5" />
              Access Denied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              You do not have permission to access the Admin Console. This area is restricted to platform administrators.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-6" data-testid="page-admin">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-admin-title">Admin Console</h1>
          <p className="text-sm text-muted-foreground">
            Platform overview, user management, and system health.
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="flex w-full max-w-5xl overflow-x-auto">
          <TabsTrigger value="overview" className="flex items-center gap-2" data-testid="tab-overview">
            <LayoutDashboard className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2" data-testid="tab-users">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="projects" className="flex items-center gap-2" data-testid="tab-projects">
            <FolderKanban className="h-4 w-4" />
            Projects
          </TabsTrigger>
          <TabsTrigger value="providers" className="flex items-center gap-2" data-testid="tab-providers">
            <Activity className="h-4 w-4" />
            Health
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex items-center gap-2" data-testid="tab-billing">
            <CreditCard className="h-4 w-4" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="usage" className="flex items-center gap-2" data-testid="tab-usage">
            <DollarSign className="h-4 w-4" />
            Usage
          </TabsTrigger>
          <TabsTrigger value="artifacts" className="flex items-center gap-2" data-testid="tab-artifacts">
            <FileText className="h-4 w-4" />
            Artifacts
          </TabsTrigger>
          <TabsTrigger value="actions" className="flex items-center gap-2" data-testid="tab-actions">
            <Clock className="h-4 w-4" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6" data-testid="panel-overview">
          <OverviewPanel />
        </TabsContent>

        <TabsContent value="users" className="space-y-6" data-testid="panel-users">
          <UsersPanel onActionStateChange={setHasActiveAction} />
        </TabsContent>

        <TabsContent value="projects" className="space-y-6" data-testid="panel-projects">
          <ProjectsPanel />
        </TabsContent>

        <TabsContent value="providers" className="space-y-6" data-testid="panel-providers">
          <ProviderHealthPanel onActionStateChange={setHasActiveAction} />
        </TabsContent>

        <TabsContent value="billing" className="space-y-6" data-testid="panel-billing">
          <BillingPanel />
        </TabsContent>

        <TabsContent value="usage" className="space-y-6" data-testid="panel-usage">
          <UsagePanel />
        </TabsContent>

        <TabsContent value="artifacts" className="space-y-6" data-testid="panel-artifacts">
          <ArtifactIntegrityPanel />
        </TabsContent>

        <TabsContent value="actions" className="space-y-6" data-testid="panel-actions">
          <ActionLogPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
