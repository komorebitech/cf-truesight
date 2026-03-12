import type { BoardWidget } from "@/lib/api";
import { EventTrendWidget } from "./EventTrendWidget";
import { TrendWidget } from "./TrendWidget";
import { FunnelWidget } from "./FunnelWidget";
import { MetricWidget } from "./MetricWidget";
import { ActiveUsersWidget } from "./ActiveUsersWidget";

interface Props {
  widget: BoardWidget;
  projectId: string;
}

export function WidgetRenderer({ widget, projectId }: Props) {
  switch (widget.widget_type) {
    case "event_trend":
      return <EventTrendWidget projectId={projectId} config={widget.config} />;
    case "trend":
      return <TrendWidget projectId={projectId} config={widget.config} />;
    case "funnel":
      return <FunnelWidget projectId={projectId} config={widget.config} />;
    case "metric":
      return <MetricWidget projectId={projectId} config={widget.config} />;
    case "active_users":
      return <ActiveUsersWidget projectId={projectId} config={widget.config} />;
    default:
      return (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Unknown widget type: {widget.widget_type}
        </div>
      );
  }
}
