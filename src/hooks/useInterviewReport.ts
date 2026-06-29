/**
 * useInterviewReport.ts
 *
 * Reads the casting report produced by the persona's `submit_audition_report`
 * post-call tool. After the call ends, Tavus runs the tool (an AI step fills the
 * report fields from the transcript) and records the rendered request on the
 * conversation as an `application.post_call_action_executed` event. We poll
 * `GET /api/conversation/get?...` (verbose) until that event appears, then parse
 * its `request.body` into an InterviewAnalysis.
 *
 * The post-call tool runs *after* the call concludes and can take a couple of
 * minutes to produce the report, so this polls on an interval up to a timeout
 * (MAX_WAIT_MS) rather than fetching once.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet } from "@/lib/tavus/client";
import type { InterviewAnalysis } from "@/types/interview";

const POLL_INTERVAL_MS = 3000;
// The Tavus post-call tool typically takes ~2–2.5 min to run after the call
// ends, so we wait up to 4 min before surfacing the error (Try again restarts).
const MAX_WAIT_MS = 240_000;
const POST_CALL_EVENT = "application.post_call_action_executed";
const TOOL_NAME = "submit_audition_report";

interface ConversationEvent {
  event_type?: string;
  properties?: Record<string, unknown>;
}
interface VerboseConversation {
  events?: ConversationEvent[];
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}

/** The tool's `request.body` may arrive as an object or a JSON string. */
function toBodyObject(body: unknown): Record<string, unknown> | null {
  if (!body) return null;
  if (typeof body === "object") return body as Record<string, unknown>;
  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      return typeof parsed === "object" && parsed ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** Array fields are interpolated into the body as JSON strings. */
function parseJsonArray(v: unknown): Record<string, unknown>[] {
  if (Array.isArray(v)) return v as Record<string, unknown>[];
  if (typeof v === "string" && v.trim()) {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function buildAnalysis(b: Record<string, unknown>): InterviewAnalysis {
  const bars = parseJsonArray(b.perception_bars_json)
    .map((x) => ({
      label: String(x.label ?? ""),
      value: String(x.value ?? ""),
      percent: num(x.percent),
      warn: Boolean(x.warn),
    }))
    .filter((x) => x.label);

  const highlights = parseJsonArray(b.transcript_highlights_json)
    .map((x) => ({
      timestamp: String(x.timestamp ?? ""),
      label: String(x.label ?? ""),
      quote: String(x.quote ?? ""),
    }))
    .filter((x) => x.quote || x.label);

  const hasStar =
    b.star_situation || b.star_task || b.star_action || b.star_result;

  return {
    summary: String(b.summary ?? ""),
    scores: {
      overall: num(b.overall),
      technical: num(b.technical),
      communication: num(b.communication),
      starAdherence: num(b.star_adherence),
    },
    perceptionBars: bars.length ? bars : undefined,
    starBreakdown: hasStar
      ? {
          situation: String(b.star_situation ?? ""),
          task: String(b.star_task ?? ""),
          action: String(b.star_action ?? ""),
          result: String(b.star_result ?? ""),
        }
      : undefined,
    transcriptHighlights: highlights.length ? highlights : undefined,
  };
}

/** Finds the post-call report event in a verbose conversation payload. */
function extractReport(conv: VerboseConversation): InterviewAnalysis | null {
  const events = conv.events ?? [];
  // Each attached post-call action emits its own post_call event, so narrow to
  // those first, then prefer the one for our tool — falling back to the latest
  // post-call event when the tool name differs (it can vary per account).
  const postCall = events.filter((e) => e.event_type === POST_CALL_EVENT);
  const event =
    postCall.find((e) => e.properties?.tool_name === TOOL_NAME) ??
    postCall[postCall.length - 1];
  if (!event) return null;
  const props = event.properties ?? {};
  const request = (props.request ?? {}) as { body?: unknown };
  const body = toBodyObject(request.body);
  if (!body) return null;
  return buildAnalysis(body);
}

export function useInterviewReport(
  conversationId: string | null,
  enabled: boolean
) {
  const [analysis, setAnalysis] = useState<InterviewAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedAtRef = useRef<number | null>(null);
  // Bumped by retry() to re-run the polling effect against the same
  // conversation — useful when the post-call tool hasn't landed in time.
  const [attempt, setAttempt] = useState(0);

  /** Re-pull the conversation and restart the poll window from scratch. */
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (!enabled || !conversationId) return;
    let cancelled = false;
    let timer: number | undefined;
    startedAtRef.current = Date.now();
    setIsLoading(true);
    setError(null);

    const poll = async () => {
      try {
        const conv = await apiGet<VerboseConversation>(
          `/api/conversation/get?conversation_id=${encodeURIComponent(conversationId)}`
        );
        if (cancelled) return;
        const report = extractReport(conv);
        if (report) {
          setAnalysis(report);
          setIsLoading(false);
          return;
        }
      } catch (err) {
        // Transient fetch errors are tolerated while polling; only surface one
        // if we ultimately time out.
        console.warn("[useInterviewReport] poll failed:", err);
      }
      if (cancelled) return;
      if (Date.now() - (startedAtRef.current ?? 0) >= MAX_WAIT_MS) {
        setIsLoading(false);
        setError("The report is taking longer than expected to generate.");
        return;
      }
      timer = window.setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [conversationId, enabled, attempt]);

  return { analysis, isLoading, error, retry };
}
