import { useState, useEffect } from "react";
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
import { OnboardingModal, useOnboarding } from "@/components/onboarding-modal";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/ideas" component={Ideas} />
      <Route path="/requirements" component={Requirements} />
      <Route path="/prompts" component={Prompts} />
      <Route component={NotFound} />
    </Switch>
  );
}

function OnboardingWrapper({ children }: { children: React.ReactNode }) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { isComplete, markComplete } = useOnboarding();

  // Check if user has any existing artifacts
  const { data: ideasData, isLoading } = useQuery<{ success: boolean; data: unknown[] }>({
    queryKey: ["/api/ideas"],
  });

  useEffect(() => {
    if (isLoading) return;
    
    const hasArtifacts = ideasData?.data && ideasData.data.length > 0;
    const onboardingComplete = isComplete();
    
    // Show onboarding if no artifacts AND not completed before
    if (!hasArtifacts && !onboardingComplete) {
      setShowOnboarding(true);
    }
  }, [isLoading, ideasData, isComplete]);

  const handleComplete = () => {
    markComplete();
    setShowOnboarding(false);
  };

  const handleSkip = () => {
    markComplete();
    setShowOnboarding(false);
  };

  return (
    <>
      {children}
      <OnboardingModal 
        open={showOnboarding} 
        onComplete={handleComplete} 
        onSkip={handleSkip} 
      />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <OnboardingWrapper>
          <Router />
        </OnboardingWrapper>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
