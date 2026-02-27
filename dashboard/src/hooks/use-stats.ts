import { useQuery } from "@tanstack/react-query";
import { getEventCount, getThroughput, getEventTypes } from "@/lib/api";

export function useEventCount(
  projectId: string | undefined,
  from?: string,
  to?: string,
) {
  return useQuery({
    queryKey: ["event-count", projectId, from, to],
    queryFn: () => getEventCount(projectId!, from, to),
    enabled: !!projectId,
  });
}

export function useThroughput(
  projectId: string | undefined,
  from?: string,
  to?: string,
  granularity?: string,
) {
  return useQuery({
    queryKey: ["throughput", projectId, from, to, granularity],
    queryFn: () => getThroughput(projectId!, from, to, granularity),
    enabled: !!projectId,
  });
}

export function useEventTypeBreakdown(
  projectId: string | undefined,
  from?: string,
  to?: string,
) {
  return useQuery({
    queryKey: ["event-types", projectId, from, to],
    queryFn: () => getEventTypes(projectId!, from, to),
    enabled: !!projectId,
  });
}
