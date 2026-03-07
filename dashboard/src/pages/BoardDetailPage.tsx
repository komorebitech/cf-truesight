import { useState, useCallback, useRef } from "react";
import { useParams } from "react-router";
import { GridLayout, type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import {
  useBoard,
  useCreateWidget,
  useDeleteWidget,
  useBatchUpdateLayouts,
} from "@/hooks/use-boards";
import { Header } from "@/components/Header";
import { WidgetRenderer } from "@/components/widgets/WidgetRenderer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, X } from "lucide-react";
import type { BatchLayoutItem } from "@/lib/api";

const WIDGET_TYPES = [
  { value: "event_trend", label: "Event Trend" },
  { value: "funnel", label: "Funnel" },
  { value: "metric", label: "Metric" },
  { value: "active_users", label: "Active Users" },
];

const COLS = 12;

export function BoardDetailPage() {
  const { id, boardId } = useParams<{ id: string; boardId: string }>();
  const { data: board, isLoading } = useBoard(id, boardId);
  const createWidget = useCreateWidget(id, boardId);
  const deleteWidget = useDeleteWidget(id, boardId);
  const batchLayouts = useBatchUpdateLayouts(id, boardId);

  const [showAddWidget, setShowAddWidget] = useState(false);
  const [widgetType, setWidgetType] = useState("event_trend");
  const [widgetTitle, setWidgetTitle] = useState("");
  const [widgetEventName, setWidgetEventName] = useState("");
  const [widgetFunnelId, setWidgetFunnelId] = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLayoutChange = useCallback(
    (layout: Layout) => {
      if (!board?.widgets?.length) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const items: BatchLayoutItem[] = layout
          .filter((l) => board.widgets.some((w) => w.id === l.i))
          .map((l) => ({
            widget_id: l.i,
            layout: { x: l.x, y: l.y, w: l.w, h: l.h },
          }));
        if (items.length > 0) {
          batchLayouts.mutate(items);
        }
      }, 300);
    },
    [board?.widgets, batchLayouts],
  );

  const handleAddWidget = async () => {
    const config: Record<string, unknown> = { from_preset: "7d" };
    if (widgetType === "event_trend" || widgetType === "metric") {
      config.event_name = widgetEventName;
    } else if (widgetType === "funnel") {
      config.funnel_id = widgetFunnelId;
    }

    const widgetCount = board?.widgets?.length ?? 0;
    await createWidget.mutateAsync({
      widget_type: widgetType,
      title: widgetTitle,
      config,
      layout: { x: (widgetCount * 4) % COLS, y: Infinity, w: 4, h: 3 },
      position: widgetCount,
    });
    setShowAddWidget(false);
    setWidgetTitle("");
    setWidgetEventName("");
    setWidgetFunnelId("");
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col">
        <Header title="Board" />
        <div className="p-6">
          <Skeleton className="mb-4 h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const gridLayout: Layout =
    board?.widgets?.map((w) => ({
      i: w.id,
      x: w.layout.x ?? 0,
      y: w.layout.y ?? 0,
      w: w.layout.w ?? 4,
      h: w.layout.h ?? 3,
      minW: 2,
      minH: 2,
    })) ?? [];

  return (
    <div className="flex flex-1 flex-col">
      <Header title={board?.name ?? "Board"} />

      <div className="flex-1 p-6">
        <div className="mb-4 flex items-center justify-between">
          {board?.description && (
            <p className="text-sm text-muted-foreground">
              {board.description}
            </p>
          )}
          <Button
            onClick={() => setShowAddWidget(true)}
            disabled={(board?.widgets?.length ?? 0) >= 20}
          >
            <Plus className="h-4 w-4" />
            Add Widget
          </Button>
        </div>

        {!board?.widgets?.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="mb-2 text-sm text-muted-foreground">
              This board has no widgets yet.
            </p>
            <Button onClick={() => setShowAddWidget(true)}>
              <Plus className="h-4 w-4" />
              Add Widget
            </Button>
          </div>
        ) : (
          <GridLayout
            layout={gridLayout}
            width={1200}
            gridConfig={{ cols: COLS, rowHeight: 80 }}
            dragConfig={{ handle: ".widget-drag-handle" }}
            onLayoutChange={handleLayoutChange}
          >
            {board.widgets.map((widget) => (
              <div key={widget.id}>
                <Card className="relative h-full overflow-hidden">
                  <div className="widget-drag-handle flex cursor-grab items-center justify-between border-b px-3 py-1.5">
                    <span className="text-xs font-medium truncate">
                      {widget.title}
                    </span>
                    <button
                      onClick={() => deleteWidget.mutate(widget.id)}
                      className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="h-[calc(100%-32px)]">
                    <WidgetRenderer widget={widget} projectId={id!} />
                  </div>
                </Card>
              </div>
            ))}
          </GridLayout>
        )}
      </div>

      <Dialog open={showAddWidget} onOpenChange={setShowAddWidget}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Widget</DialogTitle>
            <DialogDescription>
              Add a new widget to this board.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Widget Type</Label>
              <Select value={widgetType} onValueChange={setWidgetType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WIDGET_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="Widget title"
                value={widgetTitle}
                onChange={(e) => setWidgetTitle(e.target.value)}
              />
            </div>
            {(widgetType === "event_trend" || widgetType === "metric") && (
              <div className="space-y-2">
                <Label>Event Name</Label>
                <Input
                  placeholder="e.g. page_view"
                  value={widgetEventName}
                  onChange={(e) => setWidgetEventName(e.target.value)}
                />
              </div>
            )}
            {widgetType === "funnel" && (
              <div className="space-y-2">
                <Label>Funnel ID</Label>
                <Input
                  placeholder="UUID of the funnel"
                  value={widgetFunnelId}
                  onChange={(e) => setWidgetFunnelId(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddWidget(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddWidget}
              disabled={!widgetTitle.trim() || createWidget.isPending}
            >
              {createWidget.isPending ? "Adding..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
