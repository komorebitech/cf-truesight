import { useQuery } from "@tanstack/react-query";
import { getPropertyKeys, getPropertyValues } from "@/lib/api";

export function usePropertyKeys(
  projectId: string | undefined,
  from?: string,
  to?: string,
  environment?: string,
) {
  return useQuery({
    queryKey: ["property-keys", projectId, from, to, environment],
    queryFn: () => getPropertyKeys(projectId!, from, to, environment),
    enabled: !!projectId,
  });
}

export function usePropertyValues(
  projectId: string | undefined,
  key: string | undefined,
  from?: string,
  to?: string,
  environment?: string,
) {
  return useQuery({
    queryKey: ["property-values", projectId, key, from, to, environment],
    queryFn: () => getPropertyValues(projectId!, key!, from, to, environment),
    enabled: !!projectId && !!key,
  });
}
