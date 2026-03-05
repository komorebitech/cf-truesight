import { useState, useMemo } from "react";
import { useParams } from "react-router";
import { useFlows } from "@/hooks/use-flows";
import { useEventTypeBreakdown } from "@/hooks/use-stats";
import type { FlowsRequest } from "@/lib/api";
import { Header } from "@/components/Header";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import {
  TimeRangeSelector,
  type TimeRange,
  getPresetRange,
} from "@/components/TimeRangeSelector";
import { SankeyChart } from "@/components/SankeyChart";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";

type Direction = "forward" | "backward";

export function FlowsPage() {
  const { id } = useParams<{ id: string }>();

  const { environment } = useEnvironment();

  const [timeRange, setTimeRange] = useState<TimeRange>(() => getPresetRange("30d"));
  const [anchorEvent, setAnchorEvent] = useState("");
  const [direction, setDirection] = useState<Direction>("forward");
  const [steps, setSteps] = useState(5);
  const [topPaths, setTopPaths] = useState(10);

  const { data: breakdownData } = useEventTypeBreakdown(
    id,
    timeRange.from,
    timeRange.to,
    environment,
  );

  const eventNames = useMemo(() => {
    return breakdownData?.top_events?.map((e) => e.name) ?? [];
  }, [breakdownData]);

  const flowsRequest: FlowsRequest | null = useMemo(() => {
    if (!anchorEvent) return null;
    return {
      anchor_event: anchorEvent,
      direction,
      steps,
      top_paths: topPaths,
      from: timeRange.from,
      to: timeRange.to,
      environment,
    };
  }, [anchorEvent, direction, steps, topPaths, timeRange, environment]);

  const { data: flowsData, isLoading } = useFlows(id, flowsRequest);

  const handleStepsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 2 && val <= 7) {
      setSteps(val);
    }
  };

  const handleTopPathsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 1 && val <= 20) {
      setTopPaths(val);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <Header title="Flows" />

      <div className="flex-1 space-y-6 p-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">

          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>

        {/* Configuration card */}
        <Card>
          <CardHeader>
            <CardTitle>Flow Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Anchor Event
                </label>
                <Select
                  value={anchorEvent}
                  onChange={(e) => setAnchorEvent(e.target.value)}
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
                  Direction
                </label>
                <Tabs
                  value={direction}
                  onValueChange={(v) => setDirection(v as Direction)}
                >
                  <TabsList className="w-full">
                    <TabsTrigger value="forward" className="flex-1">Forward</TabsTrigger>
                    <TabsTrigger value="backward" className="flex-1">Backward</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Steps (2-7)
                </label>
                <Input
                  type="number"
                  min={2}
                  max={7}
                  value={steps}
                  onChange={handleStepsChange}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Top Paths
                </label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={topPaths}
                  onChange={handleTopPathsChange}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {!anchorEvent ? (
          <EmptyState
            variant="data"
            title="Select an anchor event"
            description="Choose an anchor event above to visualize user flows"
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>
                {direction === "forward" ? "What happens after" : "What happens before"}{" "}
                &ldquo;{anchorEvent}&rdquo;
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SankeyChart
                nodes={flowsData?.nodes ?? []}
                links={flowsData?.links ?? []}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
