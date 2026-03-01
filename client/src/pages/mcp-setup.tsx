import { useState } from "react";
import { usePageTitle } from "@/hooks/use-page-title";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProject } from "@/contexts/project-context";
import {
  Copy,
  Check,
  Terminal,
  Plug,
  BookOpen,
  Workflow,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  SkipForward,
  Play,
  Eye,
  Search,
  MessageSquare,
  FileText,
  Lightbulb,
  Layers,
  Activity,
  ArrowRight,
  Key,
} from "lucide-react";
import { useLocation } from "wouter";

function CopyBlock({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      {label && <p className="text-xs text-muted-foreground mb-1.5">{label}</p>}
      <pre className="p-3 rounded-md bg-muted text-sm font-mono whitespace-pre-wrap break-all" data-testid={`text-copy-block-${label?.toLowerCase().replace(/\s+/g, "-") || "default"}`}>
        {value}
      </pre>
      <Button
        size="icon"
        variant="ghost"
        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleCopy}
        data-testid={`button-copy-${label?.toLowerCase().replace(/\s+/g, "-") || "default"}`}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

function ToolCard({
  name,
  description,
  params,
  icon: Icon,
}: {
  name: string;
  description: string;
  params: { name: string; type: string; required: boolean; desc: string }[];
  icon: React.ElementType;
}) {
  return (
    <Card data-testid={`card-tool-${name}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-md bg-primary/8 flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <code className="text-sm font-semibold font-mono">{name}</code>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
          </div>
        </div>
        {params.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Parameters</p>
            <div className="space-y-1">
              {params.map((p) => (
                <div key={p.name} className="flex items-start gap-2 text-xs">
                  <code className="font-mono text-primary/80 shrink-0">{p.name}</code>
                  <span className="text-muted-foreground/60 shrink-0">({p.type}{!p.required && ", optional"})</span>
                  <span className="text-muted-foreground">{p.desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ResourceCard({
  uri,
  description,
  format,
  icon: Icon,
}: {
  uri: string;
  description: string;
  format: string;
  icon: React.ElementType;
}) {
  return (
    <Card data-testid={`card-resource-${uri.replace("project://", "")}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-md bg-primary/8 flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <code className="text-sm font-semibold font-mono">{uri}</code>
              <Badge variant="secondary" className="text-[10px]">{format}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function McpSetup() {
  usePageTitle("MCP Setup");
  const [, setLocation] = useLocation();
  const { activeProject } = useProject();

  const { data: keysData } = useQuery<{ success: boolean; data: { id: string; prefix: string; label: string; revoked: boolean }[] }>({
    queryKey: ["/api/account/api-keys"],
  });

  const activeKeys = keysData?.data?.filter(k => !k.revoked) || [];
  const hasKeys = activeKeys.length > 0;
  const serverUrl = `${window.location.origin}/mcp`;
  const projectId = activeProject?.id || "<your-project-id>";

  const cursorConfig = JSON.stringify({
    mcpServers: {
      plan2prompt: {
        url: serverUrl,
        headers: {
          Authorization: "Bearer <your-api-key>",
          "X-Project-Id": projectId,
        },
      },
    },
  }, null, 2);

  const windsurfConfig = JSON.stringify({
    mcpServers: {
      plan2prompt: {
        serverUrl: serverUrl,
        headers: {
          Authorization: "Bearer <your-api-key>",
          "X-Project-Id": projectId,
        },
      },
    },
  }, null, 2);

  const claudeCodeCommand = `claude mcp add plan2prompt \\
  --transport http \\
  --url "${serverUrl}" \\
  --header "Authorization: Bearer <your-api-key>" \\
  --header "X-Project-Id: ${projectId}"`;

  return (
    <div className="space-y-8 max-w-4xl p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-mcp-setup-title">MCP Setup Guide</h1>
        <p className="text-muted-foreground mt-1">
          Connect your IDE to Plan2Prompt using the Model Context Protocol
        </p>
      </div>

      <Card className="border-primary/20 bg-primary/[0.02]" data-testid="card-mcp-overview">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Plug className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="font-semibold">What is MCP?</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The Model Context Protocol lets your IDE's AI assistant connect directly to Plan2Prompt. Instead of
                copying prompts from the browser, your IDE can pull build steps, track progress, report errors, and
                access project context automatically. It works with Cursor, Windsurf, Claude Code, and any MCP-compatible editor.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <h2 className="text-lg font-semibold tracking-tight" data-testid="text-quick-start-heading">Quick Start</h2>

        <div className="grid gap-4">
          <Card data-testid="card-step-1">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold shrink-0">
                  1
                </div>
                <div className="space-y-3 flex-1">
                  <div>
                    <h3 className="font-semibold text-sm">Generate an API Key</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {hasKeys
                        ? `You have ${activeKeys.length} active key${activeKeys.length > 1 ? "s" : ""}: ${activeKeys.map(k => `${k.prefix}... (${k.label})`).join(", ")}`
                        : "You need an API key to authenticate your IDE's connection."}
                    </p>
                  </div>
                  <Button
                    variant={hasKeys ? "outline" : "default"}
                    size="sm"
                    onClick={() => setLocation("/account")}
                    data-testid="button-go-to-keys"
                  >
                    <Key className="mr-2 h-3.5 w-3.5" />
                    {hasKeys ? "Manage API Keys" : "Generate API Key"}
                    <ArrowRight className="ml-2 h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-step-2">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold shrink-0">
                  2
                </div>
                <div className="space-y-3 flex-1">
                  <div>
                    <h3 className="font-semibold text-sm">Note Your Project ID</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Your IDE needs this to know which project to work with.
                    </p>
                  </div>
                  {activeProject && (
                    <CopyBlock
                      value={activeProject.id}
                      label={`Project: ${activeProject.name}`}
                    />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-step-3">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold shrink-0">
                  3
                </div>
                <div className="space-y-4 flex-1">
                  <div>
                    <h3 className="font-semibold text-sm">Configure Your IDE</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Add Plan2Prompt to your IDE's MCP configuration. Choose your editor below.
                    </p>
                  </div>

                  <Tabs defaultValue="cursor" data-testid="tabs-ide-config">
                    <TabsList>
                      <TabsTrigger value="cursor" data-testid="tab-cursor">Cursor</TabsTrigger>
                      <TabsTrigger value="windsurf" data-testid="tab-windsurf">Windsurf</TabsTrigger>
                      <TabsTrigger value="claude-code" data-testid="tab-claude-code">Claude Code</TabsTrigger>
                      <TabsTrigger value="other" data-testid="tab-other">Other</TabsTrigger>
                    </TabsList>

                    <TabsContent value="cursor" className="space-y-3 mt-3">
                      <p className="text-xs text-muted-foreground">
                        Create or edit <code className="font-mono bg-muted px-1 py-0.5 rounded">.cursor/mcp.json</code> in your project root:
                      </p>
                      <CopyBlock value={cursorConfig} label="Cursor MCP Config" />
                    </TabsContent>

                    <TabsContent value="windsurf" className="space-y-3 mt-3">
                      <p className="text-xs text-muted-foreground">
                        Add to your Windsurf MCP settings file:
                      </p>
                      <CopyBlock value={windsurfConfig} label="Windsurf MCP Config" />
                    </TabsContent>

                    <TabsContent value="claude-code" className="space-y-3 mt-3">
                      <p className="text-xs text-muted-foreground">
                        Run this command in your terminal:
                      </p>
                      <CopyBlock value={claudeCodeCommand} label="Claude Code CLI" />
                    </TabsContent>

                    <TabsContent value="other" className="space-y-3 mt-3">
                      <p className="text-xs text-muted-foreground">
                        For any MCP-compatible client, configure it with these details:
                      </p>
                      <div className="space-y-2">
                        <CopyBlock value={serverUrl} label="Server URL" />
                        <CopyBlock
                          value={`Authorization: Bearer <your-api-key>\nX-Project-Id: ${projectId}`}
                          label="Required Headers"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Transport type: <strong>Streamable HTTP</strong> (the standard for modern MCP clients)
                      </p>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="space-y-6" data-testid="section-tools">
        <div>
          <h2 className="text-lg font-semibold tracking-tight" data-testid="text-tools-heading">Available Tools</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Tools are actions your IDE can perform. They read or modify state in your Plan2Prompt project.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            Execution Tools
          </h3>
          <div className="grid gap-3">
            <ToolCard
              name="start_session"
              description="Start a new execution session for a prompt artifact, or resume an existing one."
              icon={Play}
              params={[
                { name: "promptArtifactId", type: "string", required: true, desc: "ID of the prompt artifact" },
                { name: "totalSteps", type: "integer", required: true, desc: "Number of steps in the prompt" },
              ]}
            />
            <ToolCard
              name="get_session_status"
              description="Get the full status of an execution session including all step states, progress, and upstream change detection."
              icon={Eye}
              params={[
                { name: "sessionId", type: "string", required: true, desc: "The execution session ID" },
              ]}
            />
            <ToolCard
              name="get_current_step"
              description="Get the current active step with full prompt content, integrity level, idempotency flag, and requirement traceability."
              icon={BookOpen}
              params={[
                { name: "sessionId", type: "string", required: true, desc: "The execution session ID" },
              ]}
            />
            <ToolCard
              name="complete_step"
              description="Mark a step as completed and advance the session. Steps must be completed in order."
              icon={CheckCircle2}
              params={[
                { name: "sessionId", type: "string", required: true, desc: "The execution session ID" },
                { name: "stepNumber", type: "integer", required: true, desc: "The step number to complete" },
              ]}
            />
            <ToolCard
              name="report_failure"
              description="Report a step failure with error output. Automatically classifies the error, tracks attempts, detects duplicates, and escalates when needed."
              icon={XCircle}
              params={[
                { name: "sessionId", type: "string", required: true, desc: "The execution session ID" },
                { name: "stepNumber", type: "integer", required: true, desc: "The step that failed" },
                { name: "failureOutput", type: "string", required: true, desc: "Raw error output from the IDE" },
              ]}
            />
            <ToolCard
              name="skip_to_step"
              description="Jump to a specific step. All prior steps must already be completed."
              icon={SkipForward}
              params={[
                { name: "sessionId", type: "string", required: true, desc: "The execution session ID" },
                { name: "stepNumber", type: "integer", required: true, desc: "Step number to skip to" },
              ]}
            />
            <ToolCard
              name="classify_failure"
              description="Classify an error output without modifying execution state. Useful for understanding an error before deciding what to do."
              icon={Search}
              params={[
                { name: "failureOutput", type: "string", required: true, desc: "Raw error output to classify" },
              ]}
            />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            Clarification Tools
          </h3>
          <div className="grid gap-3">
            <ToolCard
              name="list_clarifications"
              description="List active clarification contracts for the project. Clarifications are created when downstream steps need upstream review."
              icon={MessageSquare}
              params={[
                { name: "module", type: "string", required: false, desc: "Filter by module: execution, ideas, or requirements" },
              ]}
            />
            <ToolCard
              name="get_clarification"
              description="Get full details of a clarification contract, including the list of questions that need answers."
              icon={Eye}
              params={[
                { name: "clarificationId", type: "string", required: true, desc: "The clarification contract ID" },
              ]}
            />
            <ToolCard
              name="resolve_clarification"
              description="Submit a resolution for a pending clarification contract."
              icon={CheckCircle2}
              params={[
                { name: "clarificationId", type: "string", required: true, desc: "The clarification contract ID" },
                { name: "resolutionData", type: "object", required: true, desc: "Key-value pairs matching the required fields" },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="space-y-6" data-testid="section-resources">
        <div>
          <h2 className="text-lg font-semibold tracking-tight" data-testid="text-resources-heading">Available Resources</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Resources are read-only data your IDE can pull from your project at any time.
          </p>
        </div>

        <div className="grid gap-3">
          <ResourceCard
            uri="project://requirements"
            description="The full requirements document for the active project. Returns the latest locked requirements artifact as Markdown with YAML frontmatter."
            format="Markdown"
            icon={FileText}
          />
          <ResourceCard
            uri="project://idea-analysis"
            description="The latest idea analysis with original content plus structured metadata: strengths, weaknesses, risks, feasibility scores, and profile assessments."
            format="Markdown"
            icon={Lightbulb}
          />
          <ResourceCard
            uri="project://prompt-steps"
            description="All prompt steps from the latest artifact. Each step includes its title, integrity level, idempotency flag, requirements covered, and full prompt body."
            format="Markdown"
            icon={Layers}
          />
          <ResourceCard
            uri="project://session-state"
            description="Current execution session state including session status, step counts, active step number, and failure history per step."
            format="JSON"
            icon={Activity}
          />
          <ResourceCard
            uri="project://execution-progress"
            description="Overall execution progress with aggregate metrics: completion percentage, step counts by status, current step, and failure history with escalation levels."
            format="JSON"
            icon={Workflow}
          />
        </div>
      </div>

      <Card data-testid="card-typical-workflow">
        <CardHeader>
          <CardTitle className="text-base">Typical Build Workflow</CardTitle>
          <CardDescription>How your IDE assistant uses MCP during a build session</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { step: "1", text: "Read project://requirements to understand what needs to be built" },
              { step: "2", text: "Read project://prompt-steps to see all build steps" },
              { step: "3", text: "Call start_session with the prompt artifact ID and step count" },
              { step: "4", text: "Call get_current_step to get the prompt for the first step" },
              { step: "5", text: "Execute the step instructions in your IDE" },
              { step: "6", text: "Call complete_step to mark it done and move to the next step" },
              { step: "7", text: "If something fails, call report_failure with the error output to get classification and recovery guidance" },
              { step: "8", text: "Repeat until all steps are completed" },
              { step: "9", text: "Check list_clarifications if any blockers were created during execution" },
              { step: "10", text: "Call resolve_clarification to unblock the session" },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3" data-testid={`text-workflow-step-${item.step}`}>
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[11px] font-semibold text-muted-foreground shrink-0">
                  {item.step}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed pt-0.5">{item.text}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-security-notes">
        <CardHeader>
          <CardTitle className="text-base">Security Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              API keys are hashed before storage. The raw key is only shown once when you generate it. If you lose it, you'll need to create a new one.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              Every request is scoped to a specific project via the X-Project-Id header. Your IDE can only access projects you're a member of.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              Revoked keys are rejected immediately. You can revoke any key from your Account Settings at any time.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
