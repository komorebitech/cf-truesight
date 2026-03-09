import { useState, useMemo } from "react";
import { useParams } from "react-router";
import { useInsights } from "@/hooks/use-insights";
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
import { SegmentFilter } from "@/components/SegmentFilter";
import type { InsightsFilter, InsightsRequest } from "@/lib/api";
import type { Granularity, Metric, ChartType } from "@/lib/analytics-types";
import { METRIC_OPTIONS } from "@/lib/analytics-types";

export function InsightsPage() {
  const { id } = useParams<{ id: string }>();

  const [timeRange, setTimeRange] = useState<TimeRange>(getPresetRange("30d"));
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [metric, setMetric] = useState<Metric>("total");
  const [eventName, setEventName] = useState<string>("");
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [filters, setFilters] = useState<InsightsFilter[]>([]);
  const [chartType, setChartType] = useState<ChartType>("area");
  const [segmentId, setSegmentId] = useState<string | undefined>();

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
    if (segmentId) req.segment_id = segmentId;
    return req;
  }, [timeRange, granularity, metric, eventName, groupBy, filters, environment, segmentId]);

  const { data: insightsData, isLoading } = useInsights(id, insightsRequest);

  const series = insightsData?.series ?? [];
  const totals = insightsData?.totals ?? [];

  return (
    <PageLayout title="Insights">
      {/* Query controls */}
      <div className="flex flex-wrap items-center gap-2">
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />

        <SegmentFilter
          projectId={id}
          value={segmentId}
          onChange={setSegmentId}
        />

        <ControlDivider />

        <EventCombobox
          projectId={id}
          value={eventName}
          onChange={setEventName}
          placeholder="All Events"
          allowEmpty
          emptyLabel="All Events"
          environment={environment}
          className="w-44"
        />

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

        <ControlDivider />

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

        <ChartTypeSwitcher value={chartType} onChange={setChartType} />
      </div>

      {/* Filters + Breakdown */}
      <div className="flex flex-wrap items-start gap-6">
        <PropertyFilter
          filters={filters}
          onChange={setFilters}
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
            series={series}
            isLoading={isLoading}
            chartType={chartType}
          />
        </CardContent>
      </Card>

      {/* Totals table */}
      <TotalsCard totals={totals} isLoading={isLoading} />
    </PageLayout>
  );
}
