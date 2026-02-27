import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getApiKeys,
  generateApiKey,
  revokeApiKey,
  type GenerateApiKeyInput,
} from "@/lib/api";

export function useApiKeys(projectId: string | undefined) {
  return useQuery({
    queryKey: ["api-keys", projectId],
    queryFn: () => getApiKeys(projectId!),
    enabled: !!projectId,
  });
}

export function useGenerateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerateApiKeyInput) => generateApiKey(input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["api-keys", variables.project_id] });
    },
  });
}

export function useRevokeApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      keyId,
    }: {
      projectId: string;
      keyId: string;
    }) => revokeApiKey(projectId, keyId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["api-keys", variables.projectId] });
    },
  });
}
