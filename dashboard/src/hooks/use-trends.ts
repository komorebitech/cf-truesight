import { useQuery } from "@tanstack/react-query";
import { getTrends, type TrendsRequest } from "@/lib/api";

export function useTrends(
  projectId: string | undefined,
  request: TrendsRequest | null,
) {
  return useQuery({
    queryKey: ["trends", projectId, request],
    queryFn: () => getTrends(projectId!, request!),
    enabled: !!projectId && !!request,
    staleTime: 5 * 60_000,
  });
}
