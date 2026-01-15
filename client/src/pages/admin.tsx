import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  FileText,
  Power,
  PowerOff,
  RefreshCw,
  Shield,
  Users,
  FolderOpen,
} from "lucide-react";

interface ProviderStatus {
  provider: string;
  enabled: boolean;
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

function ProviderHealthPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [disableReason, setDisableReason] = useState("");

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

      <div className="grid gap-4 md:grid-cols-3">
        {providers.map((provider) => (
          <Card key={provider.provider} data-testid={`card-provider-${provider.provider}`}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base capitalize">{provider.provider}</CardTitle>
                <CardDescription className="text-xs">
                  {provider.enabled ? "Active" : "Disabled"}
                </CardDescription>
              </div>
              <Badge variant={provider.enabled ? "default" : "destructive"}>
                {provider.enabled ? <CheckCircle className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                {provider.enabled ? "Enabled" : "Disabled"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
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
                  <AlertDialog>
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
                  <AlertDialog>
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
                  <TableCell className="text-xs">{action.adminUserId}</TableCell>
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
  const { data: healthData, isError } = useQuery<{ success: boolean }>({
    queryKey: ["/api/admin/health"],
    retry: false,
  });

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" data-testid="admin-access-denied">
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
    <div className="min-h-screen bg-background" data-testid="page-admin">
      <header className="border-b sticky top-0 bg-background z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Admin Console</h1>
          </div>
          <Badge variant="outline">Internal Use Only</Badge>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <Tabs defaultValue="providers" className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="providers" className="flex items-center gap-2" data-testid="tab-providers">
              <Activity className="h-4 w-4" />
              Providers
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
              Actions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="providers" className="space-y-6" data-testid="panel-providers">
            <ProviderHealthPanel />
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
      </main>
    </div>
  );
}
