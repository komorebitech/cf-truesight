import { useMemo } from "react";
import { useTrends } from "@/hooks/use-trends";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import {
  LineChart,
  BarChart,
  Line,
  Bar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { resolvePreset, CHART_COLORS, AXIS_DEFAULTS, TOOLTIP_STYLE } from "@/lib/charts";
import type { TrendsRequest } from "@/lib/api";

interface TrendEvent {
  event_name: string;
  label?: string;
  metric?: string;
}

interface Props {
  projectId: string;
  config: Record<string, unknown>;
}

export function TrendWidget({ projectId, config }: Props) {
  const { environment } = useEnvironment();
  const events = (config.events as TrendEvent[] | undefined) ?? [];
  const chartType = (config.chart_type as string) ?? "line";
  const granularity = (config.granularity as string) ?? "day";
  const preset = (config.from_preset as string) ?? "7d";

  const { from, to } = useMemo(() => resolvePreset(preset), [preset]);

  const request: TrendsRequest | null = useMemo(() => {
    if (events.length === 0) return null;
    return {
      events: events.map((e) => ({
        event_name: e.event_name,
        metric: e.metric ?? "total",
      })),
      granularity,
      from,
      to,
      environment,
    };
  }, [events, granularity, from, to, environment]);

  const { data, isLoading } = useTrends(projectId, request);

  if (isLoading) return <Skeleton className="h-full w-full" />;

  // Merge all series into unified chart data keyed by period
  const periodMap = new Map<string, Record<string, number>>();
  const seriesKeys: string[] = [];

  data?.series?.forEach((s, i) => {
    const label = events[i]?.label ?? s.event_name;
    seriesKeys.push(label);
    for (const pt of s.data) {
      const existing = periodMap.get(pt.period) ?? {};
      existing[label] = pt.value;
      periodMap.set(pt.period, existing);
    }
  });

  const chartData = Array.from(periodMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, values]) => ({
      period: period.slice(5, 10),
      ...values,
    }));

  const ChartComponent = chartType === "bar" ? BarChart : LineChart;

  return (
    <div className="flex h-full flex-col p-3">
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ChartComponent data={chartData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="period" {...AXIS_DEFAULTS} interval="preserveStartEnd" />
            <YAxis {...AXIS_DEFAULTS} width={40} />
            <Tooltip {...TOOLTIP_STYLE} />
            {seriesKeys.length > 1 && (
              <Legend wrapperStyle={{ fontSize: 11 }} />
            )}
            {seriesKeys.map((key, i) => {
              const color = CHART_COLORS[i % CHART_COLORS.length]!;
              return chartType === "bar" ? (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={color}
                  radius={[3, 3, 0, 0]}
                />
              ) : (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                />
              );
            })}
          </ChartComponent>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
