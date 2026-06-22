/**
 * useUtteranceEvents.ts
 *
 * Accumulates the conversation transcript from utterance events on the
 * interaction bus. Lenient about field naming/location so it survives
 * payload variations across Tavus deployments:
 *   - reads `inference_id` from either `properties` or the top level
 *   - reads spoken text from any of `text` / `speech` / `content`
 *   - if no inference_id is present, falls back to `${event_type}-${seq}`
 *     so the entry still appears
 *
 * Authority model (differs by role, because Tavus' streaming `final` flag
 * is unreliable for the user):
 *   - Replica: dedupe by `inference_id` — one row per inference, text
 *     replaced as chunks arrive. The single-shot `conversation.utterance`
 *     only seeds the greeting (which has no streaming counterpart).
 *   - User: key the row by `turn_idx`, NOT `inference_id`. Tavus increments
 *     `turn_idx` once per user turn but cycles through several `inference_id`s
 *     *within* that turn as the ASR revises its transcription. Each streaming
 *     chunk's `text` is a full snapshot of the turn so far (not a delta), so
 *     every chunk simply replaces the row's text. The streaming `final` flag
 *     is ignored for the user (it fires `true` mid-turn). The single-shot
 *     `conversation.utterance` is the authoritative clean sentence: it
 *     replaces the row's text and locks it (`streaming: false`) so trailing
 *     stale chunks can't re-corrupt it.
 *
 * Raven awareness fields (`user_visual_analysis`, `user_audio_analysis`)
 * ride on `conversation.utterance` user-role events and are surfaced
 * alongside the transcript state.
 *
 * Utterances only arrive when the conversation was created with
 * `enable_closed_captions: true` (see api/_lib/handlers/conversation-create.ts).
 */

import { useCallback, useState } from "react";
import type { TavusEvent } from "@/types/events";
import type { PerceptionObservation } from "@/types/interview";
import { GUARDRAIL_SYSTEM_PREFIX } from "@/lib/guardrailActions";

export interface Utterance {
  id: string;
  role: "user" | "replica";
  text: string;
  timestamp: number;
  /** Tavus seq (globally monotonic) — used for ordering when available. */
  seq: number;
  /** True until the final streaming chunk for this turn arrives. */
  streaming?: boolean;
  /** Optimistic typed-message row, rendered instantly on send and waiting
   *  to be "adopted" by the echoed user utterance event (so the message
   *  doesn't render twice). Cleared once adopted. */
  pending?: boolean;
}

/** Legacy alias retained so existing callers don't need to rename imports. */
export type Caption = Utterance;

interface UtteranceProps {
  role?: string;
  text?: string;
  speech?: string;
  content?: string;
  transcript?: string;
  user_visual_analysis?: string;
  user_audio_analysis?: string;
  inference_id?: string;
  final?: boolean;
  turn_idx?: number;
}

function readField<T = string>(
  props: UtteranceProps,
  top: UtteranceProps,
  key: keyof UtteranceProps
): T | undefined {
  return (props[key] ?? top[key]) as T | undefined;
}

function readText(props: UtteranceProps, top: UtteranceProps): string | undefined {
  const candidates = [
    props.text,
    top.text,
    props.speech,
    top.speech,
    props.content,
    top.content,
    props.transcript,
    top.transcript,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) return c;
  }
  return undefined;
}

function readRole(
  props: UtteranceProps,
  top: UtteranceProps,
  eventType: string
): "user" | "replica" {
  const raw = (props.role ?? top.role ?? "").toString().toLowerCase();
  if (raw === "user") return "user";
  if (raw === "replica") return "replica";
  // Role missing — try secondary signals.
  const inferenceId = props.inference_id ?? top.inference_id;
  if (inferenceId) return "replica";
  const hasRavenFields = !!(
    props.user_visual_analysis ??
    top.user_visual_analysis ??
    props.user_audio_analysis ??
    top.user_audio_analysis
  );
  if (hasRavenFields) return "user";
  if (eventType === "conversation.utterance") return "replica";
  return "user";
}

function insertSorted(prev: Utterance[], next: Utterance): Utterance[] {
  const insertAt = prev.findIndex((u) => u.seq > next.seq);
  if (insertAt === -1) return [...prev, next];
  const out = prev.slice();
  out.splice(insertAt, 0, next);
  return out;
}

