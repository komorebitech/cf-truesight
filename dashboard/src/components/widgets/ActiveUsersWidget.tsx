import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getActiveUsers } from "@/lib/api";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { resolvePreset } from "@/lib/charts";

interface Props {
  projectId: string;
  config: Record<string, unknown>;
}

export function ActiveUsersWidget({ projectId, config }: Props) {
  const { from, to } = useMemo(
    () => resolvePreset((config.from_preset as string) ?? "7d"),
    [config.from_preset],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["widget-active-users", projectId, from, to],
    queryFn: () => getActiveUsers(projectId, from, to, "day"),
    enabled: !!projectId,
  });

  if (isLoading) return <Skeleton className="h-full w-full" />;

  const chartData =
    data?.data?.map((d) => ({
      period: d.period.slice(5, 10),
      users: d.active_users,
    })) ?? [];

  return (
    <div className="flex h-full flex-col p-3">
      <p className="mb-1 text-xs text-muted-foreground">Active Users</p>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <XAxis dataKey="period" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="users"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary) / 0.1)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
