import { useProject } from "@/contexts/project-context";
import { Badge } from "@/components/ui/badge";
import { Folder } from "lucide-react";

export function ActiveProjectIndicator() {
  const { activeProject, isLoading } = useProject();

  if (isLoading) {
    return (
      <div 
        className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-md"
        data-testid="indicator-project-loading"
      >
        <Folder className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (!activeProject) {
    return null;
  }

  return (
    <div 
      className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-md"
      data-testid="indicator-active-project"
    >
      <Folder className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-sm font-medium truncate max-w-[200px]">
        {activeProject.name}
      </span>
      <Badge variant="outline" className="text-xs capitalize">
        {activeProject.role}
      </Badge>
    </div>
  );
}
