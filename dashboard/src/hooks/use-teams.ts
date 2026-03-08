import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getTeams,
  getTeam,
  createTeam,
  updateTeam,
  deleteTeam,
  getTeamMembers,
  updateMemberRole,
  removeMember,
  getTeamProjects,
  linkProject,
  unlinkProject,
  getAllowedDomains,
  addAllowedDomain,
  removeAllowedDomain,
  type SortParams,
} from "@/lib/api";

export function useTeams(
  params?: SortParams & { page?: number; per_page?: number },
) {
  return useQuery({
    queryKey: ["teams", params],
    queryFn: () => getTeams(params),
  });
}

export function useTeam(id: string | undefined) {
  return useQuery({
    queryKey: ["teams", id],
    queryFn: () => getTeam(id!),
    enabled: !!id,
  });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createTeam(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useUpdateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { name?: string; active?: boolean } }) =>
      updateTeam(id, input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["teams"] });
      qc.invalidateQueries({ queryKey: ["teams", variables.id] });
    },
  });
}

export function useDeleteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTeam(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useTeamMembers(teamId: string | undefined) {
  return useQuery({
    queryKey: ["teams", teamId, "members"],
    queryFn: () => getTeamMembers(teamId!),
    enabled: !!teamId,
  });
}

export function useUpdateMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, userId, role }: { teamId: string; userId: string; role: string }) =>
      updateMemberRole(teamId, userId, role),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["teams", variables.teamId, "members"] });
    },
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      removeMember(teamId, userId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["teams", variables.teamId, "members"] });
    },
  });
}

export function useTeamProjects(teamId: string | undefined) {
  return useQuery({
    queryKey: ["teams", teamId, "projects"],
    queryFn: () => getTeamProjects(teamId!),
    enabled: !!teamId,
  });
}

export function useLinkProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, projectId }: { teamId: string; projectId: string }) =>
      linkProject(teamId, projectId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["teams", variables.teamId, "projects"] });
    },
  });
}

export function useUnlinkProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, projectId }: { teamId: string; projectId: string }) =>
      unlinkProject(teamId, projectId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["teams", variables.teamId, "projects"] });
    },
  });
}

export function useAllowedDomains(teamId: string | undefined) {
  return useQuery({
    queryKey: ["teams", teamId, "allowed-domains"],
    queryFn: () => getAllowedDomains(teamId!),
    enabled: !!teamId,
  });
}

export function useAddAllowedDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, domain, defaultRole }: { teamId: string; domain: string; defaultRole: string }) =>
      addAllowedDomain(teamId, domain, defaultRole),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["teams", variables.teamId, "allowed-domains"] });
    },
  });
}

export function useRemoveAllowedDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, domainId }: { teamId: string; domainId: string }) =>
      removeAllowedDomain(teamId, domainId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["teams", variables.teamId, "allowed-domains"] });
    },
  });
}
