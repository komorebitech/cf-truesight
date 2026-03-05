import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCohorts,
  getCohort,
  createCohort,
  updateCohort,
  deleteCohort,
  getCohortUsers,
  getCohortSize,
  type CreateCohortInput,
  type UpdateCohortInput,
} from "@/lib/api";

export function useCohorts(projectId: string | undefined) {
  return useQuery({
    queryKey: ["cohorts", projectId],
    queryFn: () => getCohorts(projectId!),
    enabled: !!projectId,
  });
}

export function useCohort(projectId: string | undefined, cohortId: string | undefined) {
  return useQuery({
    queryKey: ["cohort", projectId, cohortId],
    queryFn: () => getCohort(projectId!, cohortId!),
    enabled: !!projectId && !!cohortId,
  });
}

export function useCreateCohort() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, input }: { projectId: string; input: CreateCohortInput }) =>
      createCohort(projectId, input),
    onSuccess: (_, { projectId }) => {
      qc.invalidateQueries({ queryKey: ["cohorts", projectId] });
    },
  });
}

export function useUpdateCohort() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      cohortId,
      input,
    }: {
      projectId: string;
      cohortId: string;
      input: UpdateCohortInput;
    }) => updateCohort(projectId, cohortId, input),
    onSuccess: (_, { projectId, cohortId }) => {
      qc.invalidateQueries({ queryKey: ["cohorts", projectId] });
      qc.invalidateQueries({ queryKey: ["cohort", projectId, cohortId] });
    },
  });
}

export function useDeleteCohort() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, cohortId }: { projectId: string; cohortId: string }) =>
      deleteCohort(projectId, cohortId),
    onSuccess: (_, { projectId }) => {
      qc.invalidateQueries({ queryKey: ["cohorts", projectId] });
    },
  });
}

export function useCohortUsers(
  projectId: string | undefined,
  cohortId: string | undefined,
  params?: { page?: number; per_page?: number; environment?: string },
) {
  return useQuery({
    queryKey: ["cohort-users", projectId, cohortId, params],
    queryFn: () => getCohortUsers(projectId!, cohortId!, params),
    enabled: !!projectId && !!cohortId,
  });
}

export function useCohortSize(
  projectId: string | undefined,
  cohortId: string | undefined,
  environment?: string,
) {
  return useQuery({
    queryKey: ["cohort-size", projectId, cohortId, environment],
    queryFn: () => getCohortSize(projectId!, cohortId!, environment),
    enabled: !!projectId && !!cohortId,
  });
}
