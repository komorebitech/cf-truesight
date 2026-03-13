import { useEffect, useMemo, useRef, useState } from "react";
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
  Label,
} from "recharts";
import { motion } from "motion/react";

import { useProject } from "@/hooks/use-projects";
import { useLastProject } from "@/hooks/use-last-project";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  useEventCount,
  useThroughput,
  useEventTypeBreakdown,
  useLiveUsers,
  useActiveUsers,
  usePlatformDistribution,
} from "@/hooks/use-stats";
import { PageLayout } from "@/components/PageLayout";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { cn, formatNumber } from "@/lib/utils";
import { CHART_COLORS } from "@/lib/charts";
import { SetupGuide } from "@/components/SetupGuide";

// ---------------------------------------------------------------------------
// Time-of-day greeting
// ---------------------------------------------------------------------------

// Templates use {name} where it fits grammatically — replaced at render time.
const GREETINGS = {
  lateNight: [
    "Burning the midnight oil, {name}?",
    "Still at it, {name}?",
    "The night is young, {name}",
    "{name}, hacking away at this hour?",
    "Who needs sleep anyway, {name}",
  ],
  morning: [
    "Good morning, {name}",
    "Rise and shine, {name}",
    "Top of the morning to you, {name}",
    "Fresh start today, {name}",
    "Let's crush it today, {name}",
    "{name}, you're up early",
  ],
  afternoon: [
    "Good afternoon, {name}",
    "Hope your day's going well, {name}",
    "{name}, afternoon hustle mode",
    "Keep the momentum going, {name}",
    "{name}, halfway through — strong finish ahead",
  ],
  evening: [
    "Good evening, {name}",
    "Wrapping up the day, {name}?",
    "{name}, winding down?",
    "Evening check-in time, {name}",
    "One last look before calling it, {name}?",
  ],
} as const;

