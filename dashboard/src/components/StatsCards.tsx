import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn, formatNumber } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "motion/react";
import { fadeInUp } from "@/lib/motion";

export interface StatCardData {
  label: string;
  value: string | number;
  icon: ReactNode;
  trend?: {
    value: number;
    direction: "up" | "down" | "flat";
  };
}

interface StatsCardsProps {
  stats: StatCardData[];
  isLoading?: boolean;
}

function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number | undefined>(undefined);

  useEffect(() => {
    const duration = 600;
    const start = performance.now();
    const from = 0;

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) {
        ref.current = requestAnimationFrame(animate);
      }
    };

    ref.current = requestAnimationFrame(animate);
    return () => {
      if (ref.current) cancelAnimationFrame(ref.current);
    };
  }, [value]);

  return <>{formatNumber(display)}</>;
}

export function StatsCards({ stats, isLoading }: StatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border bg-card p-6"
          >
            <Skeleton className="mb-3 h-4 w-24" />
            <Skeleton className="h-8 w-32" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          {...fadeInUp}
          transition={{ duration: 0.3, delay: i * 0.05 }}
          className="rounded-lg border bg-card p-6"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              {stat.label}
            </p>
            <span className="text-muted-foreground/60">
              {stat.icon}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-2xl font-bold">
              {typeof stat.value === "number" ? (
                <CountUp value={stat.value} />
              ) : (
                stat.value
              )}
            </p>
            {stat.trend && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-xs font-medium",
                  stat.trend.direction === "up"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : stat.trend.direction === "down"
                      ? "text-red-600 dark:text-red-400"
                      : "text-amber-600 dark:text-amber-400",
                )}
              >
                {stat.trend.direction === "up"
                  ? "▲"
                  : stat.trend.direction === "down"
                    ? "▼"
                    : "■"}
                {" "}{stat.trend.value}%
              </span>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
