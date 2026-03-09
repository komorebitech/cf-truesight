import { useState, useMemo } from "react";
import { useParams } from "react-router";
import { useRetention } from "@/hooks/use-retention";
import type { RetentionRequest } from "@/lib/api";
import { PageLayout } from "@/components/PageLayout";
import { ControlDivider } from "@/components/ControlDivider";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { EventCombobox } from "@/components/EventCombobox";
import {
  TimeRangeSelector,
  type TimeRange,
  getPresetRange,
} from "@/components/TimeRangeSelector";
import { RetentionMatrix } from "@/components/RetentionMatrix";
import { RetentionChart } from "@/components/RetentionChart";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentFilter } from "@/components/SegmentFilter";

type RetentionType = "day" | "week" | "month";

export function RetentionPage() {
  const { id } = useParams<{ id: string }>();

  const { environment } = useEnvironment();

  const [timeRange, setTimeRange] = useState<TimeRange>(() => getPresetRange("90d"));
  const [startEvent, setStartEvent] = useState("");
  const [returnEvent, setReturnEvent] = useState("");
  const [retentionType, setRetentionType] = useState<RetentionType>("day");
  const [numPeriods, setNumPeriods] = useState(8);
  const [segmentId, setSegmentId] = useState<string | undefined>();

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
      segment_id: segmentId,
    };
  }, [startEvent, returnEvent, retentionType, numPeriods, timeRange, environment, segmentId]);

  const { data: retentionData, isLoading } = useRetention(id, retentionRequest);

  const cohorts = retentionData?.cohorts ?? [];

  const handleNumPeriodsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 1 && val <= 12) {
      setNumPeriods(val);
    }
  };

  return (
    <PageLayout title="Retention">
      {/* Controls */}
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
            value={startEvent}
            onChange={setStartEvent}
            placeholder="Start event..."
            environment={environment}
            className="w-44"
          />

          <EventCombobox
            projectId={id}
            value={returnEvent}
            onChange={setReturnEvent}
            placeholder="Return event (any)"
            allowEmpty
            emptyLabel="Any Event"
            environment={environment}
            className="w-44"
          />

          <ControlDivider />

          <Tabs
            value={retentionType}
            onValueChange={(v) => setRetentionType(v as RetentionType)}
          >
            <TabsList>
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Periods</span>
            <Input
              type="number"
              min={1}
              max={12}
              value={numPeriods}
              onChange={handleNumPeriodsChange}
              className="w-16"
            />
          </div>
        </div>

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
    </PageLayout>
  );
}
