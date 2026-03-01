import { useState } from "react";
import { usePageTitle } from "@/hooks/use-page-title";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Lightbulb, Loader2, Mail, Lock, User, ArrowLeft, Moon, Sun, BrainCircuit, ScanSearch, Cable } from "lucide-react";
import { SiReplit } from "react-icons/si";
import { useTheme } from "@/components/theme-provider";
import { apiRequest } from "@/lib/queryClient";

type AuthMode = "login" | "register";

export default function AuthPage() {
  usePageTitle("Sign In", "Sign in to Plan2Prompt to validate your app ideas, generate requirements, and produce IDE-ready build instructions.");
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useTheme();

  const loginMutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message.includes("401") ? "Invalid email or password" : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: { email: string; password: string; firstName?: string; lastName?: string }) => {
      const res = await apiRequest("POST", "/api/auth/register", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message.includes("409") ? "An account with this email already exists" : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "login") {
      loginMutation.mutate({ email, password });
    } else {
      registerMutation.mutate({
        email,
        password,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
      });
    }
  };

  const isPending = loginMutation.isPending || registerMutation.isPending;

  const valuePropItems = [
    {
      icon: BrainCircuit,
      title: "Multi-AI Consensus",
      description: "Multiple AI providers review and validate every output",
    },
    {
      icon: ScanSearch,
      title: "Full Traceability",
      description: "Every prompt links back to requirements with audit trails",
    },
    {
      icon: Cable,
      title: "Direct IDE Connection",
      description: "MCP integration delivers prompts straight to your editor",
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <a href="/" className="flex items-center gap-2 text-foreground" data-testid="link-home">
              <ArrowLeft className="h-4 w-4" />
              <Lightbulb className="h-5 w-5 text-primary" />
              <span className="font-semibold">Plan2Prompt</span>
            </a>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              data-testid="button-theme-toggle-auth"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex pt-14">
        <div className="hidden lg:flex lg:w-1/2 bg-auth-brand bg-dot-pattern relative items-center justify-center p-12">
          <div className="max-w-md space-y-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10">
                  <Lightbulb className="h-5 w-5 text-primary" />
                </div>
                <span className="text-2xl font-bold text-foreground">Plan2Prompt</span>
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-foreground" data-testid="text-auth-branding-headline">
                Transform ideas into
                <span className="text-gradient-primary"> production-ready</span> AI prompts
              </h2>
              <p className="text-muted-foreground text-base leading-relaxed" data-testid="text-auth-branding-tagline">
                The structured pipeline that turns rough concepts into validated, traceable build instructions.
              </p>
            </div>

            <div className="space-y-5">
              {valuePropItems.map((item) => (
                <div key={item.title} className="flex items-start gap-4" data-testid={`auth-value-prop-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                  <div className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-md bg-primary/10">
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm text-foreground">{item.title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="w-full lg:w-1/2 flex flex-col">
          <div className="lg:hidden bg-auth-brand bg-dot-pattern px-6 py-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10">
                <Lightbulb className="h-4 w-4 text-primary" />
              </div>
              <span className="text-lg font-bold text-foreground">Plan2Prompt</span>
            </div>
            <p className="text-sm text-muted-foreground" data-testid="text-auth-mobile-tagline">
              Transform ideas into production-ready AI prompts
            </p>
          </div>

          <div className="flex-1 flex items-center justify-center px-4 py-12">
            <Card className="w-full max-w-md">
              <CardHeader className="space-y-1 text-center">
                <CardTitle className="text-2xl font-bold" data-testid="text-auth-title">
                  {mode === "login" ? "Welcome back" : "Create an account"}
                </CardTitle>
                <CardDescription data-testid="text-auth-description">
                  {mode === "login"
                    ? "Sign in to your Plan2Prompt account"
                    : "Get started with Plan2Prompt"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  variant="outline"
                  className="w-full"
                  asChild
                  data-testid="button-replit-login"
                >
                  <a href="/api/login" target="_top">
                    <SiReplit className="mr-2 h-4 w-4" />
                    Continue with Replit
                  </a>
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or</span>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {mode === "register" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First name</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="firstName"
                            placeholder="Mat"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className="pl-9"
                            data-testid="input-first-name"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last name</Label>
                        <Input
                          id="lastName"
                          placeholder="Edwards"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          data-testid="input-last-name"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="pl-9"
                        data-testid="input-email"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        placeholder={mode === "register" ? "Min 8 characters" : "Your password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={mode === "register" ? 8 : undefined}
                        className="pl-9"
                        data-testid="input-password"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isPending}
                    data-testid="button-auth-submit"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {mode === "login" ? "Signing in..." : "Creating account..."}
                      </>
                    ) : (
                      mode === "login" ? "Sign in" : "Create account"
                    )}
                  </Button>
                </form>

                <div className="text-center text-sm text-muted-foreground">
                  {mode === "login" ? (
                    <p>
                      Don't have an account?{" "}
                      <button
                        type="button"
                        onClick={() => setMode("register")}
                        className="text-primary underline-offset-4 hover:underline"
                        data-testid="button-switch-to-register"
                      >
                        Sign up
                      </button>
                    </p>
                  ) : (
                    <p>
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => setMode("login")}
                        className="text-primary underline-offset-4 hover:underline"
                        data-testid="button-switch-to-login"
                      >
                        Sign in
                      </button>
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
