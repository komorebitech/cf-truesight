import { useState, useMemo } from "react";
import { useParams } from "react-router";
import { useFlows } from "@/hooks/use-flows";
import type { FlowsRequest } from "@/lib/api";
import { Header } from "@/components/Header";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { EventCombobox } from "@/components/EventCombobox";
import {
  TimeRangeSelector,
  type TimeRange,
  getPresetRange,
} from "@/components/TimeRangeSelector";
import { FlowDiagram } from "@/components/FlowDiagram";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentFilter } from "@/components/SegmentFilter";
import { Workflow } from "lucide-react";

type Direction = "forward" | "backward";

export function FlowsPage() {
  const { id } = useParams<{ id: string }>();

  const { environment } = useEnvironment();

  const [timeRange, setTimeRange] = useState<TimeRange>(() => getPresetRange("30d"));
  const [anchorEvent, setAnchorEvent] = useState("");
  const [direction, setDirection] = useState<Direction>("forward");
  const [steps, setSteps] = useState(5);
  const [topPaths, setTopPaths] = useState(10);
  const [segmentId, setSegmentId] = useState<string | undefined>();

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
      segment_id: segmentId,
    };
  }, [anchorEvent, direction, steps, topPaths, timeRange, environment, segmentId]);

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
        <div className="flex flex-wrap items-center gap-2">
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />

          <SegmentFilter
            projectId={id}
            value={segmentId}
            onChange={setSegmentId}
          />

          <div className="h-6 w-px bg-border" />

          <EventCombobox
            projectId={id}
            value={anchorEvent}
            onChange={setAnchorEvent}
            placeholder="Anchor event..."
            environment={environment}
            className="w-48"
          />

          <Tabs
            value={direction}
            onValueChange={(v) => setDirection(v as Direction)}
          >
            <TabsList>
              <TabsTrigger value="forward">Forward</TabsTrigger>
              <TabsTrigger value="backward">Backward</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="h-6 w-px bg-border" />

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Steps</span>
            <Input
              type="number"
              min={2}
              max={7}
              value={steps}
              onChange={handleStepsChange}
              className="w-16"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Paths</span>
            <Input
              type="number"
              min={1}
              max={20}
              value={topPaths}
              onChange={handleTopPathsChange}
              className="w-16"
            />
          </div>
        </div>

        {/* Results */}
        {!anchorEvent ? (
          <EmptyState
            variant="data"
            icon={Workflow}
            title="Select an anchor event"
            description="Choose an anchor event above to visualize how users move through your product"
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>
                {direction === "forward" ? "What happens after" : "What happens before"}{" "}
                &ldquo;{anchorEvent}&rdquo;
              </CardTitle>
              <CardDescription>
                Showing top {topPaths} paths across {steps} steps &middot; Drag to pan, scroll to zoom
              </CardDescription>
            </CardHeader>
            <CardContent className="p-2">
              <FlowDiagram
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
