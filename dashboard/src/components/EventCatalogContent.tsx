import { useState, useEffect } from "react";
import { useParams } from "react-router";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { useEventCatalog, useEventProperties } from "@/hooks/use-event-catalog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Search, Loader2, List } from "lucide-react";
import { useTableParams } from "@/hooks/use-table-params";
import { formatDate, formatNumber } from "@/lib/utils";
import type { ColumnDef, Row } from "@tanstack/react-table";
import type { CatalogEvent } from "@/lib/api";

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const typeBadgeVariant: Record<string, "default" | "secondary" | "outline"> = {
  track: "default",
  screen: "secondary",
  identify: "outline",
};

function PropertyList({
  projectId,
  eventName,
  environment,
}: {
  projectId: string;
  eventName: string;
  environment?: string;
}) {
  const { data, isLoading } = useEventProperties(projectId, eventName, environment);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 px-4 text-sm text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading properties...
      </div>
    );
  }

  const properties = data?.properties ?? [];
  if (properties.length === 0) {
    return (
      <div className="py-3 px-4 text-sm text-muted-foreground">
        No properties recorded for this event.
      </div>
    );
  }

  return (
    <div className="py-2 px-4">
      <div className="text-xs font-medium text-muted-foreground mb-2">
        Property Keys ({properties.length})
      </div>
      <div className="flex flex-wrap gap-1.5">
        {properties.map((p) => (
          <Badge key={p.property_key} variant="outline" className="text-xs font-mono">
            {p.property_key}
          </Badge>
        ))}
      </div>
    </div>
  );
}

const columns: ColumnDef<CatalogEvent, unknown>[] = [
  {
    accessorKey: "event_name",
    header: "Event Name",
    cell: ({ row }) => (
      <span className="font-mono text-sm">{row.original.event_name}</span>
    ),
  },
  {
    id: "event_type",
    header: "Type",
    cell: ({ row }) => (
      <Badge variant={typeBadgeVariant[row.original.event_type] ?? "secondary"}>
        {row.original.event_type}
      </Badge>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "event_count",
    header: "Count",
    cell: ({ row }) => (
      <span className="tabular-nums text-sm">
        {formatNumber(row.original.event_count)}
      </span>
    ),
    meta: { className: "text-right" },
  },
  {
    accessorKey: "first_seen",
    header: "First Seen",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatDate(row.original.first_seen)}
      </span>
    ),
  },
  {
    accessorKey: "last_seen",
    header: "Last Seen",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatDate(row.original.last_seen)}
      </span>
    ),
  },
];

export function EventCatalogContent() {
  const { id } = useParams<{ id: string }>();
  const { environment } = useEnvironment();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const {
    sorting,
    onSortingChange,
    page,
    pageSize,
    onPageChange,
    sortParam,
    orderParam,
  } = useTableParams({
    defaultSortField: "event_count",
    defaultSortOrder: "desc",
    pageSize: 25,
  });

  // Reset page when search changes
  useEffect(() => {
    onPageChange(1);
  }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading } = useEventCatalog(id, {
    q: debouncedSearch || undefined,
    environment,
    page,
    per_page: pageSize,
    sort_by: sortParam,
    sort_order: orderParam,
  });

  const events = data?.data ?? [];
  const hasMore = data?.meta?.has_more ?? false;

  const renderCatalogSubRow = (row: Row<CatalogEvent>) => {
    if (!id) return null;
    return (
      <div className="border-t bg-muted/30">
        <PropertyList
          projectId={id}
          eventName={row.original.event_name}
          environment={environment}
        />
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search events..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

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
        renderSubRow={renderCatalogSubRow}
        emptyState={
          <EmptyState
            variant={debouncedSearch ? "search" : "data"}
            icon={List}
            title={debouncedSearch ? "No events match your search" : "No events recorded yet"}
            description={
              debouncedSearch
                ? "Try adjusting your search query"
                : "Events will appear here once they are tracked"
            }
            compact
          />
        }
      />
    </div>
  );
}
