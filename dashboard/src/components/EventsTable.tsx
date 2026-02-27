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
import { ChevronDown, ChevronRight, ChevronLeft, X } from "lucide-react";

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
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-gray-500">
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
          {events.map((event) => (
            <>
              <TableRow
                key={event.event_id}
                className="cursor-pointer"
                onClick={() => {
                  setExpandedId(
                    expandedId === event.event_id ? null : event.event_id,
                  );
                  setDrawerEvent(event);
                }}
              >
                <TableCell className="w-8 pr-0">
                  {expandedId === event.event_id ? (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
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
                <TableCell className="font-mono text-xs text-gray-500">
                  {event.anonymous_id.slice(0, 12)}...
                </TableCell>
                <TableCell className="text-gray-500">
                  {event.user_id || "-"}
                </TableCell>
                <TableCell className="text-gray-500">
                  {formatDate(event.client_timestamp)}
                </TableCell>
              </TableRow>
              {expandedId === event.event_id && (
                <TableRow key={`${event.event_id}-expanded`}>
                  <TableCell colSpan={6} className="bg-gray-50 p-0">
                    <pre className="max-h-64 overflow-auto p-4 text-xs text-gray-700">
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
      <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
        <p className="text-sm text-gray-500">
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
          <span className="text-sm text-gray-600">
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
      {drawerEvent && expandedId === drawerEvent.event_id && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-gray-200 bg-white shadow-xl lg:max-w-lg">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h3 className="text-lg font-semibold">Event Detail</h3>
            <button
              onClick={() => {
                setDrawerEvent(null);
                setExpandedId(null);
              }}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="overflow-auto p-6" style={{ height: "calc(100vh - 65px)" }}>
            <dl className="space-y-4">
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">
                  Event Name
                </dt>
                <dd className="mt-1 text-sm font-medium">
                  {drawerEvent.event_name}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">
                  Type
                </dt>
                <dd className="mt-1">
                  <Badge variant={EventTypeColor(drawerEvent.event_type)}>
                    {drawerEvent.event_type}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">
                  Anonymous ID
                </dt>
                <dd className="mt-1 font-mono text-sm text-gray-600">
                  {drawerEvent.anonymous_id}
                </dd>
              </div>
              {drawerEvent.user_id && (
                <div>
                  <dt className="text-xs font-medium uppercase text-gray-500">
                    User ID
                  </dt>
                  <dd className="mt-1 text-sm text-gray-600">
                    {drawerEvent.user_id}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">
                  Timestamp
                </dt>
                <dd className="mt-1 text-sm text-gray-600">
                  {formatDate(drawerEvent.client_timestamp)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">
                  Received At
                </dt>
                <dd className="mt-1 text-sm text-gray-600">
                  {formatDate(drawerEvent.server_timestamp)}
                </dd>
              </div>
              <div>
                <dt className="mb-2 text-xs font-medium uppercase text-gray-500">
                  Properties
                </dt>
                <dd>
                  <pre className="rounded-md bg-gray-50 p-4 text-xs text-gray-700 overflow-auto">
                    {JSON.stringify(JSON.parse(drawerEvent.properties || "{}"), null, 2)}
                  </pre>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
