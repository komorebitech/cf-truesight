import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router";
import { useLiveEvents } from "@/hooks/use-live-events";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { LiveEventRow } from "@/components/LiveEventRow";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Radio, Pause, Play, RotateCcw, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import type { LiveEventStreamFilters } from "@/lib/api";

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function LiveEventsContent() {
  const { id } = useParams<{ id: string }>();
  const { environment } = useEnvironment();

  // Filter state
  const [eventType, setEventType] = useState("");
  const [platform, setPlatform] = useState("");
  const [eventName, setEventName] = useState("");
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");

  // Debounced values
  const debouncedEventName = useDebouncedValue(eventName, 500);
  const debouncedUserId = useDebouncedValue(userId, 500);
  const debouncedEmail = useDebouncedValue(email, 500);
  const debouncedMobile = useDebouncedValue(mobileNumber, 500);

  const filters: LiveEventStreamFilters = {
    environment,
    event_type: eventType || undefined,
    platform: platform || undefined,
    event_name: debouncedEventName || undefined,
    user_id: debouncedUserId || undefined,
    email: debouncedEmail || undefined,
    mobile_number: debouncedMobile || undefined,
  };

  const {
    events,
    isConnected,
    isPaused,
    error,
    bufferedCount,
    pause,
    resume,
    clear,
  } = useLiveEvents(id, filters);

  // Expanded cards (multiple allowed)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const handleToggleExpand = useCallback((eventId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }, []);

  const handleReset = () => {
    setEventType("");
    setPlatform("");
    setEventName("");
    setUserId("");
    setEmail("");
    setMobileNumber("");
  };

  return (
    <>
      {/* Status bar */}
      <div className="mb-4 flex items-center gap-3">
        {/* Connection indicator */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm font-medium",
              isPaused
                ? "text-amber-600 dark:text-amber-400"
                : isConnected
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400",
            )}
          >
            {isPaused ? "Paused" : isConnected ? "Live" : "Disconnected"}
          </span>
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Pause/Resume */}
        <Button
          variant="outline"
          size="sm"
          onClick={isPaused ? resume : pause}
          className="gap-1.5"
        >
          {isPaused ? (
            <>
              <Play className="h-3.5 w-3.5" />
              Resume
              {bufferedCount > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {bufferedCount} new
                </Badge>
              )}
            </>
          ) : (
            <>
              <Pause className="h-3.5 w-3.5" />
              Pause
            </>
          )}
        </Button>

        {/* Clear */}
        <Button
          variant="ghost"
          size="sm"
          onClick={clear}
          className="gap-1.5 text-muted-foreground"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear
        </Button>

        {/* Connection error */}
        {error && !isConnected && (
          <span className="text-sm text-destructive">
            Connection lost
          </span>
        )}

        {/* Event count */}
        <motion.span
          key={events.length}
          initial={{ opacity: 0.5, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="ml-auto text-sm tabular-nums text-muted-foreground"
        >
          {events.length} event{events.length !== 1 ? "s" : ""}
        </motion.span>
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={eventType || "__all__"} onValueChange={(v) => setEventType(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All types</SelectItem>
            <SelectItem value="track">track</SelectItem>
            <SelectItem value="identify">identify</SelectItem>
            <SelectItem value="screen">screen</SelectItem>
          </SelectContent>
        </Select>

        <Select value={platform || "__all__"} onValueChange={(v) => setPlatform(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-32">
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

        <Input
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
          placeholder="Event name..."
          className="w-40"
        />

        <Input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="User ID..."
          className="w-36"
        />

        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email..."
          className="w-40"
        />

        <Input
          value={mobileNumber}
          onChange={(e) => setMobileNumber(e.target.value)}
          placeholder="Mobile..."
          className="w-36"
        />

        <Button
          variant="ghost"
          size="icon"
          onClick={handleReset}
          aria-label="Reset filters"
          title="Reset filters"
          className="shrink-0"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Event timeline */}
      <div className="flex-1 overflow-auto rounded-lg border bg-card">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            {/* Radar pulse — concentric rings radiate outward */}
            <div className="relative mb-5 flex h-20 w-20 items-center justify-center">
              {isConnected && !isPaused && (
                <>
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="absolute inset-0 rounded-full border border-primary/20"
                      initial={{ scale: 0.3, opacity: 0.6 }}
                      animate={{ scale: 1.2, opacity: 0 }}
                      transition={{
                        duration: 2.4,
                        delay: i * 0.8,
                        repeat: Infinity,
                        ease: "easeOut",
                      }}
                    />
                  ))}
                </>
              )}
              <Radio className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium">
              {isPaused ? "Stream paused" : isConnected ? "Listening for events..." : "Reconnecting..."}
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              {isPaused ? "Hit resume to start receiving events" : "Events will appear here the moment they arrive"}
            </p>
          </div>
        ) : (
          <div className="p-4">
            {events.map((event, i) => (
              <LiveEventRow
                key={event.event_id}
                event={event}
                isLast={i === events.length - 1}
                expanded={expandedIds.has(event.event_id)}
                onToggleExpand={handleToggleExpand}
              />
            ))}
          </div>
        )}
      </div>

    </>
  );
}
