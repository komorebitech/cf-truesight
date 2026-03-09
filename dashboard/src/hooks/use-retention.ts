import { useQuery } from "@tanstack/react-query";
import { getRetention, type RetentionRequest } from "@/lib/api";

export function useRetention(
  projectId: string | undefined,
  request: RetentionRequest | null,
) {
  return useQuery({
    queryKey: ["retention", projectId, request],
    queryFn: () => getRetention(projectId!, request!),
    enabled: !!projectId && !!request,
    staleTime: 5 * 60_000,
  });
}
