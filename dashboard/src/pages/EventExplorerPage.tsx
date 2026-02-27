import { useState, useMemo } from "react";
import { useParams } from "react-router";
import { subDays, formatISO } from "date-fns";
import { useEvents } from "@/hooks/use-events";
import { useEventTypeBreakdown } from "@/hooks/use-stats";
import { Header } from "@/components/Header";
import { EventsTable } from "@/components/EventsTable";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, RotateCcw } from "lucide-react";
import type { EventFilters } from "@/lib/api";

const PAGE_SIZE = 25;

export function EventExplorerPage() {
  const { id } = useParams<{ id: string }>();

  // Default date range: last 7 days
  const defaultFrom = useMemo(() => formatISO(subDays(new Date(), 7)), []);
  const defaultTo = useMemo(() => formatISO(new Date()), []);

  // Filter state
  const [from, setFrom] = useState(defaultFrom.slice(0, 16)); // datetime-local format
  const [to, setTo] = useState(defaultTo.slice(0, 16));
  const [eventType, setEventType] = useState("");
  const [eventName, setEventName] = useState("");
  const [userId, setUserId] = useState("");
  const [page, setPage] = useState(1);

  // Build filters
  const filters: EventFilters = {
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(to).toISOString() : undefined,
    event_type: eventType || undefined,
    event_name: eventName || undefined,
    user_id: userId || undefined,
    page,
    per_page: PAGE_SIZE,
  };

  const { data, isLoading } = useEvents(id, filters);
  const { data: breakdownData } = useEventTypeBreakdown(id);

  const eventTypes = breakdownData?.by_type
    ? Object.keys(breakdownData.by_type)
    : [];

  const handleReset = () => {
    setFrom(defaultFrom.slice(0, 16));
    setTo(defaultTo.slice(0, 16));
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
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                From
              </label>
              <Input
                type="datetime-local"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                To
              </label>
              <Input
                type="datetime-local"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
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
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Event Name
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
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
              <label className="mb-1 block text-xs font-medium text-gray-500">
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
        <div className="rounded-lg border border-gray-200 bg-white">
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
