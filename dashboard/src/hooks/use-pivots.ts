import { useQuery } from "@tanstack/react-query";
import { getPivots, type PivotsRequest } from "@/lib/api";

export function usePivots(
  projectId: string | undefined,
  request: PivotsRequest | null,
) {
  return useQuery({
    queryKey: ["pivots", projectId, request],
    queryFn: () => getPivots(projectId!, request!),
    enabled: !!projectId && !!request,
    staleTime: 5 * 60_000,
  });
}
