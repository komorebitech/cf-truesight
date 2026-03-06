import { useMemo } from "react";
import { useFunnelResults } from "@/hooks/use-funnels";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis } from "recharts";
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

export function FunnelWidget({ projectId, config }: Props) {
  const { from, to } = useMemo(
    () => resolvePreset((config.from_preset as string) ?? "7d"),
    [config.from_preset],
  );

  const { data, isLoading } = useFunnelResults(
    projectId,
    config.funnel_id as string,
    from,
    to,
  );

  if (isLoading) return <Skeleton className="h-full w-full" />;

  const chartData =
    data?.steps?.map((s) => ({
      name: s.event_name.length > 12 ? s.event_name.slice(0, 12) + "..." : s.event_name,
      rate: s.conversion_rate,
    })) ?? [];

  return (
    <div className="flex h-full flex-col p-3">
      <p className="mb-1 text-xs text-muted-foreground">
        {data?.overall_conversion != null
          ? `${data.overall_conversion.toFixed(1)}% conversion`
          : "Funnel"}
      </p>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} />
            <Tooltip />
            <Bar dataKey="rate" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
