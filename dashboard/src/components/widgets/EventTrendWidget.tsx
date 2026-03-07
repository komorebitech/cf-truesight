import { useMemo } from "react";
import { useInsights } from "@/hooks/use-insights";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { resolvePreset } from "@/lib/charts";

interface Props {
  projectId: string;
  config: Record<string, unknown>;
}

export function EventTrendWidget({ projectId, config }: Props) {
  const { from, to } = useMemo(
    () => resolvePreset((config.from_preset as string) ?? "7d"),
    [config.from_preset],
  );

  const { data, isLoading } = useInsights(projectId, {
    event_name: config.event_name as string,
    metric: (config.metric as string) ?? "total_events",
    from,
    to,
    granularity: (config.granularity as string) ?? "day",
  });

  if (isLoading) return <Skeleton className="h-full w-full" />;

  const chartData =
    data?.series?.[0]?.data?.map((d) => ({
      period: d.period.slice(5, 10),
      value: d.value,
    })) ?? [];

  return (
    <div className="flex h-full flex-col p-3">
      <p className="mb-1 text-xs text-muted-foreground">
        {config.event_name as string}
      </p>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <XAxis dataKey="period" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
