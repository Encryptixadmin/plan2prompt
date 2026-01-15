import { useQuery } from "@tanstack/react-query";

interface AdminHealthResponse {
  success: boolean;
}

export function useAdminStatus() {
  const { data, isLoading } = useQuery<AdminHealthResponse>({
    queryKey: ["/api/admin/health"],
    retry: false,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  return {
    isAdmin: data?.success === true,
    isCheckingAdmin: isLoading,
  };
}
