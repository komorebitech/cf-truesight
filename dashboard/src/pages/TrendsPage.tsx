import { useState, useMemo } from "react";
import { useParams } from "react-router";
import { useTrends } from "@/hooks/use-trends";
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
import { AreaChart as AreaChartIcon, BarChart3, Plus, X } from "lucide-react";
import { motion } from "motion/react";
import type { InsightsFilter, TrendsRequest, TrendsEventQuery } from "@/lib/api";
import { formatNumber } from "@/lib/utils";

type Granularity = "hour" | "day" | "week" | "month";
type Metric = "total" | "unique_users" | "avg_per_user";
type ChartType = "area" | "bar";

const METRIC_OPTIONS: { value: Metric; label: string }[] = [
  { value: "total", label: "Total Events" },
  { value: "unique_users", label: "Unique Users" },
  { value: "avg_per_user", label: "Avg per User" },
];

interface EventRow {
  event_name: string;
  metric: Metric;
  filters: InsightsFilter[];
}

function emptyRow(): EventRow {
  return { event_name: "", metric: "total", filters: [] };
}

export function TrendsPage() {
  const { id } = useParams<{ id: string }>();

  const [timeRange, setTimeRange] = useState<TimeRange>(getPresetRange("30d"));
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [globalFilters, setGlobalFilters] = useState<InsightsFilter[]>([]);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [chartType, setChartType] = useState<ChartType>("area");
  const [eventRows, setEventRows] = useState<EventRow[]>([emptyRow()]);

  const { environment } = useEnvironment();

  const { data: propertyKeysData } = usePropertyKeys(
    id,
    timeRange.from,
    timeRange.to,
    environment,
  );
  const propertyKeys = propertyKeysData?.keys ?? [];

  const trendsRequest = useMemo<TrendsRequest | null>(() => {
    if (!timeRange.from || !timeRange.to) return null;
    const validEvents = eventRows.filter((r) => r.event_name);
    if (validEvents.length === 0) return null;

    const events: TrendsEventQuery[] = validEvents.map((r) => {
      const eq: TrendsEventQuery = {
        event_name: r.event_name,
        metric: r.metric,
      };
      const validFilters = r.filters.filter((f) => f.property && f.operator);
      if (validFilters.length > 0) eq.filters = validFilters;
      return eq;
    });

    const req: TrendsRequest = {
      events,
      from: timeRange.from,
      to: timeRange.to,
      granularity,
      environment,
    };
    if (groupBy.length > 0) req.group_by = groupBy;
    const validGlobalFilters = globalFilters.filter(
      (f) => f.property && f.operator,
    );
    if (validGlobalFilters.length > 0) req.filters = validGlobalFilters;
    return req;
  }, [timeRange, granularity, eventRows, groupBy, globalFilters, environment]);

  const { data: trendsData, isLoading } = useTrends(id, trendsRequest);

  // Transform TrendSeries to InsightsSeries for chart reuse
  const chartSeries = useMemo(() => {
    if (!trendsData?.series) return [];
    return trendsData.series.map((s) => {
      const groupEntries = Object.entries(s.group);
      const label =
        groupEntries.length > 0
          ? `${s.event_name} (${groupEntries.map(([k, v]) => `${k}=${v}`).join(", ")})`
          : s.event_name;
      return {
        group: { event: label } as Record<string, string>,
        data: s.data.map((d) => ({ period: d.period, value: d.value })),
      };
    });
  }, [trendsData]);

  const totals = trendsData?.totals ?? [];

  const addEventRow = () => {
    if (eventRows.length < 10) {
      setEventRows([...eventRows, emptyRow()]);
    }
  };

  const removeEventRow = (index: number) => {
    if (eventRows.length > 1) {
      setEventRows(eventRows.filter((_, i) => i !== index));
    }
  };

  const updateEventRow = (index: number, updates: Partial<EventRow>) => {
    setEventRows(
      eventRows.map((row, i) => (i === index ? { ...row, ...updates } : row)),
    );
  };

  return (
    <div className="flex flex-1 flex-col">
      <Header title="Trends" />

      <div className="flex-1 space-y-6 p-6">
        {/* Global controls */}
        <div className="flex flex-wrap items-center gap-2">
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />

          <div className="h-6 w-px bg-border" />

          <Tabs
            value={granularity}
            onValueChange={(v) => setGranularity(v as Granularity)}
          >
            <TabsList>
              <TabsTrigger value="hour">Hour</TabsTrigger>
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="h-6 w-px bg-border" />

          <div className="flex items-center gap-1">
            <Button
              variant={chartType === "area" ? "default" : "outline"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setChartType("area")}
              title="Area chart"
            >
              <AreaChartIcon className="h-4 w-4" />
            </Button>
            <Button
              variant={chartType === "bar" ? "default" : "outline"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setChartType("bar")}
              title="Bar chart"
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Event query rows */}
        <Card>
          <CardHeader>
            <CardTitle>Events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {eventRows.map((row, index) => (
              <div
                key={index}
                className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3"
              >
                <span className="text-xs font-medium text-muted-foreground w-6">
                  {String.fromCharCode(65 + index)}
                </span>

                <EventCombobox
                  projectId={id}
                  value={row.event_name}
                  onChange={(v) => updateEventRow(index, { event_name: v })}
                  placeholder="Select event"
                  environment={environment}
                  className="w-52"
                />

                <Tabs
                  value={row.metric}
                  onValueChange={(v) =>
                    updateEventRow(index, { metric: v as Metric })
                  }
                >
                  <TabsList>
                    {METRIC_OPTIONS.map((opt) => (
                      <TabsTrigger key={opt.value} value={opt.value}>
                        {opt.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>

                <div className="flex-1" />

                <PropertyFilter
                  filters={row.filters}
                  onChange={(f) => updateEventRow(index, { filters: f })}
                  propertyKeys={propertyKeys}
                />

                {eventRows.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    onClick={() => removeEventRow(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}

            {eventRows.length < 10 && (
              <Button variant="outline" size="sm" onClick={addEventRow}>
                <Plus className="mr-1 h-4 w-4" />
                Add Event
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Global filters + Breakdown */}
        <div className="flex flex-wrap items-start gap-6">
          <PropertyFilter
            filters={globalFilters}
            onChange={setGlobalFilters}
            propertyKeys={propertyKeys}
          />
          <BreakdownSelector
            value={groupBy}
            onChange={setGroupBy}
            propertyKeys={propertyKeys}
          />
        </div>

        {/* Chart results */}
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
          <CardContent>
            <InsightsChart
              series={chartSeries}
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
                      <TableHead>Event</TableHead>
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
                            {total.event_name}
                          </TableCell>
                          <TableCell>{groupLabel}</TableCell>
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
