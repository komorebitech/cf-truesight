import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronsUpDown, Check, Search, X, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEventNameSearch } from "@/hooks/use-event-names";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatNumber } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Recent events — persisted per-project in localStorage
// ---------------------------------------------------------------------------

const RECENTS_KEY = "truesight_recent_events";
const MAX_RECENTS = 5;

interface RecentsMap {
  [projectId: string]: string[];
}

function getRecents(projectId: string): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const map: RecentsMap = JSON.parse(raw);
    return map[projectId] ?? [];
  } catch {
    return [];
  }
}

function addRecent(projectId: string, eventName: string) {
  if (!eventName) return;
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const map: RecentsMap = raw ? JSON.parse(raw) : {};
    const list = (map[projectId] ?? []).filter((n) => n !== eventName);
    list.unshift(eventName);
    map[projectId] = list.slice(0, MAX_RECENTS);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface EventComboboxProps {
  projectId: string | undefined;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Show an "All Events" / empty option */
  allowEmpty?: boolean;
  emptyLabel?: string;
  environment?: string;
  className?: string;
}

export function EventCombobox({
  projectId,
  value,
  onChange,
  placeholder = "Select event...",
  allowEmpty = false,
  emptyLabel = "All Events",
  environment,
  className,
}: EventComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [recents, setRecents] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(timer);
  }, [search]);

  // Load recents when popover opens
  useEffect(() => {
    if (open && projectId) {
      setRecents(getRecents(projectId));
    }
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    } else {
      setSearch("");
    }
  }, [open, projectId]);

  const { data, isFetching } = useEventNameSearch(
    projectId,
    debouncedSearch,
    environment,
  );

  const eventNames = data?.event_names ?? [];

  const handleSelect = useCallback(
    (eventName: string) => {
      onChange(eventName);
      if (projectId && eventName) {
        addRecent(projectId, eventName);
      }
      setOpen(false);
    },
    [onChange, projectId],
  );

  // Filter recents: only show when not searching, exclude current value from
  // recents, and exclude names already visible in search results
  const showRecents = !search && recents.length > 0;
  const searchResultNames = new Set(eventNames.map((e) => e.name));
  const visibleRecents = showRecents
    ? recents.filter((r) => r !== value)
    : [];

  // Shared item renderer
  const renderItem = (
    name: string,
    extra?: { count?: number; muted?: boolean },
  ) => (
    <button
      type="button"
      key={name}
      onClick={() => handleSelect(name)}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-muted",
        value === name && "bg-muted",
      )}
    >
      <Check
        className={cn(
          "mr-2 h-4 w-4 shrink-0",
          value === name ? "opacity-100" : "opacity-0",
        )}
      />
      <span className={cn("flex-1 truncate text-left", extra?.muted && "text-muted-foreground")}>
        {name}
      </span>
      {extra?.count !== undefined && (
        <span className="ml-2 shrink-0 text-xs tabular-nums text-muted-foreground">
          {formatNumber(extra.count)}
        </span>
      )}
    </button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal h-9",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          {value ? (
            <X
              className="h-3.5 w-3.5 shrink-0 opacity-50 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                if (allowEmpty) {
                  onChange("");
                }
              }}
            />
          ) : (
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        {/* Search input */}
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events..."
            className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          {isFetching && (
            <div className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          )}
        </div>

        {/* Results list */}
        <div className="max-h-[280px] overflow-y-auto p-1">
          {allowEmpty && (
            <button
              type="button"
              onClick={() => handleSelect("")}
              className={cn(
                "relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-muted",
                !value && "bg-muted",
              )}
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4 shrink-0",
                  !value ? "opacity-100" : "opacity-0",
                )}
              />
              <span className="text-muted-foreground">{emptyLabel}</span>
            </button>
          )}

          {/* Recent events section */}
          {visibleRecents.length > 0 && (
            <>
              <div className="flex items-center gap-1.5 px-2 pb-1 pt-2">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Recent
                </span>
              </div>
              {visibleRecents.map((name) => renderItem(name, { muted: !searchResultNames.has(name) }))}
              <div className="-mx-1 my-1 h-px bg-border" />
            </>
          )}

          {/* Search results */}
          {eventNames.length === 0 && !isFetching ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {search ? "No events found" : "No events available"}
            </div>
          ) : (
            <>
              {search && eventNames.length > 0 && visibleRecents.length > 0 && (
                <div className="px-2 pb-1 pt-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Results
                  </span>
                </div>
              )}
              {eventNames.map((event) =>
                renderItem(event.name, { count: event.count }),
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
