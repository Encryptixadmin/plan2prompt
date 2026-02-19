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
  isFirst,
}: {
  number: number;
  title: string;
  description: string;
  capability: string;
  icon: React.ElementType;
  isLast?: boolean;
  isFirst?: boolean;
}) {
  return (
    <div className="flex flex-col items-center relative" data-testid={`pipeline-stage-${number}`}>
      <div className="flex items-center w-full mb-5">
        <div className={`h-[2px] flex-1 ${isFirst ? "bg-transparent" : "bg-border"}`} />
        <div className="relative z-10 h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm shrink-0 shadow-sm">
          {number}
        </div>
        <div className={`h-[2px] flex-1 ${isLast ? "bg-transparent" : "bg-border"}`} />
      </div>
      <Card className="w-full h-full">
        <CardContent className="p-4 flex flex-col items-center text-center h-full">
          <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center mb-2.5">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <h3 className="font-semibold text-sm mb-1.5">{title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed mb-2.5 flex-1">{description}</p>
          <span className="text-[11px] font-medium text-primary/80 bg-primary/5 px-2.5 py-1 rounded-md">{capability}</span>
        </CardContent>
      </Card>
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
                Structured Build Planning
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
                From Idea to Execution
                <br />
                <span className="text-primary">With Control at Every Step</span>
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl">
                Multiple AI models independently review your idea, shape it into clear requirements,
                and produce step-by-step build instructions you can follow in your favourite IDE.
                Nothing gets skipped. Every step is accounted for.
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
                  Multi-AI Review
                </span>
                <span className="flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5" />
                  Clear Requirements
                </span>
                <span className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" />
                  Safe Execution
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
                You describe your idea and refine the requirements. The platform handles everything else.
              </p>
            </div>

            <div className="mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground">You</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-0 mb-10">
              <PipelineStage
                number={1}
                title="Describe Your Idea"
                description="Tell the platform what you want to build. Multiple AI models review and score it independently."
                capability="Multi-AI Scoring"
                icon={Lightbulb}
                isFirst
              />
              <PipelineStage
                number={2}
                title="Refine Requirements"
                description="Review the generated spec. Answer clarifying questions to sharpen the technical plan."
                capability="Guided Refinement"
                icon={FileText}
                isLast
              />
            </div>

            <div className="mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground">The Platform</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-0">
              <PipelineStage
                number={3}
                title="Build Steps"
                description="Ordered, IDE-specific instructions are generated from your requirements."
                capability="Linked to Requirements"
                icon={Zap}
                isFirst
              />
              <PipelineStage
                number={4}
                title="Execution Tracking"
                description="Each step is tracked with progress state and safety classification."
                capability="Flags Risky Actions"
                icon={Terminal}
              />
              <PipelineStage
                number={5}
                title="Error Detection"
                description="Failures are classified automatically. Repeated errors are flagged."
                capability="Detects Repeat Errors"
                icon={RefreshCw}
              />
              <PipelineStage
                number={6}
                title="Auto-Refinement"
                description="Unresolved problems are routed back to the right stage for resolution."
                capability="Upstream Resolution"
                icon={GitBranch}
                isLast
              />
            </div>
          </div>
        </section>

        <section className="py-20 px-4 sm:px-6 lg:px-8 border-b" data-testid="section-intelligence">
          <div className="max-w-6xl mx-auto">
            <div className="mb-12 space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">What Makes It Different</h2>
              <p className="text-sm text-muted-foreground max-w-lg">
                Every stage uses structured analysis, not open-ended AI generation. The system reasons about your project methodically.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <CapabilityCard
                title="Independent AI Review"
                description="Multiple AI models evaluate your idea separately, then results are combined. You get a balanced assessment, not a single opinion."
                icon={Brain}
                testId="card-consensus"
              />
              <CapabilityCard
                title="Viability Assessment"
                description="Your idea is scored across technical feasibility, market potential, and execution effort. Different project types get tailored criteria."
                icon={BarChart3}
                testId="card-viability"
              />
              <CapabilityCard
                title="Automatic Requirements"
                description="Once your idea is validated, the system generates a complete technical specification including architecture, features, and data design."
                icon={FileText}
                testId="card-requirements"
              />
              <CapabilityCard
                title="Full Traceability"
                description="Every build instruction links back to a specific requirement. Every requirement links back to the original idea. You can always see why a step exists."
                icon={Search}
                testId="card-traceability"
              />
              <CapabilityCard
                title="Safety Checks"
                description="Each step is automatically classified as safe, cautious, or critical. Dangerous operations like database changes are flagged before you run them."
                icon={ShieldCheck}
                testId="card-integrity"
              />
              <CapabilityCard
                title="Automatic Error Handling"
                description="When a step fails, the system recognises repeated errors and escalates them. No AI guesswork involved — the rules are fixed and predictable."
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
                <h2 className="text-2xl font-semibold tracking-tight">Built-In Guardrails</h2>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
                  The platform keeps your build on track. Steps run in order, risky actions are flagged,
                  and problems are caught before they compound.
                </p>
              </div>
              <div className="space-y-4">
                <DisciplineItem
                  icon={Lock}
                  text="No skipping steps. Each stage must be completed before the next one opens. The system enforces this automatically."
                />
                <DisciplineItem
                  icon={ShieldCheck}
                  text="Every step is scanned and classified as safe, cautious, or critical. Irreversible actions like database changes are flagged before you proceed."
                />
                <DisciplineItem
                  icon={ServerCrash}
                  text="The system recognises when the same error keeps happening. Repeated failures are automatically escalated so they get resolved, not ignored."
                />
                <DisciplineItem
                  icon={RefreshCw}
                  text="When a step is blocked, the problem is routed back to the earlier stage that can fix it. Nothing moves forward until the issue is resolved."
                />
                <DisciplineItem
                  icon={CheckCircle2}
                  text="If your requirements change, any build instructions based on the old version are flagged. You always work from up-to-date information."
                />
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 px-4 sm:px-6 lg:px-8 border-b" data-testid="section-ide">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold tracking-tight">Works With Your IDE</h2>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
                  Plan2Prompt plans the build. Your IDE does the building.
                  You get clear, step-by-step instructions formatted for the tool you already use.
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
                        <h3 className="font-semibold text-sm">Structured Instructions, Not Suggestions</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Each build step includes what to do, which requirements it covers,
                          what order to follow, and what to watch out for. No guessing.
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
                          The same plan adapts its output to match your development environment.
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
              <h2 className="text-2xl font-semibold tracking-tight">Security and Control</h2>
              <p className="text-sm text-muted-foreground max-w-lg">
                Your projects, your data. The platform keeps everything separated, tracked, and secure.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-5 space-y-2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">Project Separation</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Each project is completely isolated. Data from one project is never
                    visible to another, even within the same account.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5 space-y-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">Roles and Permissions</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Admin and user roles with plan-based access levels. Admins get a dedicated
                    console for managing providers, reviewing usage, and auditing actions.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5 space-y-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">Usage Monitoring</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    AI usage is tracked per provider across all operations.
                    Plan limits are enforced and visible in real time.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5 space-y-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">Audit Trail</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Every admin action, feedback event, and resolution is logged
                    with a timestamp and who performed it. Nothing happens silently.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5 space-y-2">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">AI Health Checks</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    AI providers are tested automatically when the system starts.
                    Any provider that is unavailable or over its limit is excluded before you begin.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5 space-y-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">Secure Authentication</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Sign in securely with Replit Auth or email and password.
                    Sessions are encrypted and stored safely.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-20 px-4 sm:px-6 lg:px-8" data-testid="section-final-cta">
          <div className="max-w-6xl mx-auto text-center">
            <div className="max-w-md mx-auto space-y-5">
              <h2 className="text-2xl font-semibold tracking-tight">Build With Confidence</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Stop guessing whether your idea will work. Get a clear assessment,
                a proper plan, and step-by-step instructions to build it.
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
            Structured AI-powered build planning
          </p>
        </div>
      </footer>
    </div>
  );
}
