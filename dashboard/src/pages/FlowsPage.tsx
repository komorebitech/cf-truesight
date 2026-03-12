import { useState, useMemo, useCallback } from "react";
import { useParams } from "react-router";
import { useFlows } from "@/hooks/use-flows";
import type { FlowsRequest } from "@/lib/api";
import { PageLayout } from "@/components/PageLayout";
import { ControlDivider } from "@/components/ControlDivider";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { EventCombobox } from "@/components/EventCombobox";
import {
  TimeRangeSelector,
  type TimeRange,
  getPresetRange,
} from "@/components/TimeRangeSelector";
import { FlowDiagram } from "@/components/FlowDiagram";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentFilter } from "@/components/SegmentFilter";
import { Workflow, ArrowLeft, ChevronRight } from "lucide-react";

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

  // Sub-flow: 1 level deep only
  const [subFlowAnchor, setSubFlowAnchor] = useState<string | null>(null);

  const baseRequest: FlowsRequest | null = useMemo(() => {
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

  const subFlowRequest: FlowsRequest | null = useMemo(() => {
    if (!subFlowAnchor || !baseRequest) return null;
    return {
      ...baseRequest,
      anchor_event: subFlowAnchor,
    };
  }, [subFlowAnchor, baseRequest]);

  const { data: flowsData, isLoading } = useFlows(id, baseRequest);
  const { data: subFlowData, isLoading: subFlowLoading } = useFlows(id, subFlowRequest);

  const isViewingSubFlow = subFlowAnchor !== null;
  const activeData = isViewingSubFlow ? subFlowData : flowsData;
  const activeLoading = isViewingSubFlow ? subFlowLoading : isLoading;
  const handleNodeClick = useCallback((eventName: string) => {
    setSubFlowAnchor(eventName);
  }, []);

  const handleBack = useCallback(() => {
    setSubFlowAnchor(null);
  }, []);

  // Reset sub-flow when main controls change
  const handleAnchorChange = useCallback((v: string) => {
    setAnchorEvent(v);
    setSubFlowAnchor(null);
  }, []);

  const handleDirectionChange = useCallback((v: string) => {
    setDirection(v as Direction);
    setSubFlowAnchor(null);
  }, []);

  const handleStepsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 2 && val <= 7) {
      setSteps(val);
      setSubFlowAnchor(null);
    }
  };

  const handleTopPathsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 1 && val <= 20) {
      setTopPaths(val);
      setSubFlowAnchor(null);
    }
  };

  return (
    <PageLayout title="Flows" spacing={false} className="flex min-h-0 flex-col overflow-hidden !pb-4">
      {/* Controls */}
      <div className="shrink-0 flex flex-wrap items-center gap-3 pb-4">
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />

        <SegmentFilter
          projectId={id}
          value={segmentId}
          onChange={setSegmentId}
        />

        <ControlDivider />

        <EventCombobox
          projectId={id}
          value={anchorEvent}
          onChange={handleAnchorChange}
          placeholder="Anchor event..."
          environment={environment}
          className="w-48"
        />

        <Tabs
          value={direction}
          onValueChange={handleDirectionChange}
        >
          <TabsList>
            <TabsTrigger value="forward">Forward</TabsTrigger>
            <TabsTrigger value="backward">Backward</TabsTrigger>
          </TabsList>
        </Tabs>

        <ControlDivider />

        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Steps</span>
          <Input
            type="number"
            min={2}
            max={7}
            value={steps}
            onChange={handleStepsChange}
            className="h-9 w-16"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Paths</span>
          <Input
            type="number"
            min={1}
            max={20}
            value={topPaths}
            onChange={handleTopPathsChange}
            className="h-9 w-16"
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
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <CardHeader className="shrink-0 py-3">
            <div className="flex items-center gap-3">
              {isViewingSubFlow && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={handleBack}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <div className="min-w-0">
                <CardTitle className="text-base">
                  {isViewingSubFlow ? (
                    <span className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={handleBack}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {anchorEvent}
                      </button>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span>{subFlowAnchor}</span>
                    </span>
                  ) : (
                    <>
                      {direction === "forward" ? "What happens after" : "What happens before"}{" "}
                      &ldquo;{anchorEvent}&rdquo;
                    </>
                  )}
                </CardTitle>
                <CardDescription className="mt-0.5">
                  {isViewingSubFlow
                    ? `Sub-flow from \u201c${subFlowAnchor}\u201d \u00b7 Click back to return`
                    : `Top ${topPaths} paths across ${steps} steps \u00b7 Click a node to explore its sub-flow`
                  }
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 p-0">
            <FlowDiagram
              nodes={activeData?.nodes ?? []}
              links={activeData?.links ?? []}
              isLoading={activeLoading}
              isClickable={!isViewingSubFlow}
              onNodeClick={!isViewingSubFlow ? handleNodeClick : undefined}
            />
          </CardContent>
        </Card>
      )}
    </PageLayout>
  );
}
