import { useState, useEffect, useRef, useCallback } from "react";
import type { LiveEvent, LiveEventStreamFilters } from "@/lib/api";
import { buildLiveEventsUrl } from "@/lib/api";

const MAX_EVENTS = 200;

interface UseLiveEventsReturn {
  events: LiveEvent[];
  isConnected: boolean;
  isPaused: boolean;
  error: string | null;
  bufferedCount: number;
  pause: () => void;
  resume: () => void;
  clear: () => void;
}

export function useLiveEvents(
  projectId: string | undefined,
  filters: LiveEventStreamFilters,
): UseLiveEventsReturn {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const bufferRef = useRef<LiveEvent[]>([]);
  const pausedRef = useRef(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Destructure filter primitives for stable dependency array
  const {
    environment,
    event_type,
    event_name,
    user_id,
    email,
    mobile_number,
  } = filters;

  // Clear events when filters change
  useEffect(() => {
    setEvents([]);
    bufferRef.current = [];
  }, [environment, event_type, event_name, user_id, email, mobile_number]);

  useEffect(() => {
    if (!projectId) return;

    const url = buildLiveEventsUrl(projectId, {
      environment,
      event_type,
      event_name,
      user_id,
      email,
      mobile_number,
    });

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    es.addEventListener("events", (e: MessageEvent) => {
      try {
        const newEvents: LiveEvent[] = JSON.parse(e.data);
        if (pausedRef.current) {
          bufferRef.current = [...newEvents, ...bufferRef.current].slice(
            0,
            MAX_EVENTS,
          );
        } else {
          setEvents((prev) =>
            [...newEvents.reverse(), ...prev].slice(0, MAX_EVENTS),
          );
        }
      } catch {
        // ignore parse errors
      }
    });

    es.addEventListener("heartbeat", () => {
      // noop — confirms connection is alive
    });

    es.addEventListener("error", () => {
      // EventSource fires generic error events on disconnect
    });

    es.onerror = () => {
      setIsConnected(false);
      setError("Connection lost. Reconnecting...");
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    };
  }, [projectId, environment, event_type, event_name, user_id, email, mobile_number]);

  const pause = useCallback(() => {
    pausedRef.current = true;
    setIsPaused(true);
    bufferRef.current = [];
  }, []);

  const resume = useCallback(() => {
    pausedRef.current = false;
    setIsPaused(false);
    // Flush buffer
    if (bufferRef.current.length > 0) {
      setEvents((prev) =>
        [...bufferRef.current.reverse(), ...prev].slice(0, MAX_EVENTS),
      );
      bufferRef.current = [];
    }
  }, []);

  const clear = useCallback(() => {
    setEvents([]);
    bufferRef.current = [];
  }, []);

  return {
    events,
    isConnected,
    isPaused,
    error,
    bufferedCount: isPaused ? bufferRef.current.length : 0,
    pause,
    resume,
    clear,
  };
}
