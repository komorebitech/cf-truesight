import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getBoards,
  getBoard,
  createBoard,
  updateBoard,
  deleteBoard,
  createWidget,
  updateWidget,
  deleteWidget,
  batchUpdateLayouts,
  type CreateBoardInput,
  type UpdateBoardInput,
  type CreateWidgetInput,
  type UpdateWidgetInput,
  type BatchLayoutItem,
} from "@/lib/api";

export function useBoards(projectId: string | undefined) {
  return useQuery({
    queryKey: ["boards", projectId],
    queryFn: () => getBoards(projectId!),
    enabled: !!projectId,
  });
}

export function useBoard(projectId: string | undefined, boardId: string | undefined) {
  return useQuery({
    queryKey: ["board", projectId, boardId],
    queryFn: () => getBoard(projectId!, boardId!),
    enabled: !!projectId && !!boardId,
  });
}

export function useCreateBoard(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBoardInput) => createBoard(projectId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boards", projectId] });
    },
  });
}

export function useUpdateBoard(projectId: string | undefined, boardId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateBoardInput) => updateBoard(projectId!, boardId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boards", projectId] });
      queryClient.invalidateQueries({ queryKey: ["board", projectId, boardId] });
    },
  });
}

export function useDeleteBoard(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (boardId: string) => deleteBoard(projectId!, boardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boards", projectId] });
    },
  });
}

export function useCreateWidget(projectId: string | undefined, boardId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWidgetInput) => createWidget(projectId!, boardId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", projectId, boardId] });
    },
  });
}

export function useUpdateWidget(projectId: string | undefined, boardId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ widgetId, input }: { widgetId: string; input: UpdateWidgetInput }) =>
      updateWidget(projectId!, boardId!, widgetId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", projectId, boardId] });
    },
  });
}

export function useDeleteWidget(projectId: string | undefined, boardId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (widgetId: string) => deleteWidget(projectId!, boardId!, widgetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", projectId, boardId] });
    },
  });
}

export function useBatchUpdateLayouts(projectId: string | undefined, boardId: string | undefined) {
  return useMutation({
    mutationFn: (layouts: BatchLayoutItem[]) =>
      batchUpdateLayouts(projectId!, boardId!, layouts),
  });
}
