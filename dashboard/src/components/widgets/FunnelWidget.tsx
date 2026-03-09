import { useMemo } from "react";
import { useFunnelResults } from "@/hooks/use-funnels";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Skeleton } from "@/components/ui/skeleton";
import { resolvePreset, CHART_COLORS } from "@/lib/charts";
import { formatNumber } from "@/lib/utils";

interface Props {
  projectId: string;
  config: Record<string, unknown>;
}

export function FunnelWidget({ projectId, config }: Props) {
  const { environment } = useEnvironment();
  const { from, to } = useMemo(
    () => resolvePreset((config.from_preset as string) ?? "7d"),
    [config.from_preset],
  );

  const { data, isLoading } = useFunnelResults(
    projectId,
    config.funnel_id as string,
    from,
    to,
    environment,
  );

  if (isLoading) return <Skeleton className="h-full w-full" />;

  const steps = data?.steps ?? [];
  const maxUsers = steps[0]?.users ?? 1;

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-baseline gap-1.5">
        {data?.overall_conversion != null ? (
          <>
            <span className="font-heading text-2xl font-bold tracking-tight text-foreground">
              {data.overall_conversion.toFixed(1)}%
            </span>
            <span className="text-xs text-muted-foreground">conversion</span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Funnel</span>
        )}
      </div>
      <div className="flex-1 min-h-0 space-y-2.5 overflow-y-auto scrollbar-none">
        {steps.map((step, i) => {
          const widthPct = maxUsers > 0 ? (step.users / maxUsers) * 100 : 0;
          const color = CHART_COLORS[i % CHART_COLORS.length]!;

          return (
            <div key={step.step}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">
                  {step.event_name}
                </span>
                <div className="flex shrink-0 items-center gap-2 text-xs tabular-nums text-muted-foreground">
                  <span>{formatNumber(step.users)}</span>
                  <span>{step.conversion_rate.toFixed(1)}%</span>
                </div>
              </div>
              <div className="h-6 w-full rounded-sm bg-muted">
                <div
                  className="h-full rounded-sm transition-[width] duration-500 ease-out"
                  style={{
                    width: `${Math.max(widthPct, 3)}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
