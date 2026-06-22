/**
 * useGuardrailResponder.ts
 *
 * Turns a guardrail violation into a real-time, in-character spoken reaction
 * from the replica. When a guardrail whose action is "speak" trips (see
 * guardrailActions.ts), we inject a system-style instruction via a
 * `conversation.respond` interaction; per Tavus docs the replica then responds
 * as if to user input, so the LLM phrases the words in the persona's own voice.
 *
 *  - One-shot per occurrence, with a per-guardrail cooldown so a lingering
 *    condition (e.g. a bystander who stays in frame and re-trips the guardrail
 *    every few seconds) doesn't make the replica repeat itself on a loop.
 *  - No `conversation.interrupt` — `conversation.respond` naturally queues until
 *    the replica's current turn ends.
 *  - The injected text carries GUARDRAIL_SYSTEM_PREFIX so the transcript hook
 *    drops it if Tavus echoes it back as a user utterance.
 *
 * Reuses the same `dailyRef` bridge the screen uses for the dev "inject answer"
 * affordance (Daily lives inside <VideoProvider>, so the ref is populated by a
 * binder component in the tree).
 *
 * Tavus docs: https://docs.tavus.io/sections/event-schemas/conversation-respond
 */

import { useCallback, useRef } from "react";
import type { RefObject } from "react";
import type { DailyCall } from "@daily-co/daily-js";
import {
  resolveGuardrailAction,
  type GuardrailActionContext,
} from "@/lib/guardrailActions";

/** Minimum gap between spoken reactions for the same guardrail. */
const COOLDOWN_MS = 15_000;

export function useGuardrailResponder(
  dailyRef: RefObject<DailyCall | null>,
  conversationId: string | null
) {
  const lastSpokeAtRef = useRef<Map<string, number>>(new Map());

  return useCallback(
    (violation: GuardrailActionContext) => {
      const action = resolveGuardrailAction(violation);
      if (!action.speak || !action.buildInstruction) return;

      const daily = dailyRef.current;
      if (!daily || !conversationId) {
        console.warn(
          "[GuardrailResponder] no daily client / conversation_id yet — skipping spoken reaction"
        );
        return;
      }

      // Per-guardrail cooldown: don't repeat the same reaction on a loop while
      // the condition lingers and the guardrail keeps re-firing.
      const now = Date.now();
      const last = lastSpokeAtRef.current.get(violation.guardrail_name) ?? 0;
      if (now - last < COOLDOWN_MS) return;
      lastSpokeAtRef.current.set(violation.guardrail_name, now);

      const text = action.buildInstruction(violation);
      try {
        daily.sendAppMessage(
          {
            message_type: "conversation",
            event_type: "conversation.respond",
            conversation_id: conversationId,
            properties: { text },
          },
          "*"
        );
      } catch (err) {
        console.warn("[GuardrailResponder] sendAppMessage failed:", err);
      }
    },
    [dailyRef, conversationId]
  );
}
