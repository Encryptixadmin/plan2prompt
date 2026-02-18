import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Lightbulb, FileText, Zap, ArrowRight, Shield, Users, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export default function Landing() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              <span className="font-semibold">Plan2Prompt</span>
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
                <a href="/auth">Get Started</a>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-14">
        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-card">
          <div className="max-w-6xl mx-auto">
            <div className="max-w-2xl space-y-6">
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
                Validate ideas before
                <br />
                <span className="text-primary">you start building</span>
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-lg">
                AI-powered consensus analysis helps you evaluate app concepts, 
                generate technical requirements, and get IDE-specific build instructions.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="lg" asChild data-testid="button-get-started-hero">
                  <a href="/auth">
                    Get Started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" />
                  Secure Auth
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Multi-project support
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-b">
          <div className="max-w-6xl mx-auto">
            <div className="mb-12 space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">
                How it works
              </h2>
              <p className="text-muted-foreground text-sm max-w-lg">
                A three-step pipeline from concept to code-ready instructions.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="p-6 space-y-3">
                  <div className="h-9 w-9 rounded-md bg-amber-500/10 flex items-center justify-center">
                    <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="font-medium text-sm">1. Submit your idea</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Describe your app concept. Multiple AI providers analyze 
                      viability through consensus evaluation.
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 space-y-3">
                  <div className="h-9 w-9 rounded-md bg-blue-500/10 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="font-medium text-sm">2. Generate requirements</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Convert validated ideas into detailed technical specifications 
                      including architecture, data models, and security.
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 space-y-3">
                  <div className="h-9 w-9 rounded-md bg-emerald-500/10 flex items-center justify-center">
                    <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="font-medium text-sm">3. Get build prompts</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Receive sequential, IDE-specific prompts to build your app 
                      with AI coding assistants.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-card">
          <div className="max-w-6xl mx-auto">
            <div className="max-w-lg space-y-4">
              <h2 className="text-2xl font-semibold tracking-tight">
                Ready to validate your next idea?
              </h2>
              <p className="text-sm text-muted-foreground">
                Sign in or create an account to start the pipeline.
              </p>
              <Button asChild data-testid="button-get-started-cta">
                <a href="/auth">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Plan2Prompt
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            AI consensus technology
          </p>
        </div>
      </footer>
    </div>
  );
}
