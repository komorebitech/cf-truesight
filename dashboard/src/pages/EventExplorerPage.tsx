import { useState, useEffect } from "react";
import { useParams } from "react-router";
import { useEvents } from "@/hooks/use-events";
import { useEventTypeBreakdown } from "@/hooks/use-stats";
import { Header } from "@/components/Header";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { TimeRangeSelector, getPresetRange } from "@/components/TimeRangeSelector";
import type { TimeRange } from "@/components/TimeRangeSelector";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Search, RotateCcw, Activity } from "lucide-react";
import { useTableParams } from "@/hooks/use-table-params";
import { formatDate, cleanProperties } from "@/lib/utils";
import type { ColumnDef, Row } from "@tanstack/react-table";
import type { EventFilters, TrackedEvent } from "@/lib/api";

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
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

const columns: ColumnDef<TrackedEvent, unknown>[] = [
  {
    accessorKey: "event_name",
    header: "Event Name",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.event_name}</span>
    ),
  },
  {
    accessorKey: "event_type",
    header: "Type",
    cell: ({ row }) => (
      <Badge variant={EventTypeColor(row.original.event_type)}>
        {row.original.event_type}
      </Badge>
    ),
  },
  {
    id: "platform",
    header: "Platform",
    cell: ({ row }) =>
      row.original.platform ? (
        <Badge variant="outline" className="text-xs">
          {row.original.platform}
        </Badge>
      ) : null,
    enableSorting: false,
  },
  {
    id: "anonymous_id",
    header: "Anonymous ID",
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.original.anonymous_id.slice(0, 12)}...
      </span>
    ),
    enableSorting: false,
  },
  {
    id: "user_id",
    header: "User ID",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.user_id || "-"}
      </span>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "client_timestamp",
    header: "Timestamp",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDate(row.original.client_timestamp)}
      </span>
    ),
  },
];

function renderEventSubRow(row: Row<TrackedEvent>) {
  const event = row.original;
  return (
    <div className="border-t bg-muted/30 px-6 py-4">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
        <DetailField label="Event Name">
          <span className="font-medium">{event.event_name}</span>
        </DetailField>
        <DetailField label="Type">
          <Badge variant={EventTypeColor(event.event_type)}>
            {event.event_type}
          </Badge>
        </DetailField>
        <DetailField label="Anonymous ID">
          <span className="font-mono text-xs">{event.anonymous_id}</span>
        </DetailField>
        {event.user_id && (
          <DetailField label="User ID">{event.user_id}</DetailField>
        )}
        {event.platform && (
          <DetailField label="Platform">{event.platform}</DetailField>
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
          <DetailField label="Device">{event.device_model}</DetailField>
        )}
        {event.sdk_version && (
          <DetailField label="SDK Version">
            <span className="font-mono text-xs">{event.sdk_version}</span>
          </DetailField>
        )}
      </dl>
      <div className="mt-3">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Properties
        </span>
        <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
          {JSON.stringify(
            cleanProperties(JSON.parse(event.properties || "{}")),
            null,
            2,
          )}
        </pre>
      </div>
    </div>
  );
}

export function EventExplorerPage() {
  const { id } = useParams<{ id: string }>();
  const { environment } = useEnvironment();

  const [timeRange, setTimeRange] = useState<TimeRange>(() => getPresetRange("7d"));
  const [eventType, setEventType] = useState("");
  const [platform, setPlatform] = useState("");
  const [eventName, setEventName] = useState("");
  const [userId, setUserId] = useState("");

  const debouncedEventName = useDebouncedValue(eventName, 300);
  const debouncedUserId = useDebouncedValue(userId, 300);

  const {
    sorting,
    onSortingChange,
    page,
    pageSize,
    onPageChange,
    sortParam,
    orderParam,
  } = useTableParams({
    defaultSortField: "client_timestamp",
    defaultSortOrder: "desc",
    pageSize: 25,
  });

  // Reset page when filters change
  useEffect(() => {
    onPageChange(1);
  }, [debouncedEventName, debouncedUserId, eventType, platform, timeRange]); // eslint-disable-line react-hooks/exhaustive-deps

  const filters: EventFilters = {
    from: timeRange.from,
    to: timeRange.to,
    event_type: eventType || undefined,
    platform: platform || undefined,
    event_name: debouncedEventName || undefined,
    user_id: debouncedUserId || undefined,
    environment,
    page,
    per_page: pageSize,
    sort_by: sortParam,
    sort_order: orderParam,
  };

  const { data, isLoading } = useEvents(id, filters);
  const { data: breakdownData } = useEventTypeBreakdown(id, timeRange.from, timeRange.to, environment);

  const events = data?.data ?? [];
  const hasMore = data?.meta?.has_more ?? false;

  const eventTypes = breakdownData?.by_type
    ? Object.keys(breakdownData.by_type)
    : [];

  const handleReset = () => {
    setTimeRange(getPresetRange("7d"));
    setEventType("");
    setPlatform("");
    setEventName("");
    setUserId("");
    onPageChange(1);
  };

  return (
    <div className="flex flex-1 flex-col">
      <Header title="Event Explorer" />

      <div className="flex-1 p-6">
        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <TimeRangeSelector
            value={timeRange}
            onChange={(range) => {
              setTimeRange(range);
              onPageChange(1);
            }}
          />

          <div className="h-6 w-px bg-border" />

          <Select value={eventType || "__all__"} onValueChange={(v) => { setEventType(v === "__all__" ? "" : v); onPageChange(1); }}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All types</SelectItem>
              {eventTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={platform || "__all__"} onValueChange={(v) => { setPlatform(v === "__all__" ? "" : v); onPageChange(1); }}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All platforms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All platforms</SelectItem>
              <SelectItem value="web">Web</SelectItem>
              <SelectItem value="android">Android</SelectItem>
              <SelectItem value="ios">iOS</SelectItem>
              <SelectItem value="server">Server</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="Search events..."
              className="w-44 pl-8"
            />
          </div>

          <Input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Filter by user..."
            className="w-40"
          />

          <Button
            variant="ghost"
            size="icon"
            onClick={handleReset}
            title="Reset filters"
            className="shrink-0"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* Events table */}
        <DataTable
          columns={columns}
          data={events}
          sorting={sorting}
          onSortingChange={onSortingChange}
          pagination={{
            page,
            pageSize,
            hasMore,
          }}
          onPageChange={onPageChange}
          isLoading={isLoading}
          renderSubRow={renderEventSubRow}
          emptyState={
            <EmptyState
              variant="search"
              icon={Activity}
              title="No events found"
              description="Try adjusting your filters"
              compact
            />
          }
        />
      </div>
    </div>
  );
}
