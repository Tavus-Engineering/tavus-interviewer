/**
 * usePerceptionAnalysis.ts
 *
 * Listens for the end-of-call `conversation.perception-analysis` event via
 * useObservableEvent. Parses the analysis string and exposes it as structured
 * observations for the ResultsScreen.
 *
 * NOTE: Fires ONCE at end of call — not a real-time stream.
 * Consumed by: ResultsScreen.tsx
 * Tavus docs: https://docs.tavus.io/sections/event-schemas/conversation-perception-analysis
 */

import { useState, useCallback, useRef } from "react";
import type { TavusEvent, PerceptionAnalysisEvent } from "@/types/events";
import type { PerceptionObservation } from "@/types/interview";
import { parsePerceptionAnalysis } from "@/lib/utils/formatSummary";

export function usePerceptionAnalysis() {
  const [observations, setObservations] = useState<PerceptionObservation[]>([]);
  const receivedRef = useRef(false);

  const handleEvent = useCallback((event: TavusEvent) => {
    // perception_analysis_queries are evaluated ONCE at end-of-call by Raven.
    // They do NOT affect live conversation behavior — only the end-of-call
    // perception analysis shown in the inspector.
    // Event type is "conversation.perception-analysis" — NOT "application.perception_analysis".
    // Fields are directly on the event object — NOT nested under event.data.
    if (event.event_type !== "conversation.perception-analysis") return;
    if (receivedRef.current) return; // Only process once
    receivedRef.current = true;

    const perceptionEvent = event as PerceptionAnalysisEvent;
    const analysis = perceptionEvent.properties.analysis;

    const parsed = parsePerceptionAnalysis(analysis);
    setObservations(parsed);
  }, []);

  return {
    observations,
    handleEvent,
  };
}
