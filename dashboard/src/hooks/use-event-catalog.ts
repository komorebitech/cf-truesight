import { useQuery } from "@tanstack/react-query";
import { getEventCatalog, getEventProperties } from "@/lib/api";

export function useEventCatalog(
  projectId: string | undefined,
  query?: string,
  environment?: string,
) {
  return useQuery({
    queryKey: ["event-catalog", projectId, query, environment],
    queryFn: () => getEventCatalog(projectId!, query || undefined, undefined, environment),
    enabled: !!projectId,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
}

export function useEventProperties(
  projectId: string | undefined,
  eventName: string | undefined,
  environment?: string,
) {
  return useQuery({
    queryKey: ["event-properties", projectId, eventName, environment],
    queryFn: () => getEventProperties(projectId!, eventName!, environment),
    enabled: !!projectId && !!eventName,
    staleTime: 60_000,
  });
}
