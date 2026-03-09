import { useQuery } from "@tanstack/react-query";
import { getFlows, type FlowsRequest } from "@/lib/api";

export function useFlows(
  projectId: string | undefined,
  request: FlowsRequest | null,
) {
  return useQuery({
    queryKey: ["flows", projectId, request],
    queryFn: () => getFlows(projectId!, request!),
    enabled: !!projectId && !!request,
    staleTime: 5 * 60_000,
  });
}
