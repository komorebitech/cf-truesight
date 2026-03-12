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

const MAX_DEPTH = 3;

export function FlowsPage() {
  const { id } = useParams<{ id: string }>();

  const { environment } = useEnvironment();

  const [timeRange, setTimeRange] = useState<TimeRange>(() => getPresetRange("30d"));
  const [anchorEvent, setAnchorEvent] = useState("");
  const [direction, setDirection] = useState<Direction>("forward");
  const [steps, setSteps] = useState(5);
  const [topPaths, setTopPaths] = useState(10);
  const [segmentId, setSegmentId] = useState<string | undefined>();

  // Breadcrumb stack of sub-flow anchors (max MAX_DEPTH deep)
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>([]);

  const depth = breadcrumbs.length;
  const currentAnchor = depth > 0 ? breadcrumbs[depth - 1]! : anchorEvent;

  const makeRequest = useCallback(
    (anchor: string): FlowsRequest | null => {
      if (!anchor) return null;
      return {
        anchor_event: anchor,
        direction,
        steps,
        top_paths: topPaths,
        from: timeRange.from,
        to: timeRange.to,
        environment,
        segment_id: segmentId,
      };
    },
    [direction, steps, topPaths, timeRange, environment, segmentId],
  );

  // Always fetch the current level
  const activeRequest = useMemo(
    () => makeRequest(currentAnchor),
    [makeRequest, currentAnchor],
  );

  const { data: activeData, isLoading: activeLoading } = useFlows(id, activeRequest);

  const canDrillDown = depth < MAX_DEPTH;

  const handleNodeClick = useCallback(
    (eventName: string) => {
      if (!canDrillDown) return;
      setBreadcrumbs((prev) => [...prev, eventName]);
    },
    [canDrillDown],
  );

  const handleBack = useCallback(() => {
    setBreadcrumbs((prev) => prev.slice(0, -1));
  }, []);

  const handleNavigateTo = useCallback((index: number) => {
    // index -1 = root anchor, 0 = first breadcrumb, etc.
    if (index < 0) {
      setBreadcrumbs([]);
    } else {
      setBreadcrumbs((prev) => prev.slice(0, index + 1));
    }
  }, []);

  // Reset breadcrumbs when main controls change
  const resetBreadcrumbs = useCallback(() => setBreadcrumbs([]), []);

  const handleAnchorChange = useCallback((v: string) => {
    setAnchorEvent(v);
    setBreadcrumbs([]);
  }, []);

  const handleDirectionChange = useCallback((v: string) => {
    setDirection(v as Direction);
    setBreadcrumbs([]);
  }, []);

  const handleStepsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 2 && val <= 7) {
      setSteps(val);
      resetBreadcrumbs();
    }
  };

  const handleTopPathsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 1 && val <= 20) {
      setTopPaths(val);
      resetBreadcrumbs();
    }
  };

  // Build the full breadcrumb trail: [root anchor, ...sub-flow anchors]
  const trail = [anchorEvent, ...breadcrumbs];
  const isSubFlow = depth > 0;

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
              {isSubFlow && (
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
                  {isSubFlow ? (
                    <span className="flex items-center gap-1.5 flex-wrap">
                      {trail.map((name, i) => {
                        const isLast = i === trail.length - 1;
                        return (
                          <span key={i} className="flex items-center gap-1.5">
                            {i > 0 && (
                              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            )}
                            {isLast ? (
                              <span>{name}</span>
                            ) : (
                              <button
                                onClick={() => handleNavigateTo(i - 1)}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {name}
                              </button>
                            )}
                          </span>
                        );
                      })}
                    </span>
                  ) : (
                    <>
                      {direction === "forward" ? "What happens after" : "What happens before"}{" "}
                      &ldquo;{anchorEvent}&rdquo;
                    </>
                  )}
                </CardTitle>
                <CardDescription className="mt-0.5">
                  {isSubFlow
                    ? `Depth ${depth}/${MAX_DEPTH} \u00b7 ${canDrillDown ? "Click a node to go deeper" : "Maximum depth reached"}`
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
              isClickable={canDrillDown}
              onNodeClick={canDrillDown ? handleNodeClick : undefined}
            />
          </CardContent>
        </Card>
      )}
    </PageLayout>
  );
}
