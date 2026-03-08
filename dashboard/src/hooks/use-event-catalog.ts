import { useQuery } from "@tanstack/react-query";
import { getEventCatalog, getEventProperties, type SortParams } from "@/lib/api";

export function useEventCatalog(
  projectId: string | undefined,
  params?: {
    q?: string;
    page?: number;
    per_page?: number;
    environment?: string;
  } & SortParams,
) {
  return useQuery({
    queryKey: ["event-catalog", projectId, params],
    queryFn: () => getEventCatalog(projectId!, params),
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
