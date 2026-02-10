import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, FolderPlus, AlertCircle } from "lucide-react";
import { useProject } from "@/contexts/project-context";

interface NoProjectGateProps {
  children: React.ReactNode;
}

export function NoProjectGate({ children }: NoProjectGateProps) {
  const { projects, isLoading, createProject } = useProject();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

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
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedName = name.trim();
      if (!trimmedName) return;

      setIsCreating(true);
      setError(null);
      try {
        await createProject({
          name: trimmedName,
          description: description.trim() || undefined,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create project. Please try again.");
      } finally {
        setIsCreating(false);
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto p-3 rounded-full bg-muted w-fit mb-2">
              <FolderPlus className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle data-testid="text-no-project-title">Create Your First Project</CardTitle>
            <CardDescription>
              Projects keep your ideas and artifacts organised. Give your project a name to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="project-name">Project name</Label>
                <Input
                  id="project-name"
                  placeholder="e.g. My App Idea"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isCreating}
                  autoFocus
                  data-testid="input-project-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-description">
                  Description <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="project-description"
                  placeholder="What is this project about?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isCreating}
                  className="resize-none"
                  rows={3}
                  data-testid="input-project-description"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isCreating || !name.trim()}
                data-testid="button-create-first-project"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <FolderPlus className="h-4 w-4 mr-2" />
                    Create project
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
