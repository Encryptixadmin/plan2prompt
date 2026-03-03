import { useState } from "react";
import { usePageTitle } from "@/hooks/use-page-title";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Key, Plus, Copy, Check, Trash2, AlertTriangle, Loader2, Download, UserX } from "lucide-react";

interface ApiKeyItem {
  id: string;
  prefix: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
}

interface CreateKeyResponse {
  success: boolean;
  data: {
    id: string;
    key: string;
    prefix: string;
    label: string;
    createdAt: string;
  };
}

export default function Account() {
  usePageTitle("Account Settings");
  const { toast } = useToast();
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const { data: keysData, isLoading } = useQuery<{ success: boolean; data: ApiKeyItem[] }>({
    queryKey: ["/api/account/api-keys"],
  });

  const createMutation = useMutation({
    mutationFn: async (label: string) => {
      const res = await apiRequest("POST", "/api/account/api-keys", { label });
      return res.json() as Promise<CreateKeyResponse>;
    },
    onSuccess: (data) => {
      setGeneratedKey(data.data.key);
      setNewKeyLabel("");
      queryClient.invalidateQueries({ queryKey: ["/api/account/api-keys"] });
    },
    onError: () => {
      toast({ title: "Failed to create API key", variant: "destructive" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/account/api-keys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/account/api-keys"] });
      toast({ title: "API key revoked" });
    },
    onError: () => {
      toast({ title: "Failed to revoke API key", variant: "destructive" });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/account/export");
      return res.json();
    },
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "plan2prompt-data-export.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Data exported successfully" });
    },
    onError: () => {
      toast({ title: "Failed to export data", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/account");
    },
    onSuccess: () => {
      setDeleteDialogOpen(false);
      setDeleteConfirmText("");
      window.location.href = "/";
    },
    onError: () => {
      toast({ title: "Failed to delete account", variant: "destructive" });
    },
  });

  const handleCopy = async () => {
    if (!generatedKey) return;
    await navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateDialogClose = () => {
    setCreateDialogOpen(false);
    setGeneratedKey(null);
    setNewKeyLabel("");
    setCopied(false);
  };

  const activeKeys = keysData?.data?.filter(k => !k.revoked) || [];
  const revokedKeys = keysData?.data?.filter(k => k.revoked) || [];

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Account Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your API keys for IDE integration</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                API Keys
              </CardTitle>
              <CardDescription className="mt-1.5">
                API keys allow your IDE (Cursor, Windsurf, Claude Code, etc.) to connect to Plan2Prompt via MCP.
              </CardDescription>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={(open) => {
              if (!open) handleCreateDialogClose();
              else setCreateDialogOpen(true);
            }}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-api-key">
                  <Plus className="mr-2 h-4 w-4" />
                  Generate New Key
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{generatedKey ? "API Key Created" : "Generate New API Key"}</DialogTitle>
                  <DialogDescription>
                    {generatedKey
                      ? "Copy this key now. It will not be shown again."
                      : "Give your key a label to identify where it's used."}
                  </DialogDescription>
                </DialogHeader>

                {!generatedKey ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="key-label">Label</Label>
                      <Input
                        id="key-label"
                        placeholder="e.g., Cursor IDE, VS Code, Work laptop"
                        value={newKeyLabel}
                        onChange={(e) => setNewKeyLabel(e.target.value)}
                        data-testid="input-api-key-label"
                      />
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => createMutation.mutate(newKeyLabel)}
                        disabled={!newKeyLabel.trim() || createMutation.isPending}
                        data-testid="button-generate-key"
                      >
                        {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Generate
                      </Button>
                    </DialogFooter>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        This key will not be shown again. Copy it now.
                      </p>
                    </div>
                    <div className="relative">
                      <code
                        className="block p-3 rounded-md bg-muted text-sm font-mono break-all"
                        data-testid="text-generated-key"
                      >
                        {generatedKey}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-2 right-2"
                        onClick={handleCopy}
                        data-testid="button-copy-key"
                      >
                        {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleCreateDialogClose} data-testid="button-done-key">
                        Done
                      </Button>
                    </DialogFooter>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activeKeys.length === 0 && revokedKeys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-keys">
              <Key className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No API keys yet</p>
              <p className="text-sm mt-1">Generate a key to connect your IDE to Plan2Prompt via MCP.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeKeys.map((key) => (
                  <TableRow key={key.id} data-testid={`row-api-key-${key.id}`}>
                    <TableCell className="font-mono text-sm" data-testid={`text-key-prefix-${key.id}`}>
                      {key.prefix}...
                    </TableCell>
                    <TableCell data-testid={`text-key-label-${key.id}`}>{key.label}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(key.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : "Never"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        Active
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            data-testid={`button-revoke-key-${key.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will immediately revoke the key "{key.label}" ({key.prefix}...). Any IDE connections using this key will stop working.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => revokeMutation.mutate(key.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              data-testid={`button-confirm-revoke-${key.id}`}
                            >
                              Revoke
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
                {revokedKeys.map((key) => (
                  <TableRow key={key.id} className="opacity-50" data-testid={`row-api-key-${key.id}`}>
                    <TableCell className="font-mono text-sm">{key.prefix}...</TableCell>
                    <TableCell>{key.label}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(key.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : "Never"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">Revoked</Badge>
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>MCP Connection Guide</CardTitle>
          <CardDescription>How to connect your IDE to Plan2Prompt</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">1. Generate an API key above</h4>
            <h4 className="font-medium text-sm">2. Configure your IDE's MCP settings</h4>
            <p className="text-sm text-muted-foreground ml-4">
              Add the Plan2Prompt MCP server to your IDE's MCP configuration. The server URL is:
            </p>
            <code className="block ml-4 p-2 rounded-md bg-muted text-sm font-mono" data-testid="text-mcp-url">
              {window.location.origin}/mcp
            </code>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-sm">3. Set headers</h4>
            <p className="text-sm text-muted-foreground ml-4">
              Your MCP client needs to send these headers with every request:
            </p>
            <pre className="ml-4 p-3 rounded-md bg-muted text-sm font-mono whitespace-pre-wrap" data-testid="text-mcp-headers">
{`Authorization: Bearer <your-api-key>
X-Project-Id: <your-project-id>`}
            </pre>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Available Tools</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground ml-4 space-y-1">
              <li><code>start_session</code> — Start or resume an execution session</li>
              <li><code>get_current_step</code> — Get the active build step with full context</li>
              <li><code>complete_step</code> — Mark a step as completed</li>
              <li><code>report_failure</code> — Report a failure and get classified recovery steps</li>
              <li><code>classify_failure</code> — Classify an error without advancing state</li>
              <li><code>list_clarifications</code> — List active clarification contracts</li>
              <li><code>resolve_clarification</code> — Resolve a clarification from within the IDE</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>Export or delete your account data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <h4 className="font-medium text-sm">Export My Data</h4>
              <p className="text-sm text-muted-foreground">
                Download all your data as a JSON file including your profile, projects, artifacts, API keys, and billing usage.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
              data-testid="button-export-data"
            >
              {exportMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Export Data
            </Button>
          </div>

          <div className="border-t pt-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-1">
                <h4 className="font-medium text-sm text-destructive">Delete My Account</h4>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your account. This will revoke all API keys, remove project memberships, and anonymize your user record. Shared artifacts and projects will not be deleted.
                </p>
              </div>
              <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
                setDeleteDialogOpen(open);
                if (!open) setDeleteConfirmText("");
              }}>
                <DialogTrigger asChild>
                  <Button
                    variant="destructive"
                    data-testid="button-delete-account"
                  >
                    <UserX className="mr-2 h-4 w-4" />
                    Delete Account
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Your Account</DialogTitle>
                    <DialogDescription>
                      This action cannot be undone. Your account will be permanently deleted.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                      <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                      <p className="text-sm text-destructive">
                        All API keys will be revoked, project memberships removed, and your profile anonymized.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="delete-confirm">Type "DELETE" to confirm</Label>
                      <Input
                        id="delete-confirm"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder="DELETE"
                        data-testid="input-delete-confirm"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => deleteMutation.mutate()}
                      disabled={deleteConfirmText !== "DELETE" || deleteMutation.isPending}
                      data-testid="button-confirm-delete-account"
                    >
                      {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Permanently Delete
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
