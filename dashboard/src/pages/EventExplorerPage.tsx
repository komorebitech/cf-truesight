import { useState, useEffect } from "react";
import { useParams } from "react-router";
import { useEvents } from "@/hooks/use-events";
import { useEventTypeBreakdown } from "@/hooks/use-stats";
import { Header } from "@/components/Header";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { TimeRangeSelector, getPresetRange } from "@/components/TimeRangeSelector";
import type { TimeRange } from "@/components/TimeRangeSelector";
import { EventsTable } from "@/components/EventsTable";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

  const { environment } = useEnvironment();

  const [timeRange, setTimeRange] = useState<TimeRange>(() => getPresetRange("7d"));
  const [eventType, setEventType] = useState("");
  const [platform, setPlatform] = useState("");
  const [eventName, setEventName] = useState("");
  const [userId, setUserId] = useState("");
  const [page, setPage] = useState(1);

  const debouncedEventName = useDebouncedValue(eventName, 300);
  const debouncedUserId = useDebouncedValue(userId, 300);

  const filters: EventFilters = {
    from: timeRange.from,
    to: timeRange.to,
    event_type: eventType || undefined,
    platform: platform || undefined,
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
    setPlatform("");
    setEventName("");
    setUserId("");
    setPage(1);
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
              setPage(1);
            }}
          />

          <div className="h-6 w-px bg-border" />

          <Select value={eventType || "__all__"} onValueChange={(v) => { setEventType(v === "__all__" ? "" : v); setPage(1); }}>
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

          <Select value={platform || "__all__"} onValueChange={(v) => { setPlatform(v === "__all__" ? "" : v); setPage(1); }}>
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
              onChange={(e) => {
                setEventName(e.target.value);
                setPage(1);
              }}
              placeholder="Search events..."
              className="w-44 pl-8"
            />
          </div>

          <Input
            value={userId}
            onChange={(e) => {
              setUserId(e.target.value);
              setPage(1);
            }}
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
