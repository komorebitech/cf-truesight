import { useState, useMemo } from "react";
import { useParams } from "react-router";
import { usePivots } from "@/hooks/use-pivots";
import { usePropertyKeys } from "@/hooks/use-properties";
import { PageLayout } from "@/components/PageLayout";
import { ControlDivider } from "@/components/ControlDivider";
import { PivotTable } from "@/components/PivotTable";
import { PropertyFilter } from "@/components/PropertyFilter";
import { EventCombobox } from "@/components/EventCombobox";
import {
  TimeRangeSelector,
  type TimeRange,
  getPresetRange,
} from "@/components/TimeRangeSelector";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { InsightsFilter, PivotsRequest } from "@/lib/api";
import type { Metric } from "@/lib/analytics-types";
import { METRIC_OPTIONS } from "@/lib/analytics-types";

export function PivotsPage() {
  const { id } = useParams<{ id: string }>();

  const [timeRange, setTimeRange] = useState<TimeRange>(getPresetRange("30d"));
  const [metric, setMetric] = useState<Metric>("total");
  const [eventName, setEventName] = useState<string>("");
  const [rowDimension, setRowDimension] = useState<string>("");
  const [columnDimension, setColumnDimension] = useState<string>("");
  const [filters, setFilters] = useState<InsightsFilter[]>([]);

  const { environment } = useEnvironment();

  const { data: propertyKeysData } = usePropertyKeys(
    id,
    timeRange.from,
    timeRange.to,
    environment,
  );
  const propertyKeys = propertyKeysData?.keys ?? [];

  const pivotsRequest = useMemo<PivotsRequest | null>(() => {
    if (!timeRange.from || !timeRange.to || !rowDimension || !columnDimension)
      return null;
    const req: PivotsRequest = {
      row_dimension: rowDimension,
      column_dimension: columnDimension,
      metric,
      from: timeRange.from,
      to: timeRange.to,
      environment,
    };
    if (eventName) req.event_name = eventName;
    if (filters.length > 0) {
      const validFilters = filters.filter((f) => f.property && f.operator);
      if (validFilters.length > 0) req.filters = validFilters;
    }
    return req;
  }, [timeRange, metric, eventName, rowDimension, columnDimension, filters, environment]);

  const { data: pivotsData, isLoading } = usePivots(id, pivotsRequest);

  return (
    <PageLayout title="Pivots">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />

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
        </div>

        {/* Dimension selectors */}
        <div className="flex flex-wrap items-start gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Row Dimension
            </label>
            <Select
              value={rowDimension || undefined}
              onValueChange={setRowDimension}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select property..." />
              </SelectTrigger>
              <SelectContent>
                {propertyKeys.map((key) => (
                  <SelectItem key={key} value={key}>
                    {key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Column Dimension
            </label>
            <Select
              value={columnDimension || undefined}
              onValueChange={setColumnDimension}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select property..." />
              </SelectTrigger>
              <SelectContent>
                {propertyKeys.map((key) => (
                  <SelectItem key={key} value={key}>
                    {key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="pt-5">
            <PropertyFilter
              filters={filters}
              onChange={setFilters}
              propertyKeys={propertyKeys}
            />
          </div>
        </div>

        {/* Pivot table */}
        <Card>
          <CardHeader>
            <CardTitle>Cross-tabulation</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-4">
              <PivotTable
                data={pivotsData}
                isLoading={isLoading}
                rowLabel={rowDimension || "Row"}
                columnLabel={columnDimension || "Column"}
              />
            </div>
          </CardContent>
        </Card>
    </PageLayout>
  );
}