/**
 * Insert or update the user transcript row for a turn. Keyed by `turn_idx`
 * (Tavus increments it once per user turn) so the several `inference_id`
 * revisions Tavus emits within a single turn all land in the same bubble.
 *
 * Each incoming `text` is a full snapshot of the turn (not a delta), so we
 * simply replace the row's text. `lock` is true only for the authoritative
 * single-shot `conversation.utterance`: it finalizes the row (`streaming:
 * false`) so trailing/stale streaming chunks for the same turn are ignored.
 *
 * Fallback (no `turn_idx` in the payload): reuse the trailing user row while
 * it's still streaming, otherwise start a fresh row.
 *
 * Optimistic typed messages: when the row for this turn doesn't exist yet but
 * an optimistic typed row is pending (rendered instantly on send), the echoed
 * event adopts that row — claiming the turn id and keeping the typed text
 * (authoritative) — instead of inserting a second bubble.
 */
function upsertUserTurn(
  prev: Utterance[],
  turnIdx: number | undefined,
  inferenceId: string | undefined,
  text: string,
  seq: number,
  lock: boolean,
): Utterance[] {
  let id: string;
  if (typeof turnIdx === "number") {
    id = `user:turn:${turnIdx}`;
  } else {
    const last = prev[prev.length - 1];
    id =
      last && last.role === "user" && last.streaming
        ? last.id
        : `user:${inferenceId ?? seq}`;
  }

  const idx = prev.findIndex((u) => u.id === id);
  if (idx === -1) {
    // No row for this turn yet. Adopt an optimistic typed row if one is
    // waiting: keep its (authoritative, user-typed) text and lock it so the
    // echoed chunks for this turn don't create a duplicate or flicker.
    const pendingIdx = prev.findIndex((u) => u.role === "user" && u.pending);
    if (pendingIdx !== -1) {
      const out = prev.slice();
      out[pendingIdx] = {
        ...out[pendingIdx],
        id,
        pending: false,
        streaming: false,
        seq: Math.max(out[pendingIdx].seq, seq),
      };
      return out;
    }
    return insertSorted(prev, {
      id,
      role: "user",
      text,
      timestamp: Date.now(),
      seq,
      streaming: !lock,
    });
  }

  const row = prev[idx];
  // Already finalized by the single-shot — drop trailing stale streaming.
  if (row.streaming === false && !lock) return prev;
  if (row.text === text && row.streaming === !lock && row.seq >= seq) return prev;

  const out = prev.slice();
  out[idx] = {
    ...row,
    text,
    seq: Math.max(row.seq, seq),
    streaming: !lock,
  };
  return out;
}

