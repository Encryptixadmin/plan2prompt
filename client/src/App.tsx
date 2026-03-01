import { useState, useEffect, createContext, useContext } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Ideas from "@/pages/ideas";
import Requirements from "@/pages/requirements";
import Prompts from "@/pages/prompts";
import Admin from "@/pages/admin";
import Account from "@/pages/account";
import Landing from "@/pages/landing";
import AuthPage from "@/pages/auth";
import { OnboardingModal, useOnboarding } from "@/components/onboarding-modal";
import { ProjectProvider } from "@/contexts/project-context";
import { NoProjectGate } from "@/components/no-project-gate";
import { useTrackNonAdminRoute } from "@/hooks/use-admin-navigation";
import { useAuth } from "@/hooks/use-auth";
import { ThemeProvider } from "@/components/theme-provider";
import { AppShell } from "@/components/app-shell";
import { ErrorBoundary } from "@/components/error-boundary";
import { Loader2 } from "lucide-react";

interface OnboardingContextType {
  openOnboarding: () => void;
}
const OnboardingContext = createContext<OnboardingContextType>({ openOnboarding: () => {} });
export const useOnboardingContext = () => useContext(OnboardingContext);

function RouteTracker() {
  useTrackNonAdminRoute();
  return null;
}

function AuthenticatedRouter() {
  return (
    <>
      <RouteTracker />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/ideas" component={Ideas} />
        <Route path="/requirements" component={Requirements} />
        <Route path="/prompts" component={Prompts} />
        <Route path="/admin" component={Admin} />
        <Route path="/account" component={Account} />
        <Route path="/auth" component={AuthRedirect} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function OnboardingWrapper({ children }: { children: React.ReactNode }) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { isComplete, markComplete } = useOnboarding();

  const { data: ideasData, isLoading } = useQuery<{ success: boolean; data: unknown[] }>({
    queryKey: ["/api/ideas"],
  });

  useEffect(() => {
    if (isLoading) return;
    
    const hasArtifacts = ideasData?.data && ideasData.data.length > 0;
    const onboardingComplete = isComplete();
    
    if (!hasArtifacts && !onboardingComplete) {
      setShowOnboarding(true);
    }
  }, [isLoading, ideasData]);

  const openOnboarding = () => {
    setShowOnboarding(true);
  };

  const handleComplete = () => {
    markComplete();
    setShowOnboarding(false);
  };

  const handleSkip = () => {
    markComplete();
    setShowOnboarding(false);
  };

  return (
    <OnboardingContext.Provider value={{ openOnboarding }}>
      {children}
      {showOnboarding && (
        <OnboardingModal 
          open={showOnboarding} 
          onComplete={handleComplete} 
          onSkip={handleSkip} 
        />
      )}
    </OnboardingContext.Provider>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function AuthRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/");
  }, [setLocation]);
  return <LoadingScreen />;
}

function AppContent() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    const path = window.location.pathname;
    if (path === "/auth") {
      return <AuthPage />;
    }
    return <Landing />;
  }

  return (
    <ProjectProvider>
      <NoProjectGate>
        <OnboardingWrapper>
          <AppShell>
            <AuthenticatedRouter />
          </AppShell>
        </OnboardingWrapper>
      </NoProjectGate>
    </ProjectProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <ErrorBoundary>
            <AppContent />
          </ErrorBoundary>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
