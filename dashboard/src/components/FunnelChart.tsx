import type { FunnelStepResult } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import { motion } from "motion/react";

interface FunnelChartProps {
  steps: FunnelStepResult[];
}

export function FunnelChart({ steps }: FunnelChartProps) {
  if (!steps.length) return null;

  const maxUsers = steps[0]?.users ?? 1;

  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const widthPct = maxUsers > 0 ? (step.users / maxUsers) * 100 : 0;
        const prevUsers = i > 0 ? steps[i - 1]!.users : step.users;
        const dropoff = prevUsers > 0 ? ((prevUsers - step.users) / prevUsers) * 100 : 0;

        // Color gradient from success to danger using chart colors
        const hue = steps.length > 1
          ? 140 - (i / (steps.length - 1)) * 110
          : 140;

        return (
          <motion.div
            key={step.step}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
          >
            <div className="flex items-center gap-3">
              <div className="w-6 shrink-0 text-center text-xs font-bold text-muted-foreground">
                {step.step}
              </div>
              <div className="flex-1">
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-sm font-medium">
                    {step.event_name}
                  </span>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-semibold">
                      {formatNumber(step.users)}
                    </span>
                    <span className="text-muted-foreground">
                      {step.conversion_rate.toFixed(1)}%
                    </span>
                    {i > 0 && dropoff > 0 && (
                      <span className="text-destructive">
                        -{dropoff.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-8 w-full rounded bg-muted">
                  <motion.div
                    className="h-full rounded"
                    style={{
                      backgroundColor: `hsl(${hue}, 60%, 45%)`,
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(widthPct, 2)}%` }}
                    transition={{ duration: 0.5, delay: i * 0.08, ease: "easeOut" }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
