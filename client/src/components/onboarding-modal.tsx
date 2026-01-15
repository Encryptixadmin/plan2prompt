import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lightbulb, FileText, Terminal, ChevronRight, ChevronLeft } from "lucide-react";

const ONBOARDING_KEY = "platform_onboarding_complete";

interface OnboardingStep {
  title: string;
  body: string[];
  icon: React.ReactNode;
}

const steps: OnboardingStep[] = [
  {
    title: "From idea to build-ready prompts",
    body: [
      "This platform helps you turn an idea into clear, executable build instructions.",
      "It does this in three deliberate steps:",
    ],
    icon: <Lightbulb className="h-6 w-6 text-primary" />,
  },
  {
    title: "Why the steps matter",
    body: [
      "Each step removes ambiguity from the previous one.",
      "Clear ideas produce better requirements. Clear requirements produce reliable build prompts.",
      "Skipping steps increases guesswork and reduces quality — so the platform protects the sequence.",
    ],
    icon: <FileText className="h-6 w-6 text-primary" />,
  },
  {
    title: "Work through artefacts, not pages",
    body: [
      "You're not just filling in forms.",
      "Each step creates a reusable artefact:",
    ],
    icon: <Terminal className="h-6 w-6 text-primary" />,
  },
  {
    title: "What this platform won't do",
    body: [
      "This platform won't:",
    ],
    icon: <Terminal className="h-6 w-6 text-primary" />,
  },
];

interface OnboardingModalProps {
  open: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

export function OnboardingModal({ open, onComplete, onSkip }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onSkip();
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              This platform helps you turn an idea into clear, executable build instructions.
            </p>
            <p className="text-muted-foreground">
              It does this in three deliberate steps:
            </p>
            <ul className="space-y-2 text-muted-foreground ml-4">
              <li className="flex items-start gap-2">
                <Lightbulb className="h-4 w-4 mt-1 text-primary flex-shrink-0" />
                <span>Clarifying the idea</span>
              </li>
              <li className="flex items-start gap-2">
                <FileText className="h-4 w-4 mt-1 text-primary flex-shrink-0" />
                <span>Defining exact requirements</span>
              </li>
              <li className="flex items-start gap-2">
                <Terminal className="h-4 w-4 mt-1 text-primary flex-shrink-0" />
                <span>Generating step-by-step build prompts</span>
              </li>
            </ul>
          </div>
        );
      case 1:
        return (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Each step removes ambiguity from the previous one.
            </p>
            <p className="text-muted-foreground">
              Clear ideas produce better requirements. Clear requirements produce reliable build prompts.
            </p>
            <p className="text-muted-foreground">
              Skipping steps increases guesswork and reduces quality — so the platform protects the sequence.
            </p>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              You're not just filling in forms.
            </p>
            <p className="text-muted-foreground">
              Each step creates a reusable artefact:
            </p>
            <ul className="space-y-2 text-muted-foreground ml-4">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>An idea reference</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>A requirements document</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>A set of build prompts</span>
              </li>
            </ul>
            <p className="text-muted-foreground">
              You can stop, review, and resume at any point.
            </p>
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              This platform won't:
            </p>
            <ul className="space-y-2 text-muted-foreground ml-4">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Auto-build your app</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Hide decisions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Rush you forward</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Lock you into one tool</span>
              </li>
            </ul>
            <p className="text-muted-foreground">
              It's designed to help you think clearly and build with confidence.
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  const isLastStep = currentStep === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            {steps[currentStep].icon}
            <DialogTitle>{steps[currentStep].title}</DialogTitle>
          </div>
          <DialogDescription className="sr-only">
            Onboarding step {currentStep + 1} of {steps.length}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {renderStepContent()}
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
          <span>Step {currentStep + 1} of {steps.length}</span>
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button variant="ghost" onClick={handleBack} data-testid="button-onboarding-back">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            {currentStep === 0 && (
              <Button variant="ghost" onClick={handleSkip} data-testid="button-onboarding-skip">
                Skip for now
              </Button>
            )}
          </div>
          <Button onClick={handleNext} data-testid="button-onboarding-next">
            {isLastStep ? (
              <>
                <Lightbulb className="h-4 w-4 mr-2" />
                Start with an Idea
              </>
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function useOnboarding() {
  const isComplete = () => {
    return localStorage.getItem(ONBOARDING_KEY) === "true";
  };

  const markComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
  };

  const reset = () => {
    localStorage.removeItem(ONBOARDING_KEY);
  };

  return { isComplete, markComplete, reset };
}

export { ONBOARDING_KEY };
