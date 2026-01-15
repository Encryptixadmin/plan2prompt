import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArtifactPreview } from "./artifact-preview";
import { Loader2 } from "lucide-react";
import type { ArtifactMetadata, ArtifactSection } from "@shared/types/artifact";

type CommitmentType = "accept-idea" | "lock-requirements" | "generate-prompts" | "generate-requirements";

interface CommitmentConfirmationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: CommitmentType;
  title: string;
  previewTitle: string;
  previewMetadata?: Partial<ArtifactMetadata>;
  previewSections?: ArtifactSection[];
  previewContent?: string;
  onConfirm: () => void;
  isLoading?: boolean;
}

const commitmentCopy: Record<CommitmentType, { title: string; description: string; action: string; whatNext: string }> = {
  "accept-idea": {
    title: "Accept This Idea?",
    description: "You're about to save this validated idea as an artifact.",
    action: "Accept Idea",
    whatNext: "This will create a stable reference that can be used to generate detailed requirements.",
  },
  "lock-requirements": {
    title: "Lock These Requirements?",
    description: "You're about to lock these requirements as final.",
    action: "Lock Requirements",
    whatNext: "This creates a stable reference for generating build prompts. The requirements will remain editable, but the locked version serves as the baseline.",
  },
  "generate-prompts": {
    title: "Generate Build Prompts?",
    description: "You're about to generate prompts from these requirements.",
    action: "Generate Prompts",
    whatNext: "Build prompts will be created based on the requirements shown. You can review and copy each prompt before use.",
  },
  "generate-requirements": {
    title: "Generate Requirements?",
    description: "You're about to generate detailed requirements from this idea.",
    action: "Generate Requirements",
    whatNext: "Comprehensive requirements will be created based on the idea analysis. You can review them before accepting.",
  },
};

export function CommitmentConfirmation({
  open,
  onOpenChange,
  type,
  title,
  previewTitle,
  previewMetadata,
  previewSections,
  previewContent,
  onConfirm,
  isLoading = false,
}: CommitmentConfirmationProps) {
  const copy = commitmentCopy[type];

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.description}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="my-4">
          <ArtifactPreview
            title={previewTitle}
            metadata={previewMetadata}
            sections={previewSections}
            rawContent={previewContent}
            maxHeight="300px"
            showMetadata={true}
          />
        </div>

        <div className="bg-muted/50 rounded-md p-3 text-sm text-muted-foreground">
          <strong className="text-foreground">What happens next:</strong>
          <p className="mt-1">{copy.whatNext}</p>
        </div>

        <AlertDialogFooter className="mt-4">
          <AlertDialogCancel disabled={isLoading} data-testid="button-cancel-commitment">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isLoading}
            data-testid="button-confirm-commitment"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              copy.action
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface ConfidenceCopyProps {
  type: CommitmentType;
  className?: string;
}

export function ConfidenceCopy({ type, className = "" }: ConfidenceCopyProps) {
  const messages: Record<CommitmentType, string> = {
    "accept-idea": "Accepting saves this idea as a reference for future steps.",
    "lock-requirements": "Locking creates a stable baseline for generating build prompts.",
    "generate-prompts": "Prompts are generated from your requirements and can be copied to your IDE.",
    "generate-requirements": "Requirements are derived from your validated idea analysis.",
  };

  return (
    <p className={`text-xs text-muted-foreground ${className}`} data-testid="confidence-copy">
      {messages[type]}
    </p>
  );
}
