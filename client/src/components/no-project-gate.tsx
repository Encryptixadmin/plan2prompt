import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FolderPlus, AlertCircle } from "lucide-react";
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

interface NoProjectGateProps {
  children: React.ReactNode;
}

export function NoProjectGate({ children }: NoProjectGateProps) {
  const { projects, isLoading, ensureDefaultProject } = useProject();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Loading projects...</p>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto p-3 rounded-full bg-muted w-fit mb-2">
              <FolderPlus className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle data-testid="text-no-project-title">Project Required</CardTitle>
            <CardDescription>
              You need a project before you can start working on ideas. Projects help keep your ideas and artifacts organised.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <Button
              className="w-full"
              size="lg"
              onClick={() => setShowConfirmDialog(true)}
              data-testid="button-create-first-project"
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              Create a project
            </Button>
          </CardContent>
        </Card>

        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Create your first project</AlertDialogTitle>
              <AlertDialogDescription>
                Projects help keep your ideas and artifacts organised. A default project will be created for you to get started.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel 
                disabled={isCreating}
                data-testid="button-cancel-create-first-project"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={isCreating}
                onClick={async (e) => {
                  e.preventDefault();
                  setIsCreating(true);
                  setError(null);
                  try {
                    await ensureDefaultProject();
                    setShowConfirmDialog(false);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed to create project. Please try again.");
                  } finally {
                    setIsCreating(false);
                  }
                }}
                data-testid="button-confirm-create-first-project"
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
      </div>
    );
  }

  return <>{children}</>;
}
