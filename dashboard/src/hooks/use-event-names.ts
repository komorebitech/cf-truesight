import { useQuery } from "@tanstack/react-query";
import { searchEventNames } from "@/lib/api";

export function useEventNameSearch(
  projectId: string | undefined,
  query: string,
  environment?: string,
) {
  return useQuery({
    queryKey: ["event-names", projectId, query, environment],
    queryFn: () => searchEventNames(projectId!, query || undefined, 25, environment),
    enabled: !!projectId,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}
