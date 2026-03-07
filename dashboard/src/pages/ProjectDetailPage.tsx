import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import {
  subDays,
  startOfDay,
  formatISO,
  format,
} from "date-fns";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { motion } from "motion/react";

import { useProject } from "@/hooks/use-projects";
import { useLastProject } from "@/hooks/use-last-project";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import {
  useEventCount,
  useThroughput,
  useEventTypeBreakdown,
  useLiveUsers,
  useActiveUsers,
  usePlatformDistribution,
} from "@/hooks/use-stats";
import { Header } from "@/components/Header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { cn, formatNumber } from "@/lib/utils";
import { CHART_COLORS } from "@/lib/charts";

// ---------------------------------------------------------------------------
// CountUp animation (inline, same pattern as StatsCards)
// ---------------------------------------------------------------------------

function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number | undefined>(undefined);

  useEffect(() => {
    const duration = 600;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) ref.current = requestAnimationFrame(animate);
    };
    ref.current = requestAnimationFrame(animate);
    return () => {
      if (ref.current) cancelAnimationFrame(ref.current);
    };
  }, [value]);

  return <>{formatNumber(display)}</>;
}

// ---------------------------------------------------------------------------
// Trend helper
// ---------------------------------------------------------------------------

function trendPct(current: number, prev: number): number | null {
  if (prev > 0) return Math.round(((current - prev) / prev) * 100);
  if (current > 0) return 100;
  return null;
}

