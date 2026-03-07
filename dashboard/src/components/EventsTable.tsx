import { useState } from "react";
import type { TrackedEvent } from "@/lib/api";
import { formatDate, cleanProperties } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface EventsTableProps {
  events: TrackedEvent[] | undefined;
  isLoading: boolean;
  page: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
}

function EventTypeColor(type: string) {
  switch (type) {
    case "track":
      return "default" as const;
    case "identify":
      return "success" as const;
    case "page":
      return "warning" as const;
    case "screen":
      return "secondary" as const;
    default:
      return "secondary" as const;
  }
}

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

export function EventsTable({
  events,
  isLoading,
  page,
  hasMore,
  onPageChange,
}: EventsTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (eventId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        No events found matching your filters.
      </div>
    );
  }

  return (
    <div className="relative">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Event Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Platform</TableHead>
            <TableHead>Anonymous ID</TableHead>
            <TableHead>User ID</TableHead>
            <TableHead>Timestamp</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event, i) => {
            const isExpanded = expandedIds.has(event.event_id);
            return (
              <>
                <motion.tr
                  key={event.event_id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, delay: i * 0.02 }}
                  className="cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/50"
                  onClick={() => toggleExpand(event.event_id)}
                >
                  <TableCell className="w-8 pr-0">
                    <motion.div
                      animate={{ rotate: isExpanded ? 90 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </motion.div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {event.event_name}
                  </TableCell>
                  <TableCell>
                    <Badge variant={EventTypeColor(event.event_type)}>
                      {event.event_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {event.platform ? (
                      <Badge variant="outline" className="text-xs">
                        {event.platform}
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {event.anonymous_id.slice(0, 12)}...
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {event.user_id || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(event.client_timestamp)}
                  </TableCell>
                </motion.tr>
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <tr key={`${event.event_id}-detail`}>
                      <TableCell colSpan={7} className="p-0">
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{
                            duration: 0.3,
                            ease: [0.4, 0, 0.2, 1],
                          }}
                          className="overflow-hidden"
                        >
                          <div className="border-t bg-muted/30 px-6 py-4">
                            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
                              <DetailField label="Event Name">
                                <span className="font-medium">
                                  {event.event_name}
                                </span>
                              </DetailField>

                              <DetailField label="Type">
                                <Badge
                                  variant={EventTypeColor(event.event_type)}
                                >
                                  {event.event_type}
                                </Badge>
                              </DetailField>

                              <DetailField label="Anonymous ID">
                                <span className="font-mono text-xs">
                                  {event.anonymous_id}
                                </span>
                              </DetailField>

                              {event.user_id && (
                                <DetailField label="User ID">
                                  {event.user_id}
                                </DetailField>
                              )}

                              {event.platform && (
                                <DetailField label="Platform">
                                  {event.platform}
                                </DetailField>
                              )}

                              <DetailField label="Client Time">
                                {formatDate(event.client_timestamp)}
                              </DetailField>

                              <DetailField label="Server Time">
                                {formatDate(event.server_timestamp)}
                              </DetailField>

                              {event.os_name && (
                                <DetailField label="OS">
                                  {event.os_name}
                                </DetailField>
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

                            <div className="mt-3">
                              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                Properties
                              </span>
                              <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
                                {JSON.stringify(
                                  cleanProperties(
                                    JSON.parse(event.properties || "{}"),
                                  ),
                                  null,
                                  2,
                                )}
                              </pre>
                            </div>
                          </div>
                        </motion.div>
                      </TableCell>
                    </tr>
                  )}
                </AnimatePresence>
              </>
            );
          })}
        </TableBody>
      </Table>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Page {page} &middot; {events.length} event
          {events.length !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasMore}
            onClick={() => onPageChange(page + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
