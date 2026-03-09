import { useState, useEffect } from "react";
import { useParams } from "react-router";
import { PageLayout } from "@/components/PageLayout";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { useEventCatalog, useEventProperties } from "@/hooks/use-event-catalog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, ChevronRight, ChevronDown, Loader2 } from "lucide-react";

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

export function EventCatalogPage() {
  const { id } = useParams<{ id: string }>();
  const { environment } = useEnvironment();
  const [search, setSearch] = useState("");
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search, 300);

  const { data, isLoading } = useEventCatalog(id, {
    q: debouncedSearch || undefined,
    environment,
  });
  const events = data?.data ?? [];

  const toggleExpand = (key: string) => {
    setExpandedEvent((prev) => (prev === key ? null : key));
  };

  return (
    <PageLayout title="Event Catalog">
        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Event Name</TableHead>
                <TableHead className="w-28">Type</TableHead>
                <TableHead className="w-28 pr-4 text-right">Count</TableHead>
                <TableHead className="w-48">First Seen</TableHead>
                <TableHead className="w-48">Last Seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : events.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-muted-foreground"
                  >
                    {search ? "No events match your search." : "No events recorded yet."}
                  </TableCell>
                </TableRow>
              ) : (
                events.map((ev) => {
                  const key = `${ev.event_name}::${ev.event_type}`;
                  const isExpanded = expandedEvent === key;
                  return (
                    <TableRow key={key} className="group">
                      <TableCell colSpan={6} className="p-0">
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() => toggleExpand(key)}
                        >
                          <div className="flex items-center px-4 py-3 hover:bg-muted/50 transition-colors">
                            <div className="w-8 flex-shrink-0">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 font-mono text-sm">
                              {ev.event_name}
                            </div>
                            <div className="w-28">
                              <Badge
                                variant={typeBadgeVariant[ev.event_type] ?? "secondary"}
                              >
                                {ev.event_type}
                              </Badge>
                            </div>
                            <div className="w-28 pr-4 text-right tabular-nums text-sm">
                              {formatCount(ev.event_count)}
                            </div>
                            <div className="w-48 text-sm text-muted-foreground">
                              {formatDate(ev.first_seen)}
                            </div>
                            <div className="w-48 text-sm text-muted-foreground">
                              {formatDate(ev.last_seen)}
                            </div>
                          </div>
                        </button>
                        {isExpanded && id && (
                          <div className="border-t bg-muted/30">
                            <PropertyList
                              projectId={id}
                              eventName={ev.event_name}
                              environment={environment}
                            />
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
    </PageLayout>
  );
}
