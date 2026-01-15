import { useState, useEffect, createContext, useContext } from "react";
import { Switch, Route } from "wouter";
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
import Landing from "@/pages/landing";
import { OnboardingModal, useOnboarding } from "@/components/onboarding-modal";
import { ProjectProvider } from "@/contexts/project-context";
import { useTrackNonAdminRoute } from "@/hooks/use-admin-navigation";
import { useAuth } from "@/hooks/use-auth";
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
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="mt-4 text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function AppContent() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Landing />;
  }

  return (
    <ProjectProvider>
      <OnboardingWrapper>
        <AuthenticatedRouter />
      </OnboardingWrapper>
    </ProjectProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
