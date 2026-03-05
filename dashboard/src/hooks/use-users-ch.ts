import { useQuery } from "@tanstack/react-query";
import { getUsers, getUser, getUserEvents } from "@/lib/api";

export function useUsers(
  projectId: string | undefined,
  params?: { search?: string; page?: number; per_page?: number; environment?: string },
) {
  return useQuery({
    queryKey: ["users", projectId, params],
    queryFn: () => getUsers(projectId!, params),
    enabled: !!projectId,
  });
}

export function useUser(
  projectId: string | undefined,
  userId: string | undefined,
  environment?: string,
) {
  return useQuery({
    queryKey: ["user", projectId, userId, environment],
    queryFn: () => getUser(projectId!, userId!, environment),
    enabled: !!projectId && !!userId,
  });
}

export function useUserEvents(
  projectId: string | undefined,
  userId: string | undefined,
  params?: { page?: number; per_page?: number; from?: string; to?: string; environment?: string },
) {
  return useQuery({
    queryKey: ["user-events", projectId, userId, params],
    queryFn: () => getUserEvents(projectId!, userId!, params),
    enabled: !!projectId && !!userId,
  });
}
