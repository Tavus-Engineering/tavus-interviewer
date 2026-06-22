/**
 * useToolCallEvents.ts
 *
 * Listens for `conversation.tool_call` (LLM function calls) and
 * `conversation.perception_tool_call` (Raven visual/audio tool fires).
 *
 * Tracks:
 *   1. The set of tool names observed — drives the inspector (a tool flips to
 *      ✓ once its event fires).
 *   2. `toolStats` — per tool (LLM + perception), the call count + last
 *      arguments + last-called time, so the inspector can answer "did my tool
 *      fire, how many times, and with what args?"
 *
 * The interviewer persona has no LLM tools — its tools are Raven perception
 * queries — so there is no structured `conversation.tool_call` data pipeline
 * to persist (no `toolCalls` array).
 *
 * Consumed by: InterviewScreen
 * Tavus docs:
 *   https://docs.tavus.io/sections/event-schemas/conversation-tool-call
 *   https://docs.tavus.io/sections/event-schemas/conversation-perception-tool-call
 */

import { useState, useCallback, useMemo } from "react";
import type {
  TavusEvent,
  ToolCallEvent,
  PerceptionToolCallEvent,
} from "@/types/events";

export interface ToolStat {
  count: number;
  lastArgs?: unknown;
  lastCalledAt: number;
}

export type ToolStats = Record<string, ToolStat>;

function parseArguments(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw !== "string") return {};
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return { _raw: trimmed };
  }
}

export function useToolCallEvents() {
  const [capturedSet, setCapturedSet] = useState<Set<string>>(() => new Set());
  const [toolStats, setToolStats] = useState<ToolStats>({});

  const handleEvent = useCallback((event: TavusEvent) => {
    if (
      event.event_type !== "conversation.tool_call" &&
      event.event_type !== "conversation.perception_tool_call"
    ) {
      return;
    }

    const e = event as ToolCallEvent | PerceptionToolCallEvent;
    const name = e.properties?.name;
    if (!name) return;

    setCapturedSet((prev) => {
      if (prev.has(name)) return prev;
      const next = new Set(prev);
      next.add(name);
      return next;
    });

    const args = parseArguments(
      (e.properties as { arguments?: unknown })?.arguments
    );
    setToolStats((prev) => {
      const existing = prev[name];
      return {
        ...prev,
        [name]: {
          count: (existing?.count ?? 0) + 1,
          lastArgs: args,
          lastCalledAt: Date.now(),
        },
      };
    });
  }, []);

  const capturedToolNames = useMemo(() => Array.from(capturedSet), [capturedSet]);

  return { capturedToolNames, toolStats, handleEvent };
}
