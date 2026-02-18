import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Lightbulb,
  FileText,
  Zap,
  ArrowRight,
  Shield,
  Moon,
  Sun,
  ChevronRight,
  Layers,
  Brain,
  Target,
  GitBranch,
  Lock,
  AlertTriangle,
  CheckCircle2,
  Terminal,
  BarChart3,
  Search,
  RefreshCw,
  ShieldCheck,
  Users,
  Activity,
  Eye,
  ServerCrash,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";

function PipelineStage({
  number,
  title,
  description,
  capability,
  icon: Icon,
  isLast,
}: {
  number: number;
  title: string;
  description: string;
  capability: string;
  icon: React.ElementType;
  isLast?: boolean;
}) {
  return (
    <div className="flex flex-col items-center text-center relative" data-testid={`pipeline-stage-${number}`}>
      <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center mb-3">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <span className="text-xs font-mono text-muted-foreground mb-1">Stage {number}</span>
      <h3 className="font-semibold text-sm mb-1.5">{title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed mb-2 max-w-[180px]">{description}</p>
      <span className="text-[11px] font-medium text-primary/80 bg-primary/5 px-2 py-0.5 rounded-md">{capability}</span>
      {!isLast && (
        <ChevronRight className="hidden lg:block absolute -right-3 top-5 h-4 w-4 text-muted-foreground/40" />
      )}
    </div>
  );
}

function CapabilityCard({
  title,
  description,
  icon: Icon,
  testId,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardContent className="p-5 space-y-2.5">
        <div className="h-9 w-9 rounded-md bg-primary/8 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <h3 className="font-semibold text-sm">{title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
}

function DisciplineItem({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-7 w-7 rounded-md bg-primary/8 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <span className="text-sm text-muted-foreground leading-relaxed">{text}</span>
    </div>
  );
}

export default function Landing() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <span className="font-semibold tracking-tight">Plan2Prompt</span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                data-testid="button-theme-toggle-landing"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" asChild data-testid="link-login-nav">
                <a href="/auth">Log in</a>
              </Button>
              <Button asChild data-testid="button-get-started-nav">
                <a href="/auth">Start a Build</a>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-14">
        <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-b" data-testid="section-hero">
          <div className="max-w-6xl mx-auto">
            <div className="max-w-2xl space-y-6">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-primary bg-primary/8 px-3 py-1.5 rounded-md">
                <Layers className="h-3 w-3" />
                Structured Build Orchestration
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
                From Idea to Production Build
                <br />
                <span className="text-primary">With Control at Every Step</span>
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl">
                A deterministic pipeline that validates your concept through multi-model AI consensus,
                derives structured requirements, generates traceable build instructions, and enforces
                execution integrity throughout.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button size="lg" asChild data-testid="button-get-started-hero">
                  <a href="/auth">
                    Start a Structured Build
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button size="lg" variant="outline" asChild data-testid="button-see-how-it-works">
                  <a href="#pipeline">See How It Works</a>
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-5 text-xs text-muted-foreground pt-2">
                <span className="flex items-center gap-1.5">
                  <Brain className="h-3.5 w-3.5" />
                  AI Consensus Analysis
                </span>
                <span className="flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5" />
                  Requirements Intelligence
                </span>
                <span className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" />
                  Execution Discipline
                </span>
              </div>
            </div>
          </div>
        </section>

        <section id="pipeline" className="py-20 px-4 sm:px-6 lg:px-8 bg-card border-b" data-testid="section-pipeline">
          <div className="max-w-6xl mx-auto">
            <div className="mb-14 space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">How It Works</h2>
              <p className="text-sm text-muted-foreground max-w-lg">
                A six-stage deterministic pipeline. Each stage enforces completion before the next begins.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 lg:gap-4">
              <PipelineStage
                number={1}
                title="Idea Analysis"
                description="Submit your concept for multi-provider evaluation."
                capability="Consensus Scoring"
                icon={Lightbulb}
              />
              <PipelineStage
                number={2}
                title="Requirements"
                description="Derive architecture, data models, and contracts."
                capability="Risk Traceability"
                icon={FileText}
              />
              <PipelineStage
                number={3}
                title="Build Prompts"
                description="Generate sequential, IDE-specific instructions."
                capability="Requirement Mapping"
                icon={Zap}
              />
              <PipelineStage
                number={4}
                title="Execution"
                description="Track per-step state with integrity controls."
                capability="Idempotency Detection"
                icon={Terminal}
              />
              <PipelineStage
                number={5}
                title="Feedback"
                description="Classify failures and detect duplicate errors."
                capability="Failure Hashing"
                icon={RefreshCw}
              />
              <PipelineStage
                number={6}
                title="Refinement"
                description="Escalate blockers to upstream clarification."
                capability="Controlled Escalation"
                icon={GitBranch}
                isLast
              />
            </div>
          </div>
        </section>

        <section className="py-20 px-4 sm:px-6 lg:px-8 border-b" data-testid="section-intelligence">
          <div className="max-w-6xl mx-auto">
            <div className="mb-12 space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">Intelligence Capabilities</h2>
              <p className="text-sm text-muted-foreground max-w-lg">
                Every stage is powered by structured analysis, not open-ended generation.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <CapabilityCard
                title="Multi-Model Consensus"
                description="Multiple AI providers independently evaluate your idea. Scores are weighted across viability, technical complexity, commercial clarity, and execution risk."
                icon={Brain}
                testId="card-consensus"
              />
              <CapabilityCard
                title="Viability Modelling"
                description="Technical, commercial, and execution profiles scored with purpose-aware criteria. Five project types receive tailored validation."
                icon={BarChart3}
                testId="card-viability"
              />
              <CapabilityCard
                title="Requirements Derivation"
                description="AI-driven structured requirements with system overview, architecture decisions, functional and non-functional specs derived from validated analysis."
                icon={FileText}
                testId="card-requirements"
              />
              <CapabilityCard
                title="Prompt Traceability"
                description="Every generated build prompt links to specific requirements. Every requirement traces back to idea risk drivers. Full chain is deterministic and auditable."
                icon={Search}
                testId="card-traceability"
              />
              <CapabilityCard
                title="Integrity Controls"
                description="Steps are classified by idempotency level. Critical operations are flagged. Duplicate failures trigger automatic escalation to clarification contracts."
                icon={ShieldCheck}
                testId="card-integrity"
              />
              <CapabilityCard
                title="Deterministic Escalation"
                description="Failure classification, hash-based duplicate detection, and severity escalation operate without AI involvement. Rules are fixed and auditable."
                icon={AlertTriangle}
                testId="card-escalation"
              />
            </div>
          </div>
        </section>

        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-card border-b" data-testid="section-discipline">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16">
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold tracking-tight">Execution Discipline</h2>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
                  The platform enforces sequential execution, validates every transition, and prevents
                  unsafe operations from proceeding without explicit confirmation.
                </p>
              </div>
              <div className="space-y-4">
                <DisciplineItem
                  icon={Lock}
                  text="No skipping steps. Each pipeline stage must complete before the next unlocks. Previous-step validation is enforced at the API level."
                />
                <DisciplineItem
                  icon={ShieldCheck}
                  text="Automatic idempotency detection classifies every step as safe, caution, or critical based on deterministic keyword analysis."
                />
                <DisciplineItem
                  icon={ServerCrash}
                  text="Failure classification with SHA-256 hashing detects duplicate errors. Repeated identical failures escalate severity automatically."
                />
                <DisciplineItem
                  icon={RefreshCw}
                  text="Controlled clarification loops route blockers upstream. Cross-module contracts enforce resolution before generation resumes."
                />
                <DisciplineItem
                  icon={CheckCircle2}
                  text="Upstream validation ensures prompt artifacts stay synchronized. Session invalidation triggers when source requirements change."
                />
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 px-4 sm:px-6 lg:px-8 border-b" data-testid="section-ide">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold tracking-tight">IDE Integration Model</h2>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
                  Plan2Prompt is the orchestration layer. Your IDE is the runtime.
                  Build prompts compile into executable instructions tailored to your development environment.
                </p>
              </div>
              <div className="space-y-3">
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-md bg-primary/8 flex items-center justify-center shrink-0">
                        <Terminal className="h-4 w-4 text-primary" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-semibold text-sm">Prompts Compile to Instructions</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Generated prompts include step dependencies, requirement references,
                          integrity metadata, and IDE-specific formatting. They are structured artifacts, not free-text suggestions.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-md bg-primary/8 flex items-center justify-center shrink-0">
                        <Layers className="h-4 w-4 text-primary" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-semibold text-sm">Supported Environments</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Replit, Cursor, Lovable, Antigravity, Warp, and Generic IDE.
                          IDE adaptation is a formatting layer only. Core logic is IDE-agnostic.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-card border-b" data-testid="section-governance">
          <div className="max-w-6xl mx-auto">
            <div className="mb-12 space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">Governance and Safety</h2>
              <p className="text-sm text-muted-foreground max-w-lg">
                Production-grade controls for isolation, access, and observability.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-5 space-y-2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">Project Isolation</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Every API request is scoped to a project via X-Project-Id header enforcement.
                    Cross-project data access is structurally prevented.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5 space-y-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">Role-Based Permissions</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Admin and user roles with plan-based access tiers. Admin console provides
                    audit trail, provider management, and usage controls.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5 space-y-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">Usage Tracking</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Per-provider token usage tracked across all operations.
                    Plan-based limits enforced with real-time monitoring in admin console.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5 space-y-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">Structured Logging</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Audit logs persist admin actions, feedback events, and clarification
                    resolutions to PostgreSQL with timestamp and actor tracking.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5 space-y-2">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">AI Provider Validation</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Startup-time model probing with fallback chains. Invalid or quota-exhausted
                    providers are excluded automatically before any user request.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5 space-y-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">Session Security</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Replit Auth via OpenID Connect with PostgreSQL-backed sessions.
                    Encrypted session secrets with secure cookie configuration.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-20 px-4 sm:px-6 lg:px-8" data-testid="section-final-cta">
          <div className="max-w-6xl mx-auto text-center">
            <div className="max-w-md mx-auto space-y-5">
              <h2 className="text-2xl font-semibold tracking-tight">Build With Structure</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Stop guessing. Start with validated analysis, structured requirements,
                and traceable execution.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button size="lg" asChild data-testid="button-get-started-cta">
                  <a href="/auth">
                    Start a Project
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Plan2Prompt</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Structured AI build orchestration
          </p>
        </div>
      </footer>
    </div>
  );
}
