import { useState, useMemo } from "react";
import { useParams } from "react-router";
import { formatISO, startOfDay, format } from "date-fns";
import { useActiveUsers, useLiveUsers, useEventCount } from "@/hooks/use-stats";
import { Header } from "@/components/Header";
import { StatsCards, type StatCardData } from "@/components/StatsCards";
import {
  TimeRangeSelector,
  type TimeRange,
  getPresetRange,
} from "@/components/TimeRangeSelector";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, UserPlus, Activity, Radio } from "lucide-react";
import { motion } from "motion/react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

type Granularity = "day" | "week" | "month";

export function AnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  const [timeRange, setTimeRange] = useState<TimeRange>(getPresetRange("30d"));
  const [granularity, setGranularity] = useState<Granularity>("day");

  const { data: activeData, isLoading: activeLoading } = useActiveUsers(
    id,
    timeRange.from,
    timeRange.to,
    granularity,
  );

  const { data: liveData } = useLiveUsers(id);

  // DAU: today
  const todayFrom = useMemo(
    () => formatISO(startOfDay(new Date())),
    [],
  );
  const todayTo = useMemo(() => formatISO(new Date()), []);
  const { data: todayData } = useActiveUsers(id, todayFrom, todayTo, "day");

  const { data: eventCount } = useEventCount(id, timeRange.from, timeRange.to);

  const currentDAU = todayData?.data?.[0]?.active_users ?? 0;
  const totalNewUsers =
    activeData?.data?.reduce((sum, d) => sum + d.new_users, 0) ?? 0;

  const stats: StatCardData[] = [
    {
      label: "DAU (Today)",
      value: currentDAU,
      icon: <Users className="h-5 w-5" />,
    },
    {
      label: "Live Users (5m)",
      value: liveData?.active_users_5m ?? 0,
      icon: <Radio className="h-5 w-5" />,
    },
    {
      label: "Total Events",
      value: eventCount?.total_events ?? 0,
      icon: <Activity className="h-5 w-5" />,
    },
    {
      label: "New Users",
      value: totalNewUsers,
      icon: <UserPlus className="h-5 w-5" />,
    },
  ];

  const chartData = activeData?.data?.map((d) => ({
    ...d,
    label: format(new Date(d.period), granularity === "month" ? "MMM yyyy" : "MMM d"),
  }));

  return (
    <div className="flex flex-1 flex-col">
      <Header title="Analytics" />

      <div className="flex-1 space-y-6 p-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />

          <Tabs value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
            <TabsList>
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Stats */}
        <StatsCards stats={stats} isLoading={activeLoading} />

        {/* Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            {activeLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : !chartData || chartData.length === 0 ? (
              <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                No data for the selected period
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4 }}
              >
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="activeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="newGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="label"
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
                    />
                    <Area
                      type="monotone"
                      dataKey="active_users"
                      name="Active Users"
                      stroke="hsl(var(--chart-1))"
                      fill="url(#activeGrad)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="new_users"
                      name="New Users"
                      stroke="hsl(var(--chart-2))"
                      fill="url(#newGrad)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
