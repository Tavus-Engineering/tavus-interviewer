/**
 * useSparrowMetrics.ts
 *
 * Tracks live turn-taking metrics for the Sparrow column of the Developer
 * Inspector. Subscribes to the interaction bus via the returned `handleEvent`
 * callback (wired through InteractionBus) and counts:
 *
 *   - turns          — number of conversational turns. We count each
 *                      `conversation.utterance` (role: user or replica),
 *                      since each utterance ends one turn.
 *   - interruptions  — number of `conversation.replica.stopped_speaking`
 *                      events with `properties.interrupted === true`.
 *
 * Patience / interruptibility are static persona-config values and come from
 * `usePersonaTools().layers.conversational_flow` — they are NOT tracked here.
 */

import { useCallback, useState } from "react";
import type { TavusEvent } from "@/types/events";

export interface SparrowMetrics {
  turns: number;
  interruptions: number;
}

interface UseSparrowMetricsReturn extends SparrowMetrics {
  handleEvent: (event: TavusEvent) => void;
}

export function useSparrowMetrics(): UseSparrowMetricsReturn {
  const [turns, setTurns] = useState(0);
  const [interruptions, setInterruptions] = useState(0);

  const handleEvent = useCallback((event: TavusEvent) => {
    if (event.event_type === "conversation.utterance") {
      const role = (event.properties as { role?: string })?.role;
      if (role === "user" || role === "replica") {
        setTurns((prev) => prev + 1);
      }
      return;
    }

    if (event.event_type === "conversation.replica.stopped_speaking") {
      const interrupted = (event.properties as { interrupted?: boolean })
        ?.interrupted;
      if (interrupted === true) {
        setInterruptions((prev) => prev + 1);
      }
    }
  }, []);

  return { turns, interruptions, handleEvent };
}
