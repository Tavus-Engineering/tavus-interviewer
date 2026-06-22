/**
 * useGuardrailEvents.ts
 *
 * Manages guardrail display state for the developer inspector.
 *
 * Two violation sources, in priority order:
 *  1. The REAL Tavus guardrail app-message — fired the instant a guardrail
 *     trips (default `app_message: true` on the guardrail). Its `event_type`
 *     contains "guardrail"; `properties` carry the guardrail name
 *     (`guardrail` / `guardrail_name`), `guardrail_uuid`, and a violation
 *     `reason`. This is authoritative.
 *  2. A FALLBACK inference from `conversation.perception_tool_call` — a Raven
 *     visual tool whose name maps to a visual guardrail. Used only until a real
 *     guardrail event has been seen for that guardrail (so we don't double
 *     count). Perception tool calls also bump each visual guardrail's
 *     "last evaluated" time even when they aren't a violation.
 *
 * Consumed by: InterviewScreen
 * Tavus docs:
 *   https://docs.tavus.io/sections/conversational-video-interface/guardrails
 *   https://docs.tavus.io/sections/event-schemas/conversation-perception-tool-call
 */

import { useState, useCallback, useEffect, useRef } from "react";
import type { TavusEvent, PerceptionToolCallEvent } from "@/types/events";
import type { GuardrailStatus } from "@/types/interview";
import {
  resolveGuardrailAction,
  type GuardrailActionContext,
} from "@/lib/guardrailActions";

interface UseGuardrailEventsOptions {
  /** Fired on every recorded violation (real or inferred), with the guardrail's
   *  label + modality + reason. The screen wires this to useGuardrailResponder
   *  so the replica can react in-character. */
  onViolation?: (violation: GuardrailActionContext) => void;
}

/** Derive a human-readable label from the guardrail_name. Labels come from the
 *  live persona (Tavus API) — no names or descriptions are hardcoded. */
