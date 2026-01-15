import { useEffect } from "react";
import { useLocation } from "wouter";

const LAST_NON_ADMIN_ROUTE_KEY = "admin_last_route";

export function useTrackNonAdminRoute() {
  const [location] = useLocation();

  useEffect(() => {
    if (!location.startsWith("/admin")) {
      sessionStorage.setItem(LAST_NON_ADMIN_ROUTE_KEY, location);
    }
  }, [location]);
}

export function getLastNonAdminRoute(): string {
  if (typeof window === "undefined") return "/";
  return sessionStorage.getItem(LAST_NON_ADMIN_ROUTE_KEY) || "/";
}
