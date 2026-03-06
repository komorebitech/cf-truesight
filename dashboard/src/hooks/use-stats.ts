import { useQuery } from "@tanstack/react-query";
import {
  getEventCount,
  getThroughput,
  getEventTypes,
  getActiveUsers,
  getLiveUsers,
  getPlatformDistribution,
} from "@/lib/api";

export function useEventCount(
  projectId: string | undefined,
  from?: string,
  to?: string,
  environment?: string,
) {
  return useQuery({
    queryKey: ["event-count", projectId, from, to, environment],
    queryFn: () => getEventCount(projectId!, from, to, environment),
    enabled: !!projectId,
  });
}

export function useThroughput(
  projectId: string | undefined,
  from?: string,
  to?: string,
  granularity?: string,
  environment?: string,
) {
  return useQuery({
    queryKey: ["throughput", projectId, from, to, granularity, environment],
    queryFn: () => getThroughput(projectId!, from, to, granularity, environment),
    enabled: !!projectId,
  });
}

export function useEventTypeBreakdown(
  projectId: string | undefined,
  from?: string,
  to?: string,
  environment?: string,
) {
  return useQuery({
    queryKey: ["event-types", projectId, from, to, environment],
    queryFn: () => getEventTypes(projectId!, from, to, environment),
    enabled: !!projectId,
  });
}

export function useActiveUsers(
  projectId: string | undefined,
  from?: string,
  to?: string,
  granularity?: string,
  environment?: string,
) {
  return useQuery({
    queryKey: ["active-users", projectId, from, to, granularity, environment],
    queryFn: () => getActiveUsers(projectId!, from, to, granularity, environment),
    enabled: !!projectId && !!from && !!to,
  });
}

export function useLiveUsers(projectId: string | undefined, environment?: string) {
  return useQuery({
    queryKey: ["live-users", projectId, environment],
    queryFn: () => getLiveUsers(projectId!, environment),
    enabled: !!projectId,
    refetchInterval: 30_000,
  });
}

export function usePlatformDistribution(
  projectId: string | undefined,
  from?: string,
  to?: string,
  environment?: string,
) {
  return useQuery({
    queryKey: ["platform-distribution", projectId, from, to, environment],
    queryFn: () => getPlatformDistribution(projectId!, from, to, environment),
    enabled: !!projectId && !!from && !!to,
  });
}
