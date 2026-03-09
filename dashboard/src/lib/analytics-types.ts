export type Granularity = "hour" | "day" | "week" | "month";

export type Metric = "total" | "unique_users" | "avg_per_user";

export type ChartType = "area" | "bar";

export const METRIC_OPTIONS: { value: Metric; label: string }[] = [
  { value: "total", label: "Total Events" },
  { value: "unique_users", label: "Unique Users" },
  { value: "avg_per_user", label: "Avg per User" },
];
