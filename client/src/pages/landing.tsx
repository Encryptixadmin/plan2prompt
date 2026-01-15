import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Lightbulb, FileText, Wand2, Shield, Users, Zap } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-6 w-6 text-primary" />
              <span className="font-semibold text-lg">IdeaForge</span>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="/api/login"
                target="_top"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                data-testid="link-login-nav"
              >
                Log in
              </a>
              <Button asChild data-testid="button-get-started-nav">
                <a href="/api/login" target="_top">Get Started</a>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-16">
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-8">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold tracking-tight">
                  Transform Ideas into{" "}
                  <span className="text-primary">Production-Ready</span> Apps
                </h1>
                <p className="text-lg text-muted-foreground max-w-lg">
                  Validate your app ideas with AI-powered consensus analysis. 
                  Generate comprehensive requirements and build prompts tailored 
                  to your favorite IDE.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Button size="lg" asChild data-testid="button-get-started-hero">
                    <a href="/api/login" target="_top">Get Started Free</a>
                  </Button>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Shield className="h-4 w-4" />
                    Free forever plan
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    No credit card required
                  </span>
                </div>
              </div>
              <div className="relative hidden lg:block">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 rounded-3xl transform rotate-3" />
                <Card className="relative transform -rotate-1 hover:rotate-0 transition-transform duration-500">
                  <CardContent className="p-8">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Lightbulb className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">Idea Analysis</div>
                          <div className="text-sm text-muted-foreground">AI consensus validation</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">Requirements Doc</div>
                          <div className="text-sm text-muted-foreground">Comprehensive specs</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Wand2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">Build Prompts</div>
                          <div className="text-sm text-muted-foreground">IDE-specific guidance</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-serif font-bold mb-4">
                How It Works
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                A streamlined pipeline to take your ideas from concept to code
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <Card className="hover-elevate">
                <CardContent className="p-6 text-center">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Lightbulb className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">1. Submit Your Idea</h3>
                  <p className="text-sm text-muted-foreground">
                    Describe your app concept and let multiple AI providers analyze 
                    its viability through consensus.
                  </p>
                </CardContent>
              </Card>
              <Card className="hover-elevate">
                <CardContent className="p-6 text-center">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">2. Generate Requirements</h3>
                  <p className="text-sm text-muted-foreground">
                    Convert validated ideas into detailed requirements documents 
                    ready for development.
                  </p>
                </CardContent>
              </Card>
              <Card className="hover-elevate">
                <CardContent className="p-6 text-center">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">3. Get Build Prompts</h3>
                  <p className="text-sm text-muted-foreground">
                    Receive sequential, IDE-specific prompts to build your app 
                    with AI coding assistants.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-serif font-bold mb-4">
              Ready to Build?
            </h2>
            <p className="text-muted-foreground mb-8">
              Join the closed alpha and start transforming your ideas today.
            </p>
            <Button size="lg" asChild data-testid="button-get-started-cta">
              <a href="/api/login" target="_top">Get Started Free</a>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            <span className="text-sm text-muted-foreground">
              IdeaForge - Closed Alpha
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Built with AI consensus technology
          </p>
        </div>
      </footer>
    </div>
  );
}
