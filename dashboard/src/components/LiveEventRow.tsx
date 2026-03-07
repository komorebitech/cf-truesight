import { useState, useEffect } from "react";
import type { LiveEvent } from "@/lib/api";
import { cn, formatRelativeShort, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

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

// ── Detail field ────────────────────────────────────────────────────

function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm">{children}</dd>
    </div>
  );
}

// ── Component ───────────────────────────────────────────────────────

interface LiveEventRowProps {
  event: LiveEvent;
  isLast: boolean;
  expanded: boolean;
  onToggleExpand: (eventId: string) => void;
}

export function LiveEventRow({
  event,
  isLast,
  expanded,
  onToggleExpand,
}: LiveEventRowProps) {
  const [relTime, setRelTime] = useState(() =>
    formatRelativeShort(event.server_timestamp),
  );

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
            expanded && "bg-muted/30",
          )}
          onClick={() => onToggleExpand(event.event_id)}
        >
          {/* Top row: time + type badge + name + expand chevron */}
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
            <motion.div
              animate={{ rotate: expanded ? 90 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </motion.div>
          </div>

          {/* Expanded detail panel */}
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden"
              >
                <div className="mt-3 border-t pt-3">
                  {/* Metadata grid */}
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
                    <DetailField label="Event Name">
                      <span className="font-medium">{event.event_name}</span>
                    </DetailField>

                    <DetailField label="Type">
                      <Badge variant={badgeVariant(event.event_type)}>
                        {event.event_type}
                      </Badge>
                    </DetailField>

                    {event.user_id && (
                      <DetailField label="User ID">
                        {event.user_id}
                      </DetailField>
                    )}

                    <DetailField label="Anonymous ID">
                      <span className="font-mono text-xs">
                        {event.anonymous_id}
                      </span>
                    </DetailField>

                    {event.email && (
                      <DetailField label="Email">{event.email}</DetailField>
                    )}

                    {event.mobile_number && (
                      <DetailField label="Mobile">
                        {event.mobile_number}
                      </DetailField>
                    )}

                    <DetailField label="Client Time">
                      {formatDate(event.client_timestamp)}
                    </DetailField>

                    <DetailField label="Server Time">
                      {formatDate(event.server_timestamp)}
                    </DetailField>

                    {event.os_name && (
                      <DetailField label="OS">{event.os_name}</DetailField>
                    )}

                    {event.device_model && (
                      <DetailField label="Device">
                        {event.device_model}
                      </DetailField>
                    )}

                    {event.sdk_version && (
                      <DetailField label="SDK Version">
                        <span className="font-mono text-xs">
                          {event.sdk_version}
                        </span>
                      </DetailField>
                    )}
                  </dl>

                  {/* Properties */}
                  <div className="mt-3">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Properties
                    </span>
                    <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
                      {JSON.stringify(
                        JSON.parse(event.properties || "{}"),
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
