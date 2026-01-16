import { useQuery } from "@tanstack/react-query";

interface ProviderStatus {
  provider: string;
  enabled: boolean;
  validated: boolean;
  validationError: string | null;
  modelId: string;
  configured: boolean;
}

interface AdminHealth {
  providers: ProviderStatus[];
}

interface AdminHealthResponse {
  success: boolean;
  data: AdminHealth;
}

export function useAIProviderStatus() {
  const { data, isLoading, error, isError } = useQuery<AdminHealthResponse>({
    queryKey: ["/api/admin/health"],
    staleTime: 30000,
    refetchInterval: 60000,
    retry: 2,
  });

  const providers = data?.data?.providers || [];
  const validatedProviders = providers.filter((p) => p.validated && p.enabled);
  const hasValidatedProviders = !isError && !isLoading && validatedProviders.length > 0;

  return {
    providers,
    validatedProviders,
    hasValidatedProviders,
    isLoading,
    isError,
    error,
  };
}
