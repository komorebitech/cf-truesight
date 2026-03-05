import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router";
import { useEvents } from "@/hooks/use-events";
import { useEventTypeBreakdown } from "@/hooks/use-stats";
import { Header } from "@/components/Header";
import { EnvironmentSelector } from "@/components/EnvironmentSelector";
import { TimeRangeSelector, getPresetRange } from "@/components/TimeRangeSelector";
import type { TimeRange } from "@/components/TimeRangeSelector";
import { EventsTable } from "@/components/EventsTable";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, RotateCcw } from "lucide-react";
import type { EventFilters } from "@/lib/api";

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const PAGE_SIZE = 25;

export function EventExplorerPage() {
  const { id } = useParams<{ id: string }>();

  const [searchParams, setSearchParams] = useSearchParams();
  const environment = (searchParams.get("env") as "live" | "test") || "live";
  const setEnvironment = (env: "live" | "test") => {
    setSearchParams((prev) => {
      if (env === "live") { prev.delete("env"); } else { prev.set("env", env); }
      return prev;
    });
  };

  const [timeRange, setTimeRange] = useState<TimeRange>(() => getPresetRange("7d"));
  const [eventType, setEventType] = useState("");
  const [eventName, setEventName] = useState("");
  const [userId, setUserId] = useState("");
  const [page, setPage] = useState(1);

  const debouncedEventName = useDebouncedValue(eventName, 300);
  const debouncedUserId = useDebouncedValue(userId, 300);

  const filters: EventFilters = {
    from: timeRange.from,
    to: timeRange.to,
    event_type: eventType || undefined,
    event_name: debouncedEventName || undefined,
    user_id: debouncedUserId || undefined,
    environment,
    page,
    per_page: PAGE_SIZE,
  };

  const { data, isLoading } = useEvents(id, filters);
  const { data: breakdownData } = useEventTypeBreakdown(id, timeRange.from, timeRange.to, environment);

  const eventTypes = breakdownData?.by_type
    ? Object.keys(breakdownData.by_type)
    : [];

  const handleReset = () => {
    setTimeRange(getPresetRange("7d"));
    setEventType("");
    setEventName("");
    setUserId("");
    setPage(1);
  };

  return (
    <div className="flex flex-1 flex-col">
      <Header title="Event Explorer" />

      <div className="flex-1 p-6">
        {/* Filters */}
        <div className="mb-6 rounded-lg border bg-card p-4">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <EnvironmentSelector value={environment} onChange={setEnvironment} />
            <TimeRangeSelector
              value={timeRange}
              onChange={(range) => {
                setTimeRange(range);
                setPage(1);
              }}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Event Type
              </label>
              <Select
                value={eventType}
                onChange={(e) => {
                  setEventType(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All types</option>
                {eventTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Event Name
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={eventName}
                  onChange={(e) => {
                    setEventName(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search events..."
                  className="pl-8"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                User ID
              </label>
              <div className="flex gap-2">
                <Input
                  value={userId}
                  onChange={(e) => {
                    setUserId(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Filter by user..."
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleReset}
                  title="Reset filters"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Events table */}
        <div className="rounded-lg border bg-card">
          <EventsTable
            events={data?.data}
            isLoading={isLoading}
            page={page}
            hasMore={data?.meta?.has_more ?? false}
            onPageChange={setPage}
          />
        </div>
      </div>
    </div>
  );
}
