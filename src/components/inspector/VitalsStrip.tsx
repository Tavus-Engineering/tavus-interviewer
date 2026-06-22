/**
 * VitalsStrip.tsx
 *
 * Zone 1 of the developer panel — the "vitals" strip pinned at the top of the
 * panel, above the Inspector/Events tabs, so it never scrolls away. A dev
 * should glance here and know whether the conversation is healthy without
 * reading any logs:
 *
 *   - conversation status pill (active / shutting down / ended) + elapsed time
 *   - who's speaking right now (replica / you / silence)
 *   - current objective + progress (active item pulses)
 *   - a guardrail counter that turns red the instant a violation is recorded
 *
 * Pure presentational — all state is derived upstream and passed in.
 */

import type { InspectorObjective } from "@/components/inspector/DeveloperInspector";
import type { Speaker } from "@/hooks/useSpeakingState";
import { formatMMSS } from "@/hooks/useElapsedTime";

export type ConversationStatus = "active" | "shutting-down" | "ended";

interface VitalsStripProps {
  status: ConversationStatus;
  elapsedSeconds: number;
  speaker: Speaker;
  objectives: InspectorObjective[];
  /** Total guardrail violations recorded this session. */
  guardrailViolations: number;
  /** Optional turn-taking stats (interviewer / Sparrow). */
  turns?: number;
  interruptions?: number;
  /** Live Tavus conversation ID — surfaced for debugging / API lookups. */
  conversationId?: string | null;
}

const STATUS_LABEL: Record<ConversationStatus, string> = {
  active: "Active",
  "shutting-down": "Shutting down",
  ended: "Ended",
};

const SPEAKER_LABEL: Record<Speaker, string> = {
  replica: "Replica",
  user: "You",
  silence: "Silence",
};

export function VitalsStrip({
  status,
  elapsedSeconds,
  speaker,
  objectives,
  guardrailViolations,
  turns,
  interruptions,
  conversationId,
}: VitalsStripProps) {
  const completed = objectives.filter((o) => o.status === "done").length;
  const total = objectives.length;
  const active = objectives.find((o) => o.status === "active");
  const hasViolation = guardrailViolations > 0;

  return (
    <div className="vitals" role="status" aria-live="polite">
      {/* Row 1 — status + elapsed, speaker */}
      <div className="vitals__row">
        <span className={`vitals__pill vitals__pill--${status}`}>
          <span className="vitals__dot" aria-hidden />
          {STATUS_LABEL[status]}
        </span>
        <span className="vitals__time" aria-label="Elapsed time">
          {formatMMSS(elapsedSeconds)}
        </span>
        <span className="vitals__spacer" />
        <span className={`vitals__speaker vitals__speaker--${speaker}`}>
          {speaker !== "silence" && <span className="vitals__pulse" aria-hidden />}
          {SPEAKER_LABEL[speaker]}
        </span>
      </div>

      {/* Row 2 — objective progress, guardrail counter */}
      <div className="vitals__row">
        <span className="vitals__metric">
          <span className="vitals__metric-label">OBJ</span>
          <span className="vitals__metric-value">
            {completed}/{total}
          </span>
          {active && (
            <span className="vitals__active">
              <span className="vitals__active-dot" aria-hidden />
              {active.label}
            </span>
          )}
        </span>
        <span className="vitals__spacer" />
        {typeof turns === "number" && (
          <span className="vitals__metric vitals__metric--muted" title="Conversational turns">
            <span className="vitals__metric-label">TURNS</span>
            <span className="vitals__metric-value">{turns}</span>
          </span>
        )}
        {typeof interruptions === "number" && (
          <span className="vitals__metric vitals__metric--muted" title="Replica interruptions">
            <span className="vitals__metric-label">INT</span>
            <span className="vitals__metric-value">{interruptions}</span>
          </span>
        )}
        <span
          className={`vitals__metric vitals__guardrail${hasViolation ? " vitals__guardrail--alert" : ""}`}
          title="Guardrail violations"
        >
          <span className="vitals__metric-label">GR</span>
          <span className="vitals__metric-value">{guardrailViolations}</span>
        </span>
      </div>

      {/* Row 3 — live conversation ID (click to select-all for easy copy) */}
      {conversationId && (
        <div className="vitals__row vitals__row--conv">
          <span className="vitals__conv" title={conversationId}>
            <span className="vitals__metric-label">CVI</span>
            <span className="vitals__conv-id">{conversationId}</span>
          </span>
        </div>
      )}
    </div>
  );
}
