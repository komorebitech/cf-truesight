import { useState } from "react";
import type { TrackedEvent } from "@/lib/api";
import { formatDate } from "@/lib/utils";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ChevronDown, ChevronRight, ChevronLeft } from "lucide-react";
import { motion } from "motion/react";

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

export function EventsTable({
  events,
  isLoading,
  page,
  hasMore,
  onPageChange,
}: EventsTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drawerEvent, setDrawerEvent] = useState<TrackedEvent | null>(null);

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
            <TableHead>Anonymous ID</TableHead>
            <TableHead>User ID</TableHead>
            <TableHead>Timestamp</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event, i) => (
            <>
              <motion.tr
                key={event.event_id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: i * 0.02 }}
                className="cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/50"
                onClick={() => {
                  setExpandedId(
                    expandedId === event.event_id ? null : event.event_id,
                  );
                  setDrawerEvent(event);
                }}
              >
                <TableCell className="w-8 pr-0">
                  {expandedId === event.event_id ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  {event.event_name}
                </TableCell>
                <TableCell>
                  <Badge variant={EventTypeColor(event.event_type)}>
                    {event.event_type}
                  </Badge>
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
              {expandedId === event.event_id && (
                <TableRow key={`${event.event_id}-expanded`}>
                  <TableCell colSpan={6} className="bg-muted p-0">
                    <pre className="max-h-64 overflow-auto p-4 text-xs">
                      {JSON.stringify(JSON.parse(event.properties || "{}"), null, 2)}
                    </pre>
                  </TableCell>
                </TableRow>
              )}
            </>
          ))}
        </TableBody>
      </Table>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Page {page} &middot; {events.length} event{events.length !== 1 ? "s" : ""}
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
          <span className="text-sm text-muted-foreground">
            Page {page}
          </span>
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

      {/* Side drawer for event detail */}
      <Sheet
        open={!!drawerEvent && expandedId === drawerEvent?.event_id}
        onOpenChange={(open) => {
          if (!open) {
            setDrawerEvent(null);
            setExpandedId(null);
          }
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Event Detail</SheetTitle>
            <SheetDescription>Detailed event information</SheetDescription>
          </SheetHeader>
          {drawerEvent && (
            <div className="mt-6 overflow-auto" style={{ height: "calc(100vh - 140px)" }}>
              <dl className="space-y-4">
                <div>
                  <dt className="text-xs font-medium uppercase text-muted-foreground">
                    Event Name
                  </dt>
                  <dd className="mt-1 text-sm font-medium">
                    {drawerEvent.event_name}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-muted-foreground">
                    Type
                  </dt>
                  <dd className="mt-1">
                    <Badge variant={EventTypeColor(drawerEvent.event_type)}>
                      {drawerEvent.event_type}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-muted-foreground">
                    Anonymous ID
                  </dt>
                  <dd className="mt-1 font-mono text-sm text-muted-foreground">
                    {drawerEvent.anonymous_id}
                  </dd>
                </div>
                {drawerEvent.user_id && (
                  <div>
                    <dt className="text-xs font-medium uppercase text-muted-foreground">
                      User ID
                    </dt>
                    <dd className="mt-1 text-sm text-muted-foreground">
                      {drawerEvent.user_id}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs font-medium uppercase text-muted-foreground">
                    Timestamp
                  </dt>
                  <dd className="mt-1 text-sm text-muted-foreground">
                    {formatDate(drawerEvent.client_timestamp)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-muted-foreground">
                    Received At
                  </dt>
                  <dd className="mt-1 text-sm text-muted-foreground">
                    {formatDate(drawerEvent.server_timestamp)}
                  </dd>
                </div>
                <div>
                  <dt className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                    Properties
                  </dt>
                  <dd>
                    <pre className="rounded-md bg-muted p-4 text-xs overflow-auto">
                      {JSON.stringify(JSON.parse(drawerEvent.properties || "{}"), null, 2)}
                    </pre>
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
