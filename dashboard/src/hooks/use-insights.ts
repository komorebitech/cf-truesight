import { useQuery } from "@tanstack/react-query";
import { getInsights, type InsightsRequest } from "@/lib/api";

export function useInsights(
  projectId: string | undefined,
  request: InsightsRequest | null,
) {
  return useQuery({
    queryKey: ["insights", projectId, request],
    queryFn: () => getInsights(projectId!, request!),
    enabled: !!projectId && !!request,
  });
}
