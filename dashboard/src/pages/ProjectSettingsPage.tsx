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
import { Plus, Copy, Check } from "lucide-react";
import { motion } from "motion/react";
import { fadeInUp, STAGGER_DELAY } from "@/lib/motion";
import { formatDate, copyToClipboard } from "@/lib/utils";
import { toast } from "sonner";

export function ProjectSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: project, isLoading: projectLoading } = useProject(id);
  const { data: apiKeysData, isLoading: keysLoading } = useApiKeys(id);
  const generateApiKey = useGenerateApiKey();
  const revokeApiKey = useRevokeApiKey();

  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

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

  const handleCopyId = async () => {
    if (!project?.id) return;
    const ok = await copyToClipboard(project.id);
    if (ok) {
      setCopiedId(true);
      toast.success("Project ID copied");
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  if (projectLoading) {
    return (
      <PageLayout title="Settings">
        <div className="space-y-6">
          <Skeleton className="h-40" />
          <Skeleton className="h-64" />
        </div>
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
      <motion.div {...fadeInUp} transition={{ duration: 0.3 }}>
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-4 text-sm">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{project.name}</dd>

              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <Badge variant={project.active ? "success" : "secondary"}>
                  {project.active ? "Active" : "Inactive"}
                </Badge>
              </dd>

              <dt className="text-muted-foreground">Created</dt>
              <dd className="text-muted-foreground">{formatDate(project.created_at)}</dd>

              <dt className="text-muted-foreground">Project ID</dt>
              <dd className="flex items-center gap-2">
                <code className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {project.id}
                </code>
                <button
                  onClick={handleCopyId}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Copy project ID"
                >
                  {copiedId ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </dd>
            </dl>
          </CardContent>
        </Card>
      </motion.div>

      {/* API Keys */}
      <motion.div
        {...fadeInUp}
        transition={{ duration: 0.3, delay: STAGGER_DELAY }}
      >
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
      </motion.div>

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