export function useUtteranceEvents() {
  const [utterances, setUtterances] = useState<Utterance[]>([]);
  const [latestVisualAnalysis, setLatestVisualAnalysis] = useState<string | null>(null);
  const [latestAudioAnalysis, setLatestAudioAnalysis] = useState<string | null>(null);
  // Running history of Raven awareness snippets seen during the call.
  // Used as a fallback for the report when the persona doesn't have
  // `perception_analysis_queries` configured (and therefore no end-of-call
  // `conversation.perception-analysis` event fires). Each entry is the
  // raw free-text Raven phrase; we dedupe consecutive identical entries
  // so the report doesn't end up with twenty copies of the same line.
  const [awarenessObservations, setAwarenessObservations] = useState<
    PerceptionObservation[]
  >([]);

  const handleEvent = useCallback((event: TavusEvent) => {
    const top = event as unknown as UtteranceProps;
    const props = (event.properties as UtteranceProps) ?? ({} as UtteranceProps);

    // ── conversation.utterance: Raven awareness + authoritative text ──
    // Single-shot event. Carries Raven awareness fields, the full user
    // sentence (source of truth for the user transcript — see below), and
    // the replica greeting (which has no streaming counterpart).
    if (event.event_type === "conversation.utterance") {
      const visual = readField<string>(props, top, "user_visual_analysis");
      if (typeof visual === "string" && visual.trim().length > 0) {
        setLatestVisualAnalysis(visual);
        setAwarenessObservations((prev) => {
          const trimmed = visual.trim();
          if (prev.length > 0 && prev[prev.length - 1].analysis === trimmed) return prev;
          return [
            ...prev,
            { id: `visual-${prev.length}`, label: "Visual awareness", analysis: trimmed },
          ];
        });
      }
      const audio = readField<string>(props, top, "user_audio_analysis");
      if (typeof audio === "string" && audio.trim().length > 0) {
        setLatestAudioAnalysis(audio);
        setAwarenessObservations((prev) => {
          const trimmed = audio.trim();
          if (prev.length > 0 && prev[prev.length - 1].analysis === trimmed) return prev;
          return [
            ...prev,
            { id: `audio-${prev.length}`, label: "Audio awareness", analysis: trimmed },
          ];
        });
      }

      const text = readText(props, top);
      if (!text) return;
      const seq = typeof event.seq === "number" ? event.seq : Date.now();
      const role = readRole(props, top, event.event_type);
      const inferenceId = readField<string>(props, top, "inference_id");
      const turnIdx = readField<number>(props, top, "turn_idx");

      // ── User turn: authoritative full sentence ──
      // The single-shot event carries the clean, complete sentence for the
      // turn. Replace the row's text and lock it (the streaming path's
      // `final` flag is unreliable, so streaming never finalizes the row).
      if (role === "user") {
        // Drop the echo of a guardrail system instruction we injected via
        // conversation.respond — it isn't something the candidate said.
        if (text.startsWith(GUARDRAIL_SYSTEM_PREFIX)) return;
        setUtterances((prev) =>
          upsertUserTurn(prev, turnIdx, inferenceId, text, seq, true),
        );
        return;
      }

      // ── Replica greeting ──
      // Tavus emits the greeting only as a single-shot event (no
      // streaming), so seed it when the transcript is still empty. Any
      // other non-empty replica single-shot is ignored — the streaming
      // path is authoritative for the replica.
      setUtterances((prev) => {
        if (prev.length > 0) return prev;
        return [
          {
            id: `greeting-${seq}`,
            role: "replica",
            text,
            timestamp: Date.now(),
            seq,
          },
        ];
      });
      return;
    }

    if (event.event_type !== "conversation.utterance.streaming") return;

    const seq = typeof event.seq === "number" ? event.seq : Date.now();
    const text = readText(props, top);
    const role = readRole(props, top, event.event_type);
    const inferenceId = readField<string>(props, top, "inference_id");

    if (!text) return;

    // ── User path: one row per turn, text replaced on every chunk ──
    // Each chunk is a full snapshot of the turn, keyed by `turn_idx`. The
    // streaming `final` flag is unreliable for the user (it fires `true`
    // mid-turn), so we never finalize here — only the single-shot
    // `conversation.utterance` locks the row.
    if (role === "user") {
      // Drop the echo of a guardrail system instruction we injected via
      // conversation.respond — it isn't something the candidate said.
      if (text.startsWith(GUARDRAIL_SYSTEM_PREFIX)) return;
      const turnIdx = readField<number>(props, top, "turn_idx");
      setUtterances((prev) =>
        upsertUserTurn(prev, turnIdx, inferenceId, text, seq, false),
      );
      return;
    }

    // ── Replica path: dedupe by id (one row per inference_id) ──
    const id = `replica:${inferenceId ?? `${event.event_type}-${seq}`}`;
    const isFinal = readField<boolean>(props, top, "final") === true;

    setUtterances((prev) => {
      const idx = prev.findIndex((u) => u.id === id);
      if (idx === -1) {
        return insertSorted(prev, {
          id,
          role,
          text,
          timestamp: Date.now(),
          seq,
          streaming: !isFinal,
        });
      }
      const updated = prev.slice();
      updated[idx] = {
        ...updated[idx],
        text,
        role,
        streaming: !isFinal,
      };
      return updated;
    });
  }, []);

  /**
   * Optimistically append a typed user message so it renders the instant the
   * user hits send — no waiting on Tavus's echo round-trip. The row is marked
   * `pending`; when the echoed `conversation.utterance` for the same turn
   * arrives it adopts this row (see `upsertUserTurn`) rather than adding a
   * second bubble. If the echo never arrives, the optimistic row simply
   * stands as the transcript entry.
   */
  const appendUserText = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const now = Date.now();
    setUtterances((prev) => {
      const lastSeq = prev.length > 0 ? prev[prev.length - 1].seq : 0;
      return insertSorted(prev, {
        id: `user-pending-${now}-${Math.random().toString(36).slice(2, 8)}`,
        role: "user",
        text: trimmed,
        timestamp: now,
        seq: lastSeq + 1,
        pending: true,
      });
    });
  }, []);

  return {
    utterances,
    /** Legacy alias used by InterviewScreen / TranscriptPanel. */
    captions: utterances,
    latestVisualAnalysis,
    latestAudioAnalysis,
    /** Accumulated Raven awareness lines from user-role utterance events.
     *  Forwarded as the report's perceptionObservations fallback when the
     *  persona doesn't emit end-of-call `conversation.perception-analysis`. */
    awarenessObservations,
    handleEvent,
    appendUserText,
  };
}
