/**
 * useSpeakingState.ts
 *
 * Derives "who is speaking right now" from the CVI started/stopped speaking
 * events for the Live State vitals strip.
 *
 * Tavus emits these in two shapes across its docs/SDKs:
 *   - dotted:  `conversation.replica.started_speaking` / `conversation.user.stopped_speaking`
 *   - flat:    `conversation.started_speaking` with `properties.role` ("replica" | "user")
 * We handle both defensively — match on the `started_speaking` / `stopped_speaking`
 * substring, then resolve the role from the dotted segment OR `properties.role`.
 *
 * `stopped_speaking` carries `interrupted` + `duration` (unused here).
 *
 * Consumed by: InterviewScreen (wired into the InteractionBus handlers array).
 */

import { useCallback, useRef, useState } from "react";
import type { TavusEvent } from "@/types/events";

export type Speaker = "replica" | "user" | "silence";

function resolveRole(event: TavusEvent): Speaker | null {
  const type = event.event_type ?? "";
  if (type.includes(".replica.")) return "replica";
  if (type.includes(".user.")) return "user";
  const role = (event.properties as { role?: string })?.role;
  if (role === "replica" || role === "user") return role;
  return null;
}

export function useSpeakingState() {
  const [speaker, setSpeaker] = useState<Speaker>("silence");
  // Track who we believe is currently speaking so a `stopped_speaking` from a
  // stale role (arriving after the other party already started) doesn't wrongly
  // flip us back to silence.
  const speakerRef = useRef<Speaker>("silence");

  const set = useCallback((next: Speaker) => {
    speakerRef.current = next;
    setSpeaker(next);
  }, []);

  const handleEvent = useCallback(
    (event: TavusEvent) => {
      const type = event.event_type ?? "";
      if (type.includes("started_speaking")) {
        const role = resolveRole(event);
        if (role) set(role);
        return;
      }
      if (type.includes("stopped_speaking")) {
        const role = resolveRole(event);
        // Only fall back to silence if the party that stopped is the one we
        // currently show as speaking (avoids races with overlapping turns).
        if (!role || role === speakerRef.current) set("silence");
      }
    },
    [set]
  );

  return { speaker, handleEvent };
}
