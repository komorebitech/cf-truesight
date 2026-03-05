import { useMemo } from "react";
import type { RetentionCohort } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "motion/react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

interface RetentionChartProps {
  cohorts: RetentionCohort[];
  retentionType: string;
  isLoading: boolean;
}

function periodLabel(type: string): string {
  switch (type) {
    case "week":
      return "Week";
    case "month":
      return "Month";
    default:
      return "Day";
  }
}

function formatCohortLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function RetentionChart({ cohorts, retentionType, isLoading }: RetentionChartProps) {
  if (isLoading) {
    return <Skeleton className="h-72 w-full" />;
  }

  // Show top 5 cohorts by cohort_size
  const topCohorts = useMemo(() => {
    return [...cohorts]
      .sort((a, b) => b.cohort_size - a.cohort_size)
      .slice(0, 5);
  }, [cohorts]);

  if (topCohorts.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
        No retention data to chart
      </div>
    );
  }

  const maxPeriods = Math.max(...topCohorts.map((c) => c.retention.length));
  const label = periodLabel(retentionType);

  // Build chart data: each row is a period offset
  const chartData = useMemo(() => {
    return Array.from({ length: maxPeriods }).map((_, periodIdx) => {
      const point: Record<string, unknown> = {
        period: `${label} ${periodIdx}`,
      };
      for (const cohort of topCohorts) {
        const key = formatCohortLabel(cohort.cohort_date);
        point[key] = cohort.retention[periodIdx] ?? null;
      }
      return point;
    });
  }, [topCohorts, maxPeriods, label]);

  const cohortKeys = topCohorts.map((c) => formatCohortLabel(c.cohort_date));

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4 }}
    >
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
          />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            width={50}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "13px",
              color: "hsl(var(--popover-foreground))",
            }}
            formatter={(value: number) => [`${value.toFixed(1)}%`, undefined]}
          />
          <Legend
            wrapperStyle={{ fontSize: "12px" }}
          />
          {cohortKeys.map((key, i) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={key}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: CHART_COLORS[i % CHART_COLORS.length] }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
