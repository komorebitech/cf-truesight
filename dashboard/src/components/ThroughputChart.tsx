import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { format } from "date-fns";
import type { ThroughputPoint } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "motion/react";
import { AXIS_DEFAULTS, TOOLTIP_STYLE } from "@/lib/charts";
import { fadeInLeft } from "@/lib/motion";

interface ThroughputChartProps {
  data: ThroughputPoint[] | undefined;
  isLoading: boolean;
}

export function ThroughputChart({ data, isLoading }: ThroughputChartProps) {
  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No throughput data available
      </div>
    );
  }

  const chartData = data.map((point) => ({
    ...point,
    time: format(new Date(Number(point.timestamp) * 1000), "hh:mm a"),
  }));

  return (
    <motion.div
      {...fadeInLeft}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
          />
          <XAxis
            dataKey="time"
            {...AXIS_DEFAULTS}
            interval="equidistantPreserveStart"
          />
          <YAxis
            {...AXIS_DEFAULTS}
            width={50}
          />
          <Tooltip
            {...TOOLTIP_STYLE}
            labelFormatter={(label: string) => `Time: ${label}`}
            formatter={(value: number) => [value.toLocaleString(), "Events"]}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="hsl(var(--chart-1))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "hsl(var(--chart-1))" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
