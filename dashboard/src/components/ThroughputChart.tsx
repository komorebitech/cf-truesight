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
    time: format(new Date(point.timestamp), "HH:mm"),
  }));

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
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
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            width={50}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "13px",
              color: "hsl(var(--popover-foreground))",
            }}
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
