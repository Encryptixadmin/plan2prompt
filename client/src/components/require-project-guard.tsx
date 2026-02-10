import { useState, useRef } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const { activeProject, createProject } = useProject();
  const [showDialog, setShowDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const pendingActionRef = useRef<(() => void) | null>(null);

  const requireProject = (action: () => void) => {
    if (activeProject) {
      action();
    } else {
      pendingActionRef.current = action;
      setProjectName("");
      setShowDialog(true);
    }
  };

  const handleCreateProject = async (e: React.MouseEvent) => {
    e.preventDefault();
    const trimmedName = projectName.trim();
    if (!trimmedName) return;

    setIsCreating(true);
    setError(null);
    try {
      await createProject({ name: trimmedName });
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
    setProjectName("");
    pendingActionRef.current = null;
  };

  const ProjectRequiredDialog = () => (
    <AlertDialog open={showDialog} onOpenChange={(open) => {
      if (!open) handleCancel();
      else setShowDialog(open);
    }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Create a project first</AlertDialogTitle>
          <AlertDialogDescription>
            You need a project before you can continue. Give it a name to get started.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="require-project-name">Project name</Label>
          <Input
            id="require-project-name"
            placeholder="e.g. My App Idea"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            disabled={isCreating}
            autoFocus
            data-testid="input-require-project-name"
          />
        </div>
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
            disabled={isCreating || !projectName.trim()}
            data-testid="button-create-project"
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create project"
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