function humanizeGuardrailName(name: string): string {
  return name
    .split(/[_-]/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

interface GuardrailConfig {
  guardrail_name: string;
  modality: "verbal" | "visual";
}

function normalize(name: string): string {
  return name.replace(/^obj_/, "").toLowerCase();
}

function makeStatus(g: GuardrailConfig): GuardrailStatus {
  return {
    guardrail_name: g.guardrail_name,
    label: humanizeGuardrailName(g.guardrail_name),
    description: "",
    modality: g.modality,
    triggered: false,
    violationCount: 0,
  };
}

export function useGuardrailEvents(
  guardrails: GuardrailConfig[],
  options?: UseGuardrailEventsOptions
) {
  const [statuses, setStatuses] = useState<GuardrailStatus[]>(() =>
    guardrails.map(makeStatus)
  );

  // Keep the latest callback in a ref so recordViolation stays stable.
  const onViolationRef = useRef(options?.onViolation);
  onViolationRef.current = options?.onViolation;

  // The persona guardrails load asynchronously from the API, so the initial
  // seed above may be empty. Reconcile when the config changes — keep existing
  // entries (preserving accumulated violation state) and add/remove to match.
  const configKey = guardrails.map((g) => `${g.guardrail_name}:${g.modality}`).join("|");
  useEffect(() => {
    setStatuses((prev) => {
      const byName = new Map(prev.map((s) => [s.guardrail_name, s]));
      return guardrails.map((g) => byName.get(g.guardrail_name) ?? makeStatus(g));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey]);

  /** The label of the most recently triggered guardrail (for toast display). */
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const statusesRef = useRef(statuses);
  statusesRef.current = statuses;

  // Guardrails for which a real (authoritative) guardrail event has fired —
  // once set, the perception-tool-call fallback stops counting violations for
  // that guardrail to avoid double counting.
  const sawRealEventRef = useRef<Set<string>>(new Set());

  const dismissToast = useCallback(() => setToastMessage(null), []);

  /** Find a tracked guardrail by tolerant name match. */
  const matchName = useCallback((name: string): string | null => {
    const target = normalize(name);
    const hit = statusesRef.current.find(
      (g) => normalize(g.guardrail_name) === target
    );
    return hit?.guardrail_name ?? null;
  }, []);

  /** Record a violation against a guardrail (real event or inferred fallback). */
  const recordViolation = useCallback(
    (guardrailName: string, reason?: string) => {
      const now = Date.now();
      // Side effects (toast + spoken reaction) read the current status so they
      // don't run inside the state updater (which React may invoke twice).
      const existing = statusesRef.current.find(
        (g) => g.guardrail_name === guardrailName
      );
      if (existing) {
        // Per-guardrail policy decides the participant-facing surfaces. The
        // inspector logs every guardrail regardless (via setStatuses below).
        const action = resolveGuardrailAction({
          guardrail_name: existing.guardrail_name,
          label: existing.label,
          modality: existing.modality,
        });
        // Toast: only for guardrails that opt in, and only on first trip.
        if (action.toast && !existing.triggered) {
          setToastMessage(action.toastMessage ?? existing.label ?? guardrailName);
        }
        // Speak: fire on every violation; the responder's per-guardrail cooldown
        // keeps a lingering condition from making the replica repeat itself.
        if (action.speak) {
          onViolationRef.current?.({
            guardrail_name: existing.guardrail_name,
            label: existing.label,
            modality: existing.modality,
            reason,
          });
        }
      }
      setStatuses((prev) => {
        return prev.map((g) =>
          g.guardrail_name === guardrailName
            ? {
                ...g,
                triggered: true,
                triggeredAt: now,
                lastEvaluatedAt: now,
                violationCount: g.violationCount + 1,
                lastReason: reason ?? g.lastReason,
              }
            : g
        );
      });
    },
    []
  );

  /** Mark a guardrail as evaluated (checked) without counting a violation. */
  const markEvaluated = useCallback((guardrailName: string) => {
    const now = Date.now();
    setStatuses((prev) =>
      prev.map((g) =>
        g.guardrail_name === guardrailName ? { ...g, lastEvaluatedAt: now } : g
      )
    );
  }, []);

  const handleEvent = useCallback(
    (event: TavusEvent) => {
      const type = event.event_type ?? "";

      // 1) Real guardrail app-message (authoritative).
      if (type.includes("guardrail")) {
        const props = (event.properties ?? {}) as {
          guardrail?: string;
          guardrail_name?: string;
          reason?: string;
        };
        const rawName = props.guardrail ?? props.guardrail_name;
        if (!rawName) return;
        const name = matchName(rawName) ?? rawName;
        sawRealEventRef.current.add(name);
        recordViolation(name, props.reason);
        return;
      }

      // 2) Perception tool call — evaluation signal + inferred fallback.
      if (type === "conversation.perception_tool_call") {
        const e = event as PerceptionToolCallEvent;
        const toolName = e.properties?.name;
        if (!toolName) return;

        // Resolve which visual guardrail this tool maps to by fuzzy name match
        // (tool name contains the guardrail's name). No hardcoded tool→guardrail
        // table — the guardrails come live from the persona.
        const lower = toolName.toLowerCase();
        const hit = statusesRef.current.find(
          (g) =>
            g.modality === "visual" && lower.includes(normalize(g.guardrail_name))
        );
        if (!hit) return;
        const guardrailName = hit.guardrail_name;

        // Always update "last evaluated" — a perception tool call means the
        // guardrail was checked, violation or not.
        markEvaluated(guardrailName);

        // Fallback violation: count at most once per guardrail (a detection
        // tool fires periodically to check, so we don't inflate the count),
        // and only until a real guardrail event takes over as authoritative.
        if (!sawRealEventRef.current.has(guardrailName) && !hit.triggered) {
          recordViolation(guardrailName);
        }
      }
    },
    [matchName, recordViolation, markEvaluated]
  );

  return { guardrails: statuses, handleEvent, toastMessage, dismissToast };
}
