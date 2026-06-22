/**
 * eventSeverity.ts
 *
 * Maps a CVI `event_type` to a human-readable label + a severity bucket so the
 * Events Console can color rows by importance instead of rendering everything
 * in uniform green. Handles both the in-call (`conversation.*`) and verbose /
 * webhook (`application.*`, `system.*`) forms of each event.
 *
 *   muted   — system chatter / heartbeats (replica_present, joined)
 *   neutral — transcript + speaking events (the normal hum of a call)
 *   amber   — tool calls (LLM + perception) — "did my tool fire?"
 *   red     — guardrail violations + shutdown — the eye should jump here
 */

export type EventSeverity = "muted" | "neutral" | "amber" | "red";

export interface EventMeta {
  label: string;
  severity: EventSeverity;
}

/** The high-frequency heartbeat that should collapse in the log. */
export function isHeartbeat(eventType: string): boolean {
  return eventType === "system.replica_present";
}

/**
 * Exact-match labels for the events we know about. Anything not listed falls
 * through to `classifyEvent`'s heuristic + raw string.
 */
const EXACT: Record<string, EventMeta> = {
  "conversation.objective.activated": { label: "Objective activated", severity: "neutral" },
  "conversation.objective.completed": { label: "Objective completed", severity: "neutral" },
  "conversation.objective.pending": { label: "Objective pending", severity: "neutral" },
  "conversation.tool_call": { label: "LLM tool call", severity: "amber" },
  "conversation.perception_tool_call": { label: "Perception tool call", severity: "amber" },
  "application.perception_tool_call": { label: "Perception tool call", severity: "amber" },
  "conversation.utterance": { label: "Utterance", severity: "neutral" },
  "conversation.utterance.streaming": { label: "Utterance (streaming)", severity: "neutral" },
  "conversation.perception-analysis": { label: "Perception analysis", severity: "neutral" },
  "application.perception_analysis": { label: "Perception analysis", severity: "neutral" },
  "application.transcription_ready": { label: "Transcript ready", severity: "neutral" },
  "conversation.replica.started_speaking": { label: "Replica started speaking", severity: "neutral" },
  "conversation.replica.stopped_speaking": { label: "Replica stopped speaking", severity: "neutral" },
  "conversation.user.started_speaking": { label: "User started speaking", severity: "neutral" },
  "conversation.user.stopped_speaking": { label: "User stopped speaking", severity: "neutral" },
  "conversation.started_speaking": { label: "Started speaking", severity: "neutral" },
  "conversation.stopped_speaking": { label: "Stopped speaking", severity: "neutral" },
  "conversation.respond": { label: "Respond (sent)", severity: "neutral" },
  "system.replica_joined": { label: "Replica joined", severity: "muted" },
  "system.replica_present": { label: "Replica heartbeat", severity: "muted" },
  "system.shutdown": { label: "Conversation shutdown", severity: "red" },
};

export function classifyEvent(eventType: string): EventMeta {
  const exact = EXACT[eventType];
  if (exact) return exact;

  // Heuristic fallbacks for forms we didn't enumerate.
  if (eventType.includes("guardrail")) return { label: "Guardrail violation", severity: "red" };
  if (eventType.includes("shutdown")) return { label: "Shutdown", severity: "red" };
  if (eventType.includes("tool_call")) return { label: "Tool call", severity: "amber" };
  if (eventType.includes("speaking")) return { label: "Speaking", severity: "neutral" };
  if (eventType.includes("utterance")) return { label: "Utterance", severity: "neutral" };
  if (eventType.startsWith("system.")) return { label: eventType, severity: "muted" };
  return { label: eventType, severity: "neutral" };
}
