import { useQuery } from "@tanstack/react-query";
import { getEvents, type EventFilters } from "@/lib/api";

export function useEvents(
  projectId: string | undefined,
  filters?: EventFilters,
) {
  return useQuery({
    queryKey: ["events", projectId, filters],
    queryFn: () => getEvents(projectId!, filters),
    enabled: !!projectId,
  });
}
