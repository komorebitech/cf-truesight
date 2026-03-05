import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getTeamInvitations,
  createInvitation,
  deleteInvitation,
  acceptInvitation,
} from "@/lib/api";

export function useTeamInvitations(teamId: string | undefined) {
  return useQuery({
    queryKey: ["teams", teamId, "invitations"],
    queryFn: () => getTeamInvitations(teamId!),
    enabled: !!teamId,
  });
}

export function useCreateInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, email, role }: { teamId: string; email: string; role: string }) =>
      createInvitation(teamId, email, role),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["teams", variables.teamId, "invitations"] });
    },
  });
}

export function useDeleteInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, invitationId }: { teamId: string; invitationId: string }) =>
      deleteInvitation(teamId, invitationId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["teams", variables.teamId, "invitations"] });
    },
  });
}

export function useAcceptInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => acceptInvitation(token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}
