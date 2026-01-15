import { useState, useRef } from "react";
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
  const pendingActionRef = useRef<(() => void) | null>(null);

  const requireProject = (action: () => void) => {
    if (activeProject) {
      action();
    } else {
      pendingActionRef.current = action;
      setShowDialog(true);
    }
  };

  const handleCreateProject = async () => {
    setIsCreating(true);
    try {
      await ensureDefaultProject();
      setShowDialog(false);
      if (pendingActionRef.current) {
        pendingActionRef.current();
        pendingActionRef.current = null;
      }
    } catch (error) {
      console.error("Failed to create project:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    setShowDialog(false);
    pendingActionRef.current = null;
  };

  const ProjectRequiredDialog = () => (
    <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Project Required</AlertDialogTitle>
          <AlertDialogDescription>
            You need a project before continuing. Would you like to create one now?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} data-testid="button-cancel-project">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleCreateProject} 
            disabled={isCreating}
            data-testid="button-create-project"
          >
            {isCreating ? "Creating..." : "Create a project"}
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
