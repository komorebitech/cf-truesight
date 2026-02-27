import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getFunnels,
  getFunnel,
  createFunnel,
  updateFunnel,
  deleteFunnel,
  getFunnelResults,
  compareFunnels,
  compareFunnelTimeRanges,
  type CreateFunnelInput,
  type UpdateFunnelInput,
} from "@/lib/api";

export function useFunnels(projectId: string | undefined) {
  return useQuery({
    queryKey: ["funnels", projectId],
    queryFn: () => getFunnels(projectId!),
    enabled: !!projectId,
  });
}

export function useFunnel(
  projectId: string | undefined,
  funnelId: string | undefined,
) {
  return useQuery({
    queryKey: ["funnel", projectId, funnelId],
    queryFn: () => getFunnel(projectId!, funnelId!),
    enabled: !!projectId && !!funnelId,
  });
}

export function useCreateFunnel(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFunnelInput) => createFunnel(projectId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funnels", projectId] });
    },
  });
}

export function useUpdateFunnel(
  projectId: string | undefined,
  funnelId: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateFunnelInput) =>
      updateFunnel(projectId!, funnelId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funnels", projectId] });
      queryClient.invalidateQueries({
        queryKey: ["funnel", projectId, funnelId],
      });
    },
  });
}

export function useDeleteFunnel(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (funnelId: string) => deleteFunnel(projectId!, funnelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funnels", projectId] });
    },
  });
}

export function useFunnelResults(
  projectId: string | undefined,
  funnelId: string | undefined,
  from?: string,
  to?: string,
) {
  return useQuery({
    queryKey: ["funnel-results", projectId, funnelId, from, to],
    queryFn: () => getFunnelResults(projectId!, funnelId!, from, to),
    enabled: !!projectId && !!funnelId && !!from && !!to,
  });
}

export function useCompareFunnels(
  projectId: string | undefined,
  funnelIds: string[],
  from?: string,
  to?: string,
) {
  return useQuery({
    queryKey: ["compare-funnels", projectId, funnelIds, from, to],
    queryFn: () => compareFunnels(projectId!, funnelIds, from, to),
    enabled:
      !!projectId && funnelIds.length >= 2 && !!from && !!to,
  });
}

export function useCompareFunnelTimeRanges(
  projectId: string | undefined,
  funnelId: string | undefined,
  fromA?: string,
  toA?: string,
  fromB?: string,
  toB?: string,
) {
  return useQuery({
    queryKey: [
      "compare-funnel-ranges",
      projectId,
      funnelId,
      fromA,
      toA,
      fromB,
      toB,
    ],
    queryFn: () =>
      compareFunnelTimeRanges(projectId!, funnelId!, fromA!, toA!, fromB!, toB!),
    enabled:
      !!projectId && !!funnelId && !!fromA && !!toA && !!fromB && !!toB,
  });
}
