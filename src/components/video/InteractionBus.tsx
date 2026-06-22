/**
 * InteractionBus.tsx
 *
 * Subscribes to Tavus events via useDailyEvent("app-message") and fans them
 * out to every registered handler (objectives, perception analysis,
 * guardrails, tool calls, utterances, end-conversation detection). Renders
 * nothing.
 *
 * Tavus docs: https://docs.tavus.io/sections/conversational-video-interface/interactions-protocols/overview
 */

import { useCallback, useRef } from "react";
import { useDailyEvent } from "@daily-co/daily-react";
import type { TavusEvent } from "@/types/events";

type EventHandler = (event: TavusEvent) => void;

interface InteractionBusProps {
  handlers: EventHandler[];
}

export function InteractionBus({ handlers }: InteractionBusProps) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useDailyEvent(
    "app-message",
    useCallback((event: { data: unknown }) => {
      const raw = event.data;
      let data: TavusEvent;
      try {
        data = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch {
        return;
      }

      for (const handler of handlersRef.current) {
        handler(data);
      }
    }, [])
  );

  return null;
}
