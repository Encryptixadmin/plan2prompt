import { useEffect } from "react";
import { useLocation } from "wouter";

const LAST_NON_ADMIN_ROUTE_KEY = "admin_last_route";
const LAST_PROJECT_KEY = "admin_last_project";

export function useTrackNonAdminRoute() {
  const [location] = useLocation();

  useEffect(() => {
    if (!location.startsWith("/admin")) {
      sessionStorage.setItem(LAST_NON_ADMIN_ROUTE_KEY, location);
    }
  }, [location]);
}

export function storeLastProject(projectId: string | null) {
  if (projectId) {
    sessionStorage.setItem(LAST_PROJECT_KEY, projectId);
  }
}

export function getLastNonAdminRoute(): string {
  if (typeof window === "undefined") return "/";
  return sessionStorage.getItem(LAST_NON_ADMIN_ROUTE_KEY) || "/";
}

export function getLastProject(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(LAST_PROJECT_KEY);
}
