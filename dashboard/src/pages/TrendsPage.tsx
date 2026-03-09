import { useState, useMemo } from "react";
import { useParams } from "react-router";
import { useTrends } from "@/hooks/use-trends";
import { usePropertyKeys } from "@/hooks/use-properties";
import { PageLayout } from "@/components/PageLayout";
import { PropertyFilter } from "@/components/PropertyFilter";
import { BreakdownSelector } from "@/components/BreakdownSelector";
import { InsightsChart } from "@/components/InsightsChart";
import { ChartTypeSwitcher } from "@/components/ChartTypeSwitcher";
import { ControlDivider } from "@/components/ControlDivider";
import { TotalsCard } from "@/components/TotalsCard";
import {
  TimeRangeSelector,
  type TimeRange,
  getPresetRange,
} from "@/components/TimeRangeSelector";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventCombobox } from "@/components/EventCombobox";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import type { InsightsFilter, TrendsRequest, TrendsEventQuery } from "@/lib/api";
import type { Granularity, Metric, ChartType } from "@/lib/analytics-types";
import { METRIC_OPTIONS } from "@/lib/analytics-types";

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
    <PageLayout title="Trends">
      {/* Global controls */}
      <div className="flex flex-wrap items-center gap-3">
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />

        <ControlDivider />

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

        <ControlDivider />

        <ChartTypeSwitcher value={chartType} onChange={setChartType} />
      </div>

      {/* Event query rows */}
      <Card>
        <CardHeader>
          <CardTitle>Events</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {eventRows.map((row, index) => (
            <div
              key={index}
              className="flex flex-wrap items-center gap-2.5 rounded-lg border border-border px-3 py-2.5"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded bg-muted text-xs font-semibold text-muted-foreground">
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

              <div className="flex-1 min-w-0" />

              <PropertyFilter
                filters={row.filters}
                onChange={(f) => updateEventRow(index, { filters: f })}
                propertyKeys={propertyKeys}
              />

              {eventRows.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeEventRow(index)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}

          {eventRows.length < 10 && (
            <div className="pt-1">
              <Button variant="outline" size="sm" onClick={addEventRow}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add Event
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Global filters + Breakdown */}
      <Card>
        <CardContent className="flex flex-wrap items-start gap-8">
          <PropertyFilter
            filters={globalFilters}
            onChange={setGlobalFilters}
            propertyKeys={propertyKeys}
          />
          <div className="hidden sm:block self-stretch w-px bg-border" />
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
        <CardContent className="px-4 py-5">
          <InsightsChart
            series={chartSeries}
            isLoading={isLoading}
            chartType={chartType}
          />
        </CardContent>
      </Card>

      {/* Totals table */}
      <TotalsCard totals={totals} isLoading={isLoading} showEventColumn />
    </PageLayout>
  );
}
