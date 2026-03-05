import { useState, useEffect } from "react";
import { useParams } from "react-router";
import { useProject } from "@/hooks/use-projects";
import { useLastProject } from "@/hooks/use-last-project";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { useEventCount, useThroughput, useEventTypeBreakdown, useLiveUsers } from "@/hooks/use-stats";
import { Header } from "@/components/Header";
import { StatsCards, type StatCardData } from "@/components/StatsCards";
import { ThroughputChart } from "@/components/ThroughputChart";
import {
  TimeRangeSelector,
  type TimeRange,
  getPresetRange,
} from "@/components/TimeRangeSelector";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Activity, Radio, Tag } from "lucide-react";

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: project, isLoading: projectLoading } = useProject(id);
  const { setLastProject } = useLastProject();

  const { environment } = useEnvironment();
  const [timeRange, setTimeRange] = useState<TimeRange>(getPresetRange("7d"));

  // Persist last opened project
  useEffect(() => {
    if (id) setLastProject(id);
  }, [id, setLastProject]);

  const { data: eventCountData, isLoading: countLoading } = useEventCount(
    id,
    timeRange.from,
    timeRange.to,
    environment,
  );
  const { data: throughputData, isLoading: throughputLoading } = useThroughput(
    id,
    timeRange.from,
    timeRange.to,
    "hour",
    environment,
  );
  const { data: breakdownData, isLoading: breakdownLoading } =
    useEventTypeBreakdown(id, timeRange.from, timeRange.to, environment);
  const { data: liveData } = useLiveUsers(id, environment);

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
        {/* Status + controls */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Badge variant={project.active ? "success" : "secondary"}>
            {project.active ? "active" : "inactive"}
          </Badge>
          <div className="flex items-center gap-3">

            <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
          </div>
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
      </div>
    </div>
  );
}
