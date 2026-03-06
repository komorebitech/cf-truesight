import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getSegments,
  getSegment,
  createSegment,
  updateSegment,
  deleteSegment,
  getSegmentUsers,
  getSegmentSize,
  previewSegment,
  type CreateSegmentInput,
  type UpdateSegmentInput,
  type SegmentDefinition,
} from "@/lib/api";

export function useSegments(projectId: string | undefined) {
  return useQuery({
    queryKey: ["segments", projectId],
    queryFn: () => getSegments(projectId!),
    enabled: !!projectId,
  });
}

export function useSegment(projectId: string | undefined, segmentId: string | undefined) {
  return useQuery({
    queryKey: ["segment", projectId, segmentId],
    queryFn: () => getSegment(projectId!, segmentId!),
    enabled: !!projectId && !!segmentId,
  });
}

export function useCreateSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, input }: { projectId: string; input: CreateSegmentInput }) =>
      createSegment(projectId, input),
    onSuccess: (_, { projectId }) => {
      qc.invalidateQueries({ queryKey: ["segments", projectId] });
    },
  });
}

export function useUpdateSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      segmentId,
      input,
    }: {
      projectId: string;
      segmentId: string;
      input: UpdateSegmentInput;
    }) => updateSegment(projectId, segmentId, input),
    onSuccess: (_, { projectId, segmentId }) => {
      qc.invalidateQueries({ queryKey: ["segments", projectId] });
      qc.invalidateQueries({ queryKey: ["segment", projectId, segmentId] });
    },
  });
}

export function useDeleteSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, segmentId }: { projectId: string; segmentId: string }) =>
      deleteSegment(projectId, segmentId),
    onSuccess: (_, { projectId }) => {
      qc.invalidateQueries({ queryKey: ["segments", projectId] });
    },
  });
}

export function useSegmentUsers(
  projectId: string | undefined,
  segmentId: string | undefined,
  params?: { page?: number; per_page?: number; environment?: string },
) {
  return useQuery({
    queryKey: ["segment-users", projectId, segmentId, params],
    queryFn: () => getSegmentUsers(projectId!, segmentId!, params),
    enabled: !!projectId && !!segmentId,
  });
}

export function useSegmentSize(
  projectId: string | undefined,
  segmentId: string | undefined,
  environment?: string,
) {
  return useQuery({
    queryKey: ["segment-size", projectId, segmentId, environment],
    queryFn: () => getSegmentSize(projectId!, segmentId!, environment),
    enabled: !!projectId && !!segmentId,
  });
}

export function usePreviewSegment() {
  return useMutation({
    mutationFn: ({
      projectId,
      definition,
      environment,
    }: {
      projectId: string;
      definition: SegmentDefinition;
      environment?: string;
    }) => previewSegment(projectId, definition, environment),
  });
}
