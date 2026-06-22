/**
 * useObjectiveEvents.ts
 *
 * Listens for `conversation.objective.activated`, `conversation.objective.completed`,
 * and `conversation.objective.pending` events from the interaction bus. Discovers
 * objectives dynamically from events — no pre-loaded list required.
 *
 * `pending` fires for objectives whose `confirmation_mode === "manual"`. Tavus
 * holds the objective open until the participant sends back a
 * `conversation.objective.confirm` app-message.
 *
 * Defensive parsing: Tavus sometimes hoists fields (objective_name,
 * output_variables) to the top of the event alongside `properties`. We
 * read from either, preferring `properties` when present.
 *
 * Consumed by: InterviewScreen
 * Tavus docs: https://docs.tavus.io/sections/conversational-video-interface/persona/objectives
 */

import { useCallback, useRef } from "react";
import type { TavusEvent } from "@/types/events";

type ObjectiveActivatedCallback = (objectiveName: string) => void;
type ObjectiveCompletedCallback = (
  objectiveName: string,
  outputVariables: Record<string, string>
) => void;
type ObjectivePendingCallback = (
  objectiveName: string,
  outputVariables: Record<string, string>
) => void;

interface ObjectiveProps {
  objective_name?: string;
  output_variables?: Record<string, string>;
}

function readField<T = unknown>(
  props: ObjectiveProps,
  top: ObjectiveProps,
  key: keyof ObjectiveProps
): T | undefined {
  return (props[key] ?? top[key]) as T | undefined;
}

export function useObjectiveEvents(
  onObjectiveActivated: ObjectiveActivatedCallback,
  onObjectiveCompleted: ObjectiveCompletedCallback,
  onObjectivePending?: ObjectivePendingCallback
) {
  const activatedRef = useRef(onObjectiveActivated);
  activatedRef.current = onObjectiveActivated;
  const completedRef = useRef(onObjectiveCompleted);
  completedRef.current = onObjectiveCompleted;
  const pendingRef = useRef(onObjectivePending);
  pendingRef.current = onObjectivePending;

  const handleEvent = useCallback((event: TavusEvent) => {
    if (
      event.event_type !== "conversation.objective.activated" &&
      event.event_type !== "conversation.objective.completed" &&
      event.event_type !== "conversation.objective.pending"
    ) {
      return;
    }

    const top = event as unknown as ObjectiveProps;
    const props = (event.properties as ObjectiveProps) ?? ({} as ObjectiveProps);

    if (event.event_type === "conversation.objective.activated") {
      const name = readField<string>(props, top, "objective_name");
      if (name) activatedRef.current(name);
      return;
    }

    if (event.event_type === "conversation.objective.completed") {
      const name = readField<string>(props, top, "objective_name");
      if (!name) return;
      const outputs =
        readField<Record<string, string>>(props, top, "output_variables") ?? {};
      completedRef.current(name, outputs);
      return;
    }

    if (event.event_type === "conversation.objective.pending") {
      const name = readField<string>(props, top, "objective_name");
      if (!name) return;
      const outputs =
        readField<Record<string, string>>(props, top, "output_variables") ?? {};
      pendingRef.current?.(name, outputs);
    }
  }, []);

  return { handleEvent };
}