function TrendBadge({ current, previous }: { current: number; previous: number }) {
  const pct = trendPct(current, previous);
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span
      className={cn(
        "text-xs font-medium",
        up
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-red-600 dark:text-red-400",
      )}
    >
      {up ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

// ---------------------------------------------------------------------------
// Chart tooltip styles (shared)
// ---------------------------------------------------------------------------

const tooltipStyle = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "13px",
  color: "hsl(var(--popover-foreground))",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: project, isLoading: projectLoading } = useProject(id);
  const { setLastProject } = useLastProject();
  const { environment } = useEnvironment();

  useEffect(() => {
    if (id) setLastProject(id);
  }, [id, setLastProject]);

  // Date boundaries
  const now = new Date();
  const todayStart = formatISO(startOfDay(now));
  const nowISO = formatISO(now);
  const yesterdayStart = formatISO(startOfDay(subDays(now, 1)));
  const d7Ago = formatISO(startOfDay(subDays(now, 7)));
  const d14Ago = formatISO(startOfDay(subDays(now, 14)));
  const d30Ago = formatISO(startOfDay(subDays(now, 30)));
  const d60Ago = formatISO(startOfDay(subDays(now, 60)));

  // -- Data fetching (all parallel via TanStack Query) --
  const { data: liveData, isLoading: liveLoading } = useLiveUsers(id, environment);

  // DAU today + yesterday for trend
  const { data: dauToday } = useActiveUsers(id, todayStart, nowISO, "day", environment);
  const { data: dauYesterday } = useActiveUsers(id, yesterdayStart, todayStart, "day", environment);

  // WAU this week + last week
  const { data: wauThis } = useActiveUsers(id, d7Ago, nowISO, "week", environment);
  const { data: wauPrev } = useActiveUsers(id, d14Ago, d7Ago, "week", environment);

  // MAU this month + last month
  const { data: mauThis } = useActiveUsers(id, d30Ago, nowISO, "month", environment);
  const { data: mauPrev } = useActiveUsers(id, d60Ago, d30Ago, "month", environment);

  // 30-day DAU chart
  const { data: dauChart, isLoading: dauChartLoading } = useActiveUsers(
    id, d30Ago, nowISO, "day", environment,
  );

  // Platform donut
  const { data: platformData, isLoading: platformLoading } = usePlatformDistribution(
    id, d30Ago, nowISO, environment,
  );

  // Top events
  const { data: breakdownData, isLoading: breakdownLoading } = useEventTypeBreakdown(
    id, d30Ago, nowISO, environment,
  );

  // Throughput sparkline
  const { data: throughputData, isLoading: throughputLoading } = useThroughput(
    id, d30Ago, nowISO, "hour", environment,
  );

  // Total events
  const { data: eventCountData, isLoading: eventCountLoading } = useEventCount(
    id, d30Ago, nowISO, environment,
  );

  // -- Derived values --
  const sumActive = (data: typeof dauToday) =>
    data?.data?.reduce((s, p) => s + p.active_users, 0) ?? 0;

  const dauValue = sumActive(dauToday);
  const dauPrevValue = sumActive(dauYesterday);
  const wauValue = sumActive(wauThis);
  const wauPrevValue = sumActive(wauPrev);
  const mauValue = sumActive(mauThis);
  const mauPrevValue = sumActive(mauPrev);

  const totalEvents = eventCountData?.total_events ?? 0;
  const topEvents = breakdownData?.top_events?.slice(0, 7) ?? [];
  const maxEventCount = topEvents[0]?.count ?? 1;

  // Platform donut data
  const platformChartData = (platformData?.data ?? []).map((d) => ({
    ...d,
    platform: d.platform || "unknown",
  }));

  // Sparkline data
  const sparkData = (throughputData?.data ?? []).map((p) => ({
    ts: Number(p.timestamp) * 1000,
    count: p.count,
  }));

  // DAU chart data
  const dauChartData = (dauChart?.data ?? []).map((p) => ({
    ...p,
    label: format(new Date(p.period), "MMM d"),
  }));

  // -- Loading state --
  if (projectLoading) {
    return (
      <div className="flex flex-1 flex-col">
        <Header />
        <div className="p-6 space-y-6">
          <Skeleton className="h-28 w-full rounded-xl" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Skeleton className="h-80 lg:col-span-2 rounded-xl" />
            <Skeleton className="h-80 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-1 flex-col">
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">Project not found.</p>
        </div>
      </div>
    );
  }

  // -- Pulse strip cells --
  const pulseItems = [
    {
      label: "Live (30m)",
      value: liveData?.active_users_30m ?? 0,
      loading: liveLoading,
      live: true,
    },
    {
      label: "DAU",
      value: dauValue,
      prev: dauPrevValue,
    },
    {
      label: "WAU",
      value: wauValue,
      prev: wauPrevValue,
    },
    {
      label: "MAU",
      value: mauValue,
      prev: mauPrevValue,
    },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <Header title={project.name} />

      <div className="flex-1 space-y-6 p-6">
        {/* ── Pulse Strip ─────────────────────────────── */}
        <div className="rounded-xl border border-border/50 bg-gradient-to-r from-secondary/40 to-accent/40 p-5">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {pulseItems.map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.08 }}
                className={cn(
                  "flex flex-col gap-1",
                  i > 0 && "lg:border-l lg:border-border/30 lg:pl-4",
                )}
              >
                <div className="flex items-center gap-1.5">
                  {item.live && (
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                  )}
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {item.label}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  {item.loading ? (
                    <Skeleton className="h-7 w-16" />
                  ) : (
                    <span className="text-2xl font-bold">
                      <CountUp value={item.value} />
                    </span>
                  )}
                  {item.prev !== undefined && (
                    <TrendBadge current={item.value} previous={item.prev} />
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Charts Row 1: Active Users + Platform Mix ──── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Active Users Trend */}
          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Active Users — 30 Days</CardTitle>
              </CardHeader>
              <CardContent>
                {dauChartLoading ? (
                  <Skeleton className="h-[280px] w-full" />
                ) : dauChartData.length === 0 ? (
                  <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                    No data yet
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={dauChartData}>
                      <defs>
                        <linearGradient id="gradActive" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradNew" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={false}
                        interval="equidistantPreserveStart"
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={false}
                        width={40}
                      />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area
                        type="monotone"
                        dataKey="active_users"
                        name="Active"
                        stroke="hsl(var(--chart-1))"
                        strokeWidth={2}
                        fill="url(#gradActive)"
                        dot={false}
                        activeDot={{ r: 3 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="new_users"
                        name="New"
                        stroke="hsl(var(--chart-2))"
                        strokeWidth={2}
                        fill="url(#gradNew)"
                        dot={false}
                        activeDot={{ r: 3 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Platform Mix Donut */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Platform Mix</CardTitle>
              </CardHeader>
              <CardContent>
                {platformLoading ? (
                  <Skeleton className="mx-auto h-40 w-40 rounded-full" />
                ) : platformChartData.length === 0 ? (
                  <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                    No data yet
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={platformChartData}
                          dataKey="users"
                          nameKey="platform"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={3}
                          stroke="none"
                        >
                          {platformChartData.map((_, i) => (
                            <Cell
                              key={i}
                              fill={CHART_COLORS[i % CHART_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-2 flex flex-wrap justify-center gap-3">
                      {platformChartData.map((d, i) => (
                        <div key={d.platform} className="flex items-center gap-1.5 text-xs">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                          />
                          <span className="capitalize text-muted-foreground">
                            {d.platform}
                          </span>
                          <span className="font-medium">{formatNumber(d.users)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* ── Charts Row 2: Top Events + Activity Sparkline ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Top Events */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
          >
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Top Events</CardTitle>
              </CardHeader>
              <CardContent>
                {breakdownLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-6 w-full" />
                    ))}
                  </div>
                ) : topEvents.length === 0 ? (
                  <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                    No events yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {topEvents.map((ev, i) => (
                      <div key={ev.name}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="truncate pr-4 font-medium">{ev.name}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {formatNumber(ev.count)}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <motion.div
                            className="h-full rounded-full bg-primary/60"
                            initial={{ width: 0 }}
                            animate={{
                              width: `${(ev.count / maxEventCount) * 100}%`,
                            }}
                            transition={{
                              duration: 0.5,
                              delay: 0.3 + i * 0.06,
                              ease: "easeOut",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Event Activity Sparkline */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <Card className="h-full">
              <CardHeader>
                <div>
                  {eventCountLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <p className="text-2xl font-bold">{formatNumber(totalEvents)}</p>
                  )}
                  <CardTitle className="mt-1 text-sm font-medium text-muted-foreground">
                    Events — last 30 days
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {throughputLoading ? (
                  <Skeleton className="h-[120px] w-full" />
                ) : sparkData.length === 0 ? (
                  <div className="flex h-[120px] items-center justify-center text-sm text-muted-foreground">
                    No data yet
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={120}>
                    <AreaChart data={sparkData}>
                      <defs>
                        <linearGradient id="gradSpark" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="hsl(var(--chart-3))"
                        strokeWidth={1.5}
                        fill="url(#gradSpark)"
                        dot={false}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(v: number) => format(new Date(v), "MMM d, HH:mm")}
                        formatter={(value: number) => [value.toLocaleString(), "Events"]}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
