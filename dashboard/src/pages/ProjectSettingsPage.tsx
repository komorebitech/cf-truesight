import { useState } from "react";
import { useParams } from "react-router";
import { useProject } from "@/hooks/use-projects";
import { useApiKeys, useGenerateApiKey, useRevokeApiKey } from "@/hooks/use-api-keys";
import { PageLayout } from "@/components/PageLayout";
import { ApiKeyTable } from "@/components/ApiKeyTable";
import { ApiKeyGenerateDialog } from "@/components/ApiKeyGenerateDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";

export function ProjectSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: project, isLoading: projectLoading } = useProject(id);
  const { data: apiKeysData, isLoading: keysLoading } = useApiKeys(id);
  const generateApiKey = useGenerateApiKey();
  const revokeApiKey = useRevokeApiKey();

  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  const handleGenerate = async (label: string, env: "live" | "test") => {
    if (!id) return;
    const result = await generateApiKey.mutateAsync({
      project_id: id,
      label,
      environment: env,
    });
    setGeneratedKey(result.key);
  };

  const handleRevoke = (keyId: string) => {
    if (!id) return;
    revokeApiKey.mutate({ projectId: id, keyId });
  };

  if (projectLoading) {
    return (
      <PageLayout title="Settings">
        <Skeleton className="mb-6 h-8 w-48" />
        <Skeleton className="h-48" />
      </PageLayout>
    );
  }

  if (!project) {
    return (
      <PageLayout title="Settings">
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">Project not found.</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Settings">
        {/* Project info */}
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Name</span>
              <span className="text-sm font-medium">{project.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant={project.active ? "success" : "secondary"}>
                {project.active ? "active" : "inactive"}
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">ID</span>
              <code className="text-xs text-muted-foreground">{project.id}</code>
            </div>
          </CardContent>
        </Card>

        {/* API Keys */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>API Keys</CardTitle>
              <Button
                size="sm"
                onClick={() => {
                  setGeneratedKey(null);
                  setShowKeyDialog(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Generate Key
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ApiKeyTable
              apiKeys={apiKeysData?.data}
              isLoading={keysLoading}
              onRevoke={handleRevoke}
              isRevoking={revokeApiKey.isPending}
            />
          </CardContent>
        </Card>
      <ApiKeyGenerateDialog
        open={showKeyDialog}
        onClose={() => {
          setShowKeyDialog(false);
          setGeneratedKey(null);
        }}
        onGenerate={handleGenerate}
        isGenerating={generateApiKey.isPending}
        generatedKey={generatedKey}
      />
    </PageLayout>
  );
}
