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
import { AlertTriangle, GitBranch } from "lucide-react";

interface VersionWarningDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  artifactType: "idea" | "requirements";
  downstreamCount?: number;
}

export function VersionWarningDialog({
  open,
  onConfirm,
  onCancel,
  artifactType,
  downstreamCount = 0,
}: VersionWarningDialogProps) {
  const typeLabel = artifactType === "idea" ? "idea" : "requirements";
  const downstreamType = artifactType === "idea" ? "requirements" : "prompts";

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-amber-100 dark:bg-amber-900/30">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <AlertDialogTitle>Create New Version?</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-4">
            <p>
              Revising this {typeLabel} will create a new version. Existing outputs will remain unchanged.
            </p>
            
            {downstreamCount > 0 && (
              <div className="p-3 rounded-md bg-muted border">
                <div className="flex items-start gap-2">
                  <GitBranch className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="text-sm">
                    <span className="font-medium">{downstreamCount} {downstreamType}</span>{" "}
                    {downstreamCount === 1 ? "was" : "were"} created from this version.
                    {" "}They will be marked as "derived from previous version" but will not be deleted or modified.
                  </div>
                </div>
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              This approach preserves your work history and lets you explore changes safely.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} data-testid="button-cancel-revision">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} data-testid="button-confirm-revision">
            Create New Version
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
