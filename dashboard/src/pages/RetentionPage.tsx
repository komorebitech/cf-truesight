import { useState, useMemo } from "react";
import { useParams, useSearchParams } from "react-router";
import { useRetention } from "@/hooks/use-retention";
import { useEventTypeBreakdown } from "@/hooks/use-stats";
import type { RetentionRequest } from "@/lib/api";
import { Header } from "@/components/Header";
import { EnvironmentSelector } from "@/components/EnvironmentSelector";
import {
  TimeRangeSelector,
  type TimeRange,
  getPresetRange,
} from "@/components/TimeRangeSelector";
import { RetentionMatrix } from "@/components/RetentionMatrix";
import { RetentionChart } from "@/components/RetentionChart";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";

type RetentionType = "day" | "week" | "month";

export function RetentionPage() {
  const { id } = useParams<{ id: string }>();

  const [searchParams, setSearchParams] = useSearchParams();
  const environment = (searchParams.get("env") as "live" | "test") || "live";
  const setEnvironment = (env: "live" | "test") => {
    setSearchParams((prev) => {
      if (env === "live") { prev.delete("env"); } else { prev.set("env", env); }
      return prev;
    });
  };

  const [timeRange, setTimeRange] = useState<TimeRange>(() => getPresetRange("90d"));
  const [startEvent, setStartEvent] = useState("");
  const [returnEvent, setReturnEvent] = useState("");
  const [retentionType, setRetentionType] = useState<RetentionType>("day");
  const [numPeriods, setNumPeriods] = useState(8);

  const { data: breakdownData } = useEventTypeBreakdown(
    id,
    timeRange.from,
    timeRange.to,
    environment,
  );

  const eventNames = useMemo(() => {
    return breakdownData?.top_events?.map((e) => e.name) ?? [];
  }, [breakdownData]);

  // Build RetentionRequest only when a start event is selected
  const retentionRequest: RetentionRequest | null = useMemo(() => {
    if (!startEvent) return null;
    return {
      start_event: startEvent,
      return_event: returnEvent || undefined,
      retention_type: retentionType,
      num_periods: numPeriods,
      from: timeRange.from,
      to: timeRange.to,
      environment,
    };
  }, [startEvent, returnEvent, retentionType, numPeriods, timeRange, environment]);

  const { data: retentionData, isLoading } = useRetention(id, retentionRequest);

  const cohorts = retentionData?.cohorts ?? [];

  const handleNumPeriodsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 1 && val <= 12) {
      setNumPeriods(val);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <Header title="Retention" />

      <div className="flex-1 space-y-6 p-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <EnvironmentSelector value={environment} onChange={setEnvironment} />
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>

        {/* Configuration card */}
        <Card>
          <CardHeader>
            <CardTitle>Retention Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Start Event
                </label>
                <Select
                  value={startEvent}
                  onChange={(e) => setStartEvent(e.target.value)}
                >
                  <option value="">Select an event...</option>
                  {eventNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Return Event
                </label>
                <Select
                  value={returnEvent}
                  onChange={(e) => setReturnEvent(e.target.value)}
                >
                  <option value="">Any Event</option>
                  {eventNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Retention Type
                </label>
                <Tabs
                  value={retentionType}
                  onValueChange={(v) => setRetentionType(v as RetentionType)}
                >
                  <TabsList className="w-full">
                    <TabsTrigger value="day" className="flex-1">Day</TabsTrigger>
                    <TabsTrigger value="week" className="flex-1">Week</TabsTrigger>
                    <TabsTrigger value="month" className="flex-1">Month</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Number of Periods
                </label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={numPeriods}
                  onChange={handleNumPeriodsChange}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {!startEvent ? (
          <EmptyState
            variant="data"
            title="Select a start event"
            description="Choose a start event above to calculate retention cohorts"
          />
        ) : isLoading ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Retention Matrix</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Retention Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-72 w-full" />
              </CardContent>
            </Card>
          </div>
        ) : cohorts.length === 0 ? (
          <EmptyState
            variant="data"
            title="No retention data"
            description="No cohorts were found for the selected configuration and time range"
          />
        ) : (
          <div className="space-y-6">
            {/* Retention Matrix */}
            <Card>
              <CardHeader>
                <CardTitle>Retention Matrix</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <RetentionMatrix
                  cohorts={cohorts}
                  retentionType={retentionType}
                />
              </CardContent>
            </Card>

            {/* Retention Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Retention Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <RetentionChart
                  cohorts={cohorts}
                  retentionType={retentionType}
                  isLoading={false}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
