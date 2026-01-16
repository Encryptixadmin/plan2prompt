import { useState, useRef } from "react";
import { Loader2 } from "lucide-react";
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
import { useProject } from "@/contexts/project-context";

export function useRequireProject() {
  const { activeProject, ensureDefaultProject } = useProject();
  const [showDialog, setShowDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingActionRef = useRef<(() => void) | null>(null);

  const requireProject = (action: () => void) => {
    if (activeProject) {
      action();
    } else {
      pendingActionRef.current = action;
      setShowDialog(true);
    }
  };

  const handleCreateProject = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setError(null);
    try {
      await ensureDefaultProject();
      setShowDialog(false);
      if (pendingActionRef.current) {
        pendingActionRef.current();
        pendingActionRef.current = null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    setShowDialog(false);
    setError(null);
    pendingActionRef.current = null;
  };

  const ProjectRequiredDialog = () => (
    <AlertDialog open={showDialog} onOpenChange={(open) => {
      if (!open) handleCancel();
      else setShowDialog(open);
    }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Create your first project</AlertDialogTitle>
          <AlertDialogDescription>
            Projects help keep your ideas and artifacts organised. You need a project before you can continue with this action.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} disabled={isCreating} data-testid="button-cancel-project">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleCreateProject} 
            disabled={isCreating}
            data-testid="button-create-project"
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create a project"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return {
    requireProject,
    ProjectRequiredDialog,
    hasActiveProject: !!activeProject,
  };
}