function pickRandom(arr: readonly string[]): string {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function useGreeting(name: string | undefined): string {
  return useMemo(() => {
    const hour = new Date().getHours();
    let pool: readonly string[];
    if (hour < 5) pool = GREETINGS.lateNight;
    else if (hour < 12) pool = GREETINGS.morning;
    else if (hour < 17) pool = GREETINGS.afternoon;
    else pool = GREETINGS.evening;

    const template = pickRandom(pool);
    return name ? template.replace("{name}", name) : template.replace(/,?\s*\{name\}\s*,?/, "").trim();
  }, [name]);
}

// ---------------------------------------------------------------------------
// CountUp animation
// ---------------------------------------------------------------------------

function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number | undefined>(undefined);

  useEffect(() => {
    const duration = 700;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Quart ease-out for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 4);
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

function TrendArrow({ up }: { up: boolean }) {
  return (
    <motion.svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      className="inline-block"
      initial={{ opacity: 0, y: up ? 4 : -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.5 }}
    >
      <motion.path
        d={up ? "M5 8 L5 2 M2 4 L5 1 L8 4" : "M5 2 L5 8 M2 6 L5 9 L8 6"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.4, delay: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
      />
    </motion.svg>
  );
}

function TrendBadge({ current, previous }: { current: number; previous: number }) {
  const pct = trendPct(current, previous);
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <motion.span
      className={cn(
        "inline-flex items-center gap-0.5 text-sm font-semibold",
        up
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-red-600 dark:text-red-400",
      )}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <TrendArrow up={up} />
      {Math.abs(pct)}%
    </motion.span>
  );
}

// ---------------------------------------------------------------------------
// Donut center label
// ---------------------------------------------------------------------------

function DonutCenterLabel({ viewBox, value }: { viewBox?: { cx: number; cy: number }; value: string }) {
  if (!viewBox) return null;
  return (
    <text
      x={viewBox.cx}
      y={viewBox.cy}
      textAnchor="middle"
      dominantBaseline="central"
    >
      <tspan
        x={viewBox.cx}
        dy="-0.3em"
        className="fill-foreground text-xl font-semibold"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {value}
      </tspan>
      <tspan
        x={viewBox.cx}
        dy="1.4em"
        className="fill-muted-foreground text-[10px] uppercase tracking-widest"
      >
        users
      </tspan>
    </text>
  );
}

// ---------------------------------------------------------------------------
// Chart tooltip styles
// ---------------------------------------------------------------------------

const tooltipStyle = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "10px",
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
  const { user } = useAuth();
  const firstName = user?.name?.split(" ")[0];
  const greeting = useGreeting(firstName);

  useEffect(() => {
    if (id) setLastProject(id);
  }, [id, setLastProject]);

  // Date boundaries — memoised so TanStack Query keys stay stable across renders
  const { todayStart, nowISO, yesterdayStart, d7Ago, d14Ago, d30Ago, d60Ago } =
    useMemo(() => {
      const now = new Date();
      return {
        todayStart: formatISO(startOfDay(now)),
        nowISO: formatISO(now),
        yesterdayStart: formatISO(startOfDay(subDays(now, 1))),
        d7Ago: formatISO(startOfDay(subDays(now, 7))),
        d14Ago: formatISO(startOfDay(subDays(now, 14))),
        d30Ago: formatISO(startOfDay(subDays(now, 30))),
        d60Ago: formatISO(startOfDay(subDays(now, 60))),
      };
    }, []);

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
  const DEVICE_LABELS: Record<string, string> = {
    ios: "iOS",
    android: "Android",
    desktop: "Desktop",
    mobile_web: "Mobile Web",
    web: "Web",
    other: "Other",
  };
  const platformChartData = (platformData?.data ?? []).map((d) => ({
    ...d,
    platform: DEVICE_LABELS[d.platform] ?? (d.platform || "Unknown"),
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
      <PageLayout title="Project">
        <Skeleton className="h-36 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-80 lg:col-span-2 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </PageLayout>
    );
  }

  if (!project) {
    return (
      <PageLayout title="Project">
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">Project not found.</p>
        </div>
      </PageLayout>
    );
  }

  // -- Pulse strip data --
  const pulseItems = [
    {
      label: "Live",
      sublabel: "30m",
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
    <PageLayout title={greeting}>
        {/* ── Setup Guide (shown when no events yet) ─── */}
        {!eventCountLoading && totalEvents === 0 && (
          <SetupGuide projectId={id!} />
        )}

        {/* ── Pulse Strip — THE hero moment ────────────── */}
        <div className="group/pulse relative overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(15,12%,8%)] via-[hsl(15,10%,11%)] to-[hsl(20,8%,14%)] p-8">
          {/* Decorative warm glow — intensifies subtly on hover */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-[#FEC89A] opacity-[0.08] blur-3xl transition-opacity duration-700 group-hover/pulse:opacity-[0.12]" />
          <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-[#FFD7BA] opacity-[0.06] blur-2xl transition-opacity duration-700 group-hover/pulse:opacity-[0.1]" />

          <div className="relative grid grid-cols-2 gap-6 lg:grid-cols-4">
            {pulseItems.map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1, ease: [0.25, 0.1, 0.25, 1] }}
                className={cn(
                  "group/metric flex flex-col rounded-xl px-1 py-1 -mx-1 -my-1 transition-colors duration-300 hover:bg-white/[0.04]",
                  i > 0 && "lg:pl-6",
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  {item.live && (
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                    </span>
                  )}
                  <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/40 transition-colors duration-300 group-hover/metric:text-white/55">
                    {item.label}
                    {item.sublabel && (
                      <span className="ml-1 text-white/25">{item.sublabel}</span>
                    )}
                  </span>
                </div>
                <div className="flex items-baseline gap-3">
                  {item.loading ? (
                    <Skeleton className="h-10 w-20 bg-white/10" />
                  ) : (
                    <span className="font-display text-4xl font-semibold tracking-tight text-white leading-none">
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
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Active Users Trend */}
          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Active Users — 30 Days</CardTitle>
              </CardHeader>
              <CardContent>
                {dauChartLoading ? (
                  <Skeleton className="h-[280px] w-full" />
                ) : dauChartData.length === 0 ? (
                  <div className="flex h-[280px] flex-col items-center justify-center gap-1">
                    <span className="text-sm text-muted-foreground">Your audience chart will come alive here</span>
                    <span className="text-xs text-muted-foreground/60">Start sending events to see daily trends</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={dauChartData}>
                      <defs>
                        <linearGradient id="gradActive" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradNew" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.25} />
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
                <CardTitle className="text-sm font-medium">Device Mix</CardTitle>
              </CardHeader>
              <CardContent>
                {platformLoading ? (
                  <Skeleton className="mx-auto h-40 w-40 rounded-full" />
                ) : platformChartData.length === 0 ? (
                  <div className="flex h-40 flex-col items-center justify-center gap-1">
                    <span className="text-sm text-muted-foreground">Waiting for your first events</span>
                    <span className="text-xs text-muted-foreground/60">iOS, Android, Desktop, Mobile Web</span>
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
                          <Label
                            content={
                              <DonutCenterLabel
                                value={formatNumber(
                                  platformChartData.reduce((s, d) => s + d.users, 0),
                                )}
                              />
                            }
                            position="center"
                          />
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
                          <span className="font-semibold">{formatNumber(d.users)}</span>
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
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
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
                  <div className="flex h-40 flex-col items-center justify-center gap-1">
                    <span className="text-sm text-muted-foreground">Your top events will rank here</span>
                    <span className="text-xs text-muted-foreground/60">Send a few events to see what's popular</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {topEvents.map((ev, i) => (
                      <motion.div
                        key={ev.name}
                        className="group/event rounded-lg px-2 py-1.5 -mx-2 transition-colors duration-200 hover:bg-muted/50"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          duration: 0.3,
                          delay: 0.3 + i * 0.05,
                          ease: [0.25, 0.1, 0.25, 1],
                        }}
                      >
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold tabular-nums text-muted-foreground/70 bg-muted">
                              {i + 1}
                            </span>
                            <span className="truncate font-medium">{ev.name}</span>
                          </div>
                          <span className="shrink-0 ml-4 tabular-nums text-muted-foreground">
                            {formatNumber(ev.count)}
                          </span>
                        </div>
                        <div className="mt-1.5 ml-[30px] h-1.5 w-[calc(100%-30px)] overflow-hidden rounded-full bg-muted">
                          <motion.div
                            className="h-full rounded-full"
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: ev.count / maxEventCount }}
                            transition={{
                              duration: 0.6,
                              delay: 0.3 + i * 0.06,
                              ease: [0.25, 0.1, 0.25, 1],
                            }}
                            style={{
                              transformOrigin: "left",
                              background: `linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.5) 100%)`,
                            }}
                          />
                        </div>
                      </motion.div>
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
                    <Skeleton className="h-10 w-28" />
                  ) : (
                    <p className="font-display text-3xl font-semibold tracking-tight">{formatNumber(totalEvents)}</p>
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
                  <div className="flex h-[120px] flex-col items-center justify-center gap-1">
                    <span className="text-sm text-muted-foreground">Event throughput will flow here</span>
                    <span className="text-xs text-muted-foreground/60">Hourly volume over the last 30 days</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={120}>
                    <AreaChart data={sparkData}>
                      <XAxis dataKey="ts" hide />
                      <defs>
                        <linearGradient id="gradSpark" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--chart-3))" stopOpacity={0.25} />
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
                        labelFormatter={(v: number) => format(new Date(v), "MMM d, hh:mm a")}
                        formatter={(value: number) => [value.toLocaleString(), "Events"]}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
    </PageLayout>
  );
}
