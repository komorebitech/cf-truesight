import { useMemo } from "react";
import { useInsights } from "@/hooks/use-insights";
import { Skeleton } from "@/components/ui/skeleton";
import { resolvePreset } from "@/lib/charts";

interface Props {
  projectId: string;
  config: Record<string, unknown>;
}

export function MetricWidget({ projectId, config }: Props) {
  const { from, to } = useMemo(
    () => resolvePreset((config.from_preset as string) ?? "7d"),
    [config.from_preset],
  );

  const { data, isLoading } = useInsights(projectId, {
    event_name: config.event_name as string,
    metric: (config.metric as string) ?? "total_events",
    from,
    to,
  });

  if (isLoading) return <Skeleton className="h-full w-full" />;

  const total = data?.totals?.[0]?.value ?? 0;

  return (
    <div className="flex h-full flex-col items-center justify-center p-4">
      <p className="text-3xl font-bold tabular-nums">
        {total.toLocaleString()}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {(config.event_name as string) ?? "Events"}
      </p>
    </div>
  );
}
