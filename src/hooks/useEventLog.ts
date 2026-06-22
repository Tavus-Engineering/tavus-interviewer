/**
 * useEventLog.ts
 *
 * Captures every CVI event that flows through the InteractionBus into a
 * timestamped, scrollable log for the Events Console tab of the developer
 * panel. `handleEvent` is added to the InteractionBus `handlers` array
 * alongside the objective/perception/guardrail handlers, so it sees the
 * authoritative `app-message` stream — we log whatever `event_type` actually
 * arrives (no hardcoded event taxonomy).
 *
 * Each logged entry retains the raw `properties` payload (so the console can
 * expand a row to its JSON + offer a per-row copy) plus a derived severity +
 * friendly label from `eventSeverity`.
 */

import { useCallback, useRef, useState } from "react";
import type { TavusEvent } from "@/types/events";
import { classifyEvent, type EventSeverity } from "@/lib/eventSeverity";

export interface LoggedEvent {
  /** Monotonic id — stable React key, independent of timestamp collisions. */
  id: number;
  /** Wall-clock time the event was seen, formatted HH:MM:SS.mmm. */
  time: string;
  /** The CVI event_type (falls back to message_type, then "unknown"). */
  type: string;
  /** Friendly label for the event_type. */
  label: string;
  /** Severity bucket used for row coloring. */
  severity: EventSeverity;
  /** Raw event payload (for the expandable JSON view + per-row copy). */
  properties: Record<string, unknown>;
}

/** Ring-buffer cap so a long call can't grow the log unbounded. */
const MAX_EVENTS = 500;

function formatTime(d: Date): string {
  const pad = (n: number, len = 2) => n.toString().padStart(len, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(
    d.getMilliseconds(),
    3
  )}`;
}

export function useEventLog() {
  const [events, setEvents] = useState<LoggedEvent[]>([]);
  const idRef = useRef(0);

  const handleEvent = useCallback((event: TavusEvent) => {
    const type =
      event?.event_type ||
      (event as unknown as { message_type?: string })?.message_type ||
      "unknown";
    const { label, severity } = classifyEvent(type);
    const properties =
      (event?.properties as Record<string, unknown> | undefined) ?? {};
    const time = formatTime(new Date());
    setEvents((prev) => {
      const next = [
        ...prev,
        { id: idRef.current++, time, type, label, severity, properties },
      ];
      return next.length > MAX_EVENTS ? next.slice(next.length - MAX_EVENTS) : next;
    });
  }, []);

  const clear = useCallback(() => setEvents([]), []);

  return { events, handleEvent, clear };
}
