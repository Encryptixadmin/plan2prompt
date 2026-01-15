import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, setActiveProjectId as setApiActiveProjectId } from "@/lib/queryClient";
import type { ProjectWithRole, CreateProjectInput } from "@shared/types/project";
import { getRolePermissions } from "@shared/types/project";

interface ProjectContextType {
  activeProject: ProjectWithRole | null;
  projects: ProjectWithRole[];
  isLoading: boolean;
  permissions: ReturnType<typeof getRolePermissions> | null;
  setActiveProject: (project: ProjectWithRole) => void;
  createProject: (input: CreateProjectInput) => Promise<ProjectWithRole>;
  ensureDefaultProject: () => Promise<ProjectWithRole>;
  refreshProjects: () => void;
}

const ProjectContext = createContext<ProjectContextType | null>(null);

const ACTIVE_PROJECT_KEY = "active-project-id";

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(ACTIVE_PROJECT_KEY);
      if (stored) {
        setApiActiveProjectId(stored);
      }
      return stored;
    }
    return null;
  });

  const { data: projectsData, isLoading, refetch } = useQuery<{
    success: boolean;
    data: ProjectWithRole[];
  }>({
    queryKey: ["/api/projects"],
  });

  const ensureDefaultMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/projects/ensure-default");
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success && data.data) {
        const project = data.data;
        setActiveProjectId(project.id);
        localStorage.setItem(ACTIVE_PROJECT_KEY, project.id);
        setApiActiveProjectId(project.id);
      }
      refetch();
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: async (input: CreateProjectInput) => {
      const response = await apiRequest("POST", "/api/projects", input);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success && data.data) {
        const newProject: ProjectWithRole = {
          ...data.data,
          role: "owner",
          memberCount: 1,
        };
        setActiveProjectId(newProject.id);
        localStorage.setItem(ACTIVE_PROJECT_KEY, newProject.id);
        refetch();
      }
    },
  });

  const projects = projectsData?.data || [];

  useEffect(() => {
    if (!isLoading && projects.length === 0) {
      ensureDefaultMutation.mutate();
    }
  }, [isLoading, projects.length]);

  useEffect(() => {
    if (!isLoading && projects.length > 0 && !activeProjectId) {
      const firstProject = projects[0];
      setActiveProjectId(firstProject.id);
      localStorage.setItem(ACTIVE_PROJECT_KEY, firstProject.id);
      setApiActiveProjectId(firstProject.id);
    }
  }, [isLoading, projects, activeProjectId]);

  useEffect(() => {
    setApiActiveProjectId(activeProjectId);
  }, [activeProjectId]);

  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0] || null;

  const permissions = activeProject ? getRolePermissions(activeProject.role) : null;

  const setActiveProject = useCallback((project: ProjectWithRole) => {
    setActiveProjectId(project.id);
    localStorage.setItem(ACTIVE_PROJECT_KEY, project.id);
    setApiActiveProjectId(project.id);
    queryClient.invalidateQueries({ queryKey: ["/api/ideas"] });
    queryClient.invalidateQueries({ queryKey: ["/api/requirements"] });
    queryClient.invalidateQueries({ queryKey: ["/api/prompts"] });
    queryClient.invalidateQueries({ queryKey: ["/api/artifacts"] });
  }, []);

  const createProject = useCallback(async (input: CreateProjectInput): Promise<ProjectWithRole> => {
    const result = await createProjectMutation.mutateAsync(input);
    return {
      ...result.data,
      role: "owner" as const,
      memberCount: 1,
    };
  }, [createProjectMutation]);

  const ensureDefaultProject = useCallback(async (): Promise<ProjectWithRole> => {
    const result = await ensureDefaultMutation.mutateAsync();
    if (!result.success || !result.data) {
      throw new Error("Failed to ensure default project");
    }
    return {
      ...result.data,
      role: "owner" as const,
      memberCount: 1,
    };
  }, [ensureDefaultMutation]);

  const refreshProjects = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <ProjectContext.Provider
      value={{
        activeProject,
        projects,
        isLoading,
        permissions,
        setActiveProject,
        createProject,
        ensureDefaultProject,
        refreshProjects,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}
