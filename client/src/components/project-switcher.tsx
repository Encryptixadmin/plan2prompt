import { useState, useRef, useEffect } from "react";
import { useProject } from "@/contexts/project-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Folder, ChevronDown, Check, Users, Pencil, X } from "lucide-react";
import type { ProjectWithRole } from "@shared/types/project";
import { CreateProjectDialog } from "./create-project-dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function ProjectSwitcher() {
  const { activeProject, projects, setActiveProject, isLoading, refreshProjects } = useProject();
  const [open, setOpen] = useState(false);
  const [confirmProject, setConfirmProject] = useState<ProjectWithRole | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (renamingProjectId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingProjectId]);

  const handleSelectProject = (project: ProjectWithRole) => {
    if (renamingProjectId) return;
    if (project.id === activeProject?.id) {
      setOpen(false);
      return;
    }
    setConfirmProject(project);
  };

  const confirmSwitch = () => {
    if (confirmProject) {
      setActiveProject(confirmProject);
      setConfirmProject(null);
      setOpen(false);
    }
  };

  const cancelSwitch = () => {
    setConfirmProject(null);
  };

  const startRename = (e: React.MouseEvent, project: ProjectWithRole) => {
    e.stopPropagation();
    setRenamingProjectId(project.id);
    setRenameValue(project.name);
  };

  const cancelRename = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setRenamingProjectId(null);
    setRenameValue("");
  };

  const submitRename = async (e?: React.MouseEvent | React.FormEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    const trimmed = renameValue.trim();
    if (!trimmed || !renamingProjectId) return;

    const project = projects.find(p => p.id === renamingProjectId);
    if (project && trimmed === project.name) {
      cancelRename();
      return;
    }

    setIsRenaming(true);
    try {
      await apiRequest("PUT", `/api/projects/${renamingProjectId}`, { name: trimmed });
      refreshProjects();
      if (activeProject?.id === renamingProjectId) {
        setActiveProject({ ...activeProject, name: trimmed });
      }
      toast({ title: "Project renamed", description: `Project renamed to "${trimmed}"` });
      setRenamingProjectId(null);
      setRenameValue("");
    } catch {
      toast({ title: "Rename failed", description: "Could not rename the project. Please try again.", variant: "destructive" });
    } finally {
      setIsRenaming(false);
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitRename();
    } else if (e.key === "Escape") {
      cancelRename();
    }
  };

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled data-testid="button-project-switcher-loading">
        <Folder className="h-4 w-4 mr-2" />
        Loading...
      </Button>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) cancelRename(); }}>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            data-testid="button-project-switcher"
          >
            <Folder className="h-4 w-4" />
            <span className="truncate max-w-[150px]">
              {activeProject?.name || "Select Project"}
            </span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Switch Project</DialogTitle>
            <DialogDescription>
              Select a project to work with. Switching will update visible artifacts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-4 max-h-[300px] overflow-y-auto">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => handleSelectProject(project)}
                className={`w-full flex items-center justify-between p-3 rounded-md border transition-colors cursor-pointer hover-elevate ${
                  project.id === activeProject?.id
                    ? "border-primary bg-primary/5"
                    : "border-border"
                }`}
                data-testid={`button-select-project-${project.id}`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Folder className="h-5 w-5 text-muted-foreground shrink-0" />
                  {renamingProjectId === project.id ? (
                    <form onSubmit={submitRename} className="flex items-center gap-1.5 flex-1 min-w-0" onClick={e => e.stopPropagation()}>
                      <Input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={handleRenameKeyDown}
                        disabled={isRenaming}
                        className="h-7 text-sm"
                        data-testid={`input-rename-project-${project.id}`}
                      />
                      <Button type="submit" size="icon" variant="ghost" disabled={isRenaming || !renameValue.trim()} data-testid={`button-confirm-rename-${project.id}`}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" onClick={cancelRename} disabled={isRenaming} data-testid={`button-cancel-rename-${project.id}`}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </form>
                  ) : (
                    <div className="text-left min-w-0">
                      <div className="font-medium truncate">{project.name}</div>
                      {project.description && (
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {project.description}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {renamingProjectId !== project.id && (
                  <div className="flex items-center gap-2 shrink-0">
                    {project.role === "owner" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => startRename(e, project)}
                        data-testid={`button-rename-project-${project.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {project.memberCount && project.memberCount > 1 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        {project.memberCount}
                      </div>
                    )}
                    <Badge variant="outline" className="text-xs capitalize">
                      {project.role}
                    </Badge>
                    {project.id === activeProject?.id && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setOpen(false);
                setShowCreateDialog(true);
              }}
              data-testid="button-create-new-project"
            >
              Create New Project
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmProject} onOpenChange={(open) => !open && cancelSwitch()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch Project?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to switch to <strong>{confirmProject?.name}</strong>. 
              This will update the visible artifacts to show only those from the new project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-switch">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSwitch} data-testid="button-confirm-switch">
              Switch Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateProjectDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog} 
      />
    </>
  );
}
