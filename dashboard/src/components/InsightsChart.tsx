import type { InsightsSeries } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "motion/react";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { CHART_COLORS, AXIS_DEFAULTS, TOOLTIP_STYLE } from "@/lib/charts";
import { fadeInLeft } from "@/lib/motion";

function seriesLabel(group: Record<string, string>): string {
  const entries = Object.entries(group);
  if (entries.length === 0) return "All";
  return entries.map(([k, v]) => `${k}=${v}`).join(", ");
}

interface InsightsChartProps {
  series: InsightsSeries[];
  isLoading: boolean;
  chartType: "area" | "bar";
}

export function InsightsChart({
  series,
  isLoading,
  chartType,
}: InsightsChartProps) {
  if (isLoading) {
    return <Skeleton className="h-72 w-full" />;
  }

  if (!series || series.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
        No data for the selected query
      </div>
    );
  }

  // Merge all series into a unified dataset keyed by period
  const periodsSet = new Set<string>();
  series.forEach((s) => s.data.forEach((d) => periodsSet.add(d.period)));
  const sortedPeriods = Array.from(periodsSet).sort();

  const seriesKeys = series.map((_, i) => `series_${i}`);
  const seriesLabels = series.map((s) => seriesLabel(s.group));

  const chartData = sortedPeriods.map((period) => {
    const row: Record<string, string | number> = {
      period,
      label: format(new Date(period), "MMM d"),
    };
    series.forEach((s, i) => {
      const key = seriesKeys[i];
      if (key) {
        const point = s.data.find((d) => d.period === period);
        row[key] = point?.value ?? 0;
      }
    });
    return row;
  });

  const gradientDefs = seriesKeys.map((key, i) => (
    <linearGradient key={key} id={`insightGrad_${i}`} x1="0" y1="0" x2="0" y2="1">
      <stop
        offset="5%"
        stopColor={CHART_COLORS[i % CHART_COLORS.length]}
        stopOpacity={0.2}
      />
      <stop
        offset="95%"
        stopColor={CHART_COLORS[i % CHART_COLORS.length]}
        stopOpacity={0}
      />
    </linearGradient>
  ));


  return (
    <motion.div
      {...fadeInLeft}
      transition={{ duration: 0.4 }}
    >
      <ResponsiveContainer width="100%" height={300}>
        {chartType === "area" ? (
          <AreaChart data={chartData}>
            <defs>{gradientDefs}</defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
            />
            <XAxis dataKey="label" {...AXIS_DEFAULTS} />
            <YAxis {...AXIS_DEFAULTS} width={50} />
            <Tooltip {...TOOLTIP_STYLE} />
            {seriesKeys.length > 1 && <Legend />}
            {seriesKeys.map((key, i) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                name={seriesLabels[i]}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                fill={`url(#insightGrad_${i})`}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        ) : (
          <BarChart data={chartData}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
            />
            <XAxis dataKey="label" {...AXIS_DEFAULTS} />
            <YAxis {...AXIS_DEFAULTS} width={50} />
            <Tooltip {...TOOLTIP_STYLE} />
            {seriesKeys.length > 1 && <Legend />}
            {seriesKeys.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                name={seriesLabels[i]}
                fill={CHART_COLORS[i % CHART_COLORS.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </motion.div>
  );
}
