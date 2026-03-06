import { useState, useEffect } from "react";
import type { LiveEvent } from "@/lib/api";
import { cn, formatRelativeShort } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";
import { motion } from "motion/react";

// ── Color mapping ───────────────────────────────────────────────────

const dotColors: Record<string, string> = {
  track: "bg-blue-500",
  identify: "bg-green-500",
  screen: "bg-amber-500",
};

const lineColors: Record<string, string> = {
  track: "border-blue-500/30",
  identify: "border-green-500/30",
  screen: "border-amber-500/30",
};

function badgeVariant(type: string) {
  switch (type) {
    case "track":
      return "default" as const;
    case "identify":
      return "success" as const;
    case "screen":
      return "warning" as const;
    default:
      return "secondary" as const;
  }
}

function userIdentifier(event: LiveEvent): string {
  if (event.user_id) return event.user_id;
  if (event.email) return event.email;
  if (event.mobile_number) return event.mobile_number;
  return event.anonymous_id.slice(0, 12) + "...";
}

// ── Component ───────────────────────────────────────────────────────

interface LiveEventRowProps {
  event: LiveEvent;
  isLast: boolean;
  onSelect: (event: LiveEvent) => void;
}

export function LiveEventRow({ event, isLast, onSelect }: LiveEventRowProps) {
  const [relTime, setRelTime] = useState(() =>
    formatRelativeShort(event.server_timestamp),
  );
  const [expanded, setExpanded] = useState(false);

  // Auto-update relative timestamp every 5s
  useEffect(() => {
    const interval = setInterval(() => {
      setRelTime(formatRelativeShort(event.server_timestamp));
    }, 5000);
    return () => clearInterval(interval);
  }, [event.server_timestamp]);

  const dotColor = dotColors[event.event_type] ?? "bg-gray-400";
  const lineColor = lineColors[event.event_type] ?? "border-gray-300";

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="relative flex gap-4"
    >
      {/* Timeline rail */}
      <div className="flex flex-col items-center pt-1.5">
        <div className={cn("h-2.5 w-2.5 shrink-0 rounded-full", dotColor)} />
        {!isLast && (
          <div
            className={cn("w-px flex-1 border-l-2", lineColor)}
            style={{ minHeight: 32 }}
          />
        )}
      </div>

      {/* Event card */}
      <div className="flex-1 pb-4">
        <div
          className={cn(
            "group cursor-pointer rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50",
          )}
          onClick={() => onSelect(event)}
        >
          {/* Top row: time + type badge + name */}
          <div className="flex items-center gap-2 text-sm">
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {relTime}
            </span>
            <Badge
              variant={badgeVariant(event.event_type)}
              className="shrink-0"
            >
              {event.event_type}
            </Badge>
            <span className="truncate font-medium">{event.event_name}</span>
            {event.platform && (
              <Badge variant="outline" className="shrink-0 text-xs">
                {event.platform}
              </Badge>
            )}
            <span className="ml-auto shrink-0 truncate text-xs text-muted-foreground max-w-[180px]">
              {userIdentifier(event)}
            </span>
          </div>

          {/* Expand toggle */}
          <button
            type="button"
            className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            Properties
          </button>

          {/* Expanded properties */}
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(
                  JSON.parse(event.properties || "{}"),
                  null,
                  2,
                )}
              </pre>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
