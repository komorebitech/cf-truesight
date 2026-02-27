import { useState } from "react";
import { useParams, Link } from "react-router";
import { useProject } from "@/hooks/use-projects";
import { useApiKeys, useGenerateApiKey, useRevokeApiKey } from "@/hooks/use-api-keys";
import { useEventCount, useThroughput, useEventTypeBreakdown, useLiveUsers } from "@/hooks/use-stats";
import { Header } from "@/components/Header";
import { StatsCards, type StatCardData } from "@/components/StatsCards";
import { ThroughputChart } from "@/components/ThroughputChart";
import { ApiKeyTable } from "@/components/ApiKeyTable";
import { ApiKeyGenerateDialog } from "@/components/ApiKeyGenerateDialog";
import {
  TimeRangeSelector,
  type TimeRange,
  getPresetRange,
} from "@/components/TimeRangeSelector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  Activity,
  Radio,
  Tag,
  Plus,
  ExternalLink,
  TrendingUp,
  GitBranch,
} from "lucide-react";

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: project, isLoading: projectLoading } = useProject(id);

  const [timeRange, setTimeRange] = useState<TimeRange>(getPresetRange("7d"));

  const { data: eventCountData, isLoading: countLoading } = useEventCount(
    id,
    timeRange.from,
    timeRange.to,
  );
  const { data: throughputData, isLoading: throughputLoading } = useThroughput(
    id,
    timeRange.from,
    timeRange.to,
    "hour",
  );
  const { data: breakdownData, isLoading: breakdownLoading } =
    useEventTypeBreakdown(id, timeRange.from, timeRange.to);
  const { data: liveData } = useLiveUsers(id);

  const { data: apiKeysData, isLoading: keysLoading } = useApiKeys(id);
  const generateApiKey = useGenerateApiKey();
  const revokeApiKey = useRevokeApiKey();

  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  const statsLoading = countLoading || breakdownLoading;
  const totalEvents = eventCountData?.total_events ?? 0;
  const topEvent = breakdownData?.top_events?.[0];

  const stats: StatCardData[] = [
    {
      label: "Total Events",
      value: totalEvents,
      icon: <BarChart3 className="h-5 w-5" />,
    },
    {
      label: "Live Users (5m)",
      value: liveData?.active_users_5m ?? 0,
      icon: <Radio className="h-5 w-5" />,
    },
    {
      label: "Events / sec",
      value: totalEvents > 0 ? (totalEvents / (24 * 3600)).toFixed(2) : "0",
      icon: <Activity className="h-5 w-5" />,
    },
    {
      label: "Top Event",
      value: topEvent?.name ?? "-",
      icon: <Tag className="h-5 w-5" />,
    },
  ];

  const handleGenerate = async (label: string, environment: "live" | "test") => {
    if (!id) return;
    const result = await generateApiKey.mutateAsync({
      project_id: id,
      label,
      environment,
    });
    setGeneratedKey(result.key);
  };

  const handleRevoke = (keyId: string) => {
    if (!id) return;
    revokeApiKey.mutate({ projectId: id, keyId });
  };

  if (projectLoading) {
    return (
      <div className="flex flex-1 flex-col">
        <Header />
        <div className="p-6">
          <Skeleton className="mb-2 h-8 w-48" />
          <Skeleton className="mb-6 h-5 w-24" />
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-1 flex-col">
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">
            Project not found.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <Header title={project.name} />

      <div className="flex-1 space-y-6 p-6">
        {/* Status + nav links + time range */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Badge
              variant={project.active ? "success" : "secondary"}
            >
              {project.active ? "active" : "inactive"}
            </Badge>
            <Link
              to={`/projects/${id}/events`}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Event Explorer
            </Link>
            <Link
              to={`/projects/${id}/analytics`}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Analytics
            </Link>
            <Link
              to={`/projects/${id}/funnels`}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <GitBranch className="h-3.5 w-3.5" />
              Funnels
            </Link>
          </div>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>

        {/* Stats cards */}
        <StatsCards stats={stats} isLoading={statsLoading} />

        {/* Throughput chart */}
        <Card>
          <CardHeader>
            <CardTitle>Throughput</CardTitle>
          </CardHeader>
          <CardContent>
            <ThroughputChart
              data={throughputData?.data}
              isLoading={throughputLoading}
            />
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
              apiKeys={apiKeysData}
              isLoading={keysLoading}
              onRevoke={handleRevoke}
              isRevoking={revokeApiKey.isPending}
            />
          </CardContent>
        </Card>
      </div>

      {/* Generate API Key Dialog */}
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
    </div>
  );
}
