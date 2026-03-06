import { useMemo } from "react";
import { useInsights } from "@/hooks/use-insights";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  projectId: string;
  config: Record<string, unknown>;
}

function resolvePreset(preset: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  const ms = preset === "30d" ? 30 * 86400000 : preset === "14d" ? 14 * 86400000 : 7 * 86400000;
  const from = new Date(now.getTime() - ms).toISOString();
  return { from, to };
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
