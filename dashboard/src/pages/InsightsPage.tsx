import { useState, useMemo } from "react";
import { useParams } from "react-router";
import { useInsights } from "@/hooks/use-insights";
import { usePropertyKeys } from "@/hooks/use-properties";
import { Header } from "@/components/Header";
import { PropertyFilter } from "@/components/PropertyFilter";
import { BreakdownSelector } from "@/components/BreakdownSelector";
import { InsightsChart } from "@/components/InsightsChart";
import {
  TimeRangeSelector,
  type TimeRange,
  getPresetRange,
} from "@/components/TimeRangeSelector";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { EventCombobox } from "@/components/EventCombobox";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AreaChart as AreaChartIcon, BarChart3 } from "lucide-react";
import { motion } from "motion/react";
import type { InsightsFilter, InsightsRequest } from "@/lib/api";
import { formatNumber } from "@/lib/utils";

type Granularity = "day" | "week" | "month";
type Metric = "total" | "unique_users" | "avg_per_user";
type ChartType = "area" | "bar";

const METRIC_OPTIONS: { value: Metric; label: string }[] = [
  { value: "total", label: "Total Events" },
  { value: "unique_users", label: "Unique Users" },
  { value: "avg_per_user", label: "Avg per User" },
];

export function InsightsPage() {
  const { id } = useParams<{ id: string }>();

  const [timeRange, setTimeRange] = useState<TimeRange>(getPresetRange("30d"));
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [metric, setMetric] = useState<Metric>("total");
  const [eventName, setEventName] = useState<string>("");
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [filters, setFilters] = useState<InsightsFilter[]>([]);
  const [chartType, setChartType] = useState<ChartType>("area");

  const { environment } = useEnvironment();

  // Fetch property keys for filters and breakdown
  const { data: propertyKeysData } = usePropertyKeys(
    id,
    timeRange.from,
    timeRange.to,
    environment,
  );
  const propertyKeys = propertyKeysData?.keys ?? [];

  // Build the insights request
  const insightsRequest = useMemo<InsightsRequest | null>(() => {
    if (!timeRange.from || !timeRange.to) return null;
    const req: InsightsRequest = {
      from: timeRange.from,
      to: timeRange.to,
      granularity,
      metric,
      environment,
    };
    if (eventName) req.event_name = eventName;
    if (groupBy.length > 0) req.group_by = groupBy;
    if (filters.length > 0) {
      const validFilters = filters.filter((f) => f.property && f.operator);
      if (validFilters.length > 0) req.filters = validFilters;
    }
    return req;
  }, [timeRange, granularity, metric, eventName, groupBy, filters, environment]);

  const { data: insightsData, isLoading } = useInsights(id, insightsRequest);

  const series = insightsData?.series ?? [];
  const totals = insightsData?.totals ?? [];

  return (
    <div className="flex flex-1 flex-col">
      <Header title="Insights" />

      <div className="flex-1 space-y-6 p-6">
        {/* Controls row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">

            <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
          </div>
        </div>

        {/* Query builder */}
        <Card>
          <CardHeader>
            <CardTitle>Query</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* First row: Event + Metric */}
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Event
                </Label>
                <EventCombobox
                  projectId={id}
                  value={eventName}
                  onChange={setEventName}
                  placeholder="All Events"
                  allowEmpty
                  emptyLabel="All Events"
                  environment={environment}
                  className="w-52"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Metric
                </Label>
                <Tabs
                  value={metric}
                  onValueChange={(v) => setMetric(v as Metric)}
                >
                  <TabsList>
                    {METRIC_OPTIONS.map((opt) => (
                      <TabsTrigger key={opt.value} value={opt.value}>
                        {opt.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
            </div>

            {/* Second row: Granularity + Chart type */}
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Granularity
                </Label>
                <Tabs
                  value={granularity}
                  onValueChange={(v) => setGranularity(v as Granularity)}
                >
                  <TabsList>
                    <TabsTrigger value="day">Day</TabsTrigger>
                    <TabsTrigger value="week">Week</TabsTrigger>
                    <TabsTrigger value="month">Month</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Chart Type
                </Label>
                <div className="flex items-center gap-1">
                  <Button
                    variant={chartType === "area" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setChartType("area")}
                  >
                    <AreaChartIcon className="h-4 w-4" />
                    Area
                  </Button>
                  <Button
                    variant={chartType === "bar" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setChartType("bar")}
                  >
                    <BarChart3 className="h-4 w-4" />
                    Bar
                  </Button>
                </div>
              </div>
            </div>

            {/* Filters */}
            <PropertyFilter
              filters={filters}
              onChange={setFilters}
              propertyKeys={propertyKeys}
            />

            {/* Breakdown */}
            <BreakdownSelector
              value={groupBy}
              onChange={setGroupBy}
              propertyKeys={propertyKeys}
            />
          </CardContent>
        </Card>

        {/* Chart results */}
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
          <CardContent>
            <InsightsChart
              series={series}
              isLoading={isLoading}
              chartType={chartType}
            />
          </CardContent>
        </Card>

        {/* Totals table */}
        <Card>
          <CardHeader>
            <CardTitle>Totals</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6">
                <Skeleton className="h-24 w-full" />
              </div>
            ) : totals.length === 0 ? (
              <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                No data
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Group</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {totals.map((total, i) => {
                      const groupLabel =
                        Object.keys(total.group).length === 0
                          ? "All"
                          : Object.entries(total.group)
                              .map(([k, v]) => `${k}=${v}`)
                              .join(", ");
                      return (
                        <TableRow key={i}>
                          <TableCell className="font-medium">
                            {groupLabel}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatNumber(total.value)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
