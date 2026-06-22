/**
 * events.ts
 *
 * Tavus interaction event payload types. These represent the shape of
 * events received via useObservableEvent from the Daily transport layer.
 *
 * Tavus docs: https://docs.tavus.io/sections/conversational-video-interface/interactions-protocols/overview
 */

/** Base shape for all Tavus conversation events. */
export interface TavusEvent {
  message_type: "conversation";
  event_type: string;
  seq: number;
  conversation_id: string;
  turn_idx: number;
  properties: Record<string, unknown>;
}

/** Fired when a Tavus objective is completed. */
export interface ObjectiveCompletedEvent extends TavusEvent {
  event_type: "conversation.objective.completed";
  properties: {
    objective_name: string;
    output_variables: Record<string, string>;
  };
}

/**
 * Fired ONCE at end of call with Raven perception analysis.
 *
 * NOTE: the in-call event type uses hyphens ("conversation.perception-analysis");
 * the webhook / verbose GET uses underscores ("application.perception_analysis").
 */
export interface PerceptionAnalysisEvent extends TavusEvent {
  event_type: "conversation.perception-analysis";
  properties: {
    analysis: string;
  };
}

/** Fired when a Tavus objective is activated. */
export interface ObjectiveActivatedEvent extends TavusEvent {
  event_type: "conversation.objective.activated";
  properties: {
    objective_name: string;
  };
}

/**
 * Fired for objectives whose `confirmation_mode === "manual"`. Tavus pauses the
 * objective and waits for the participant to send back a
 * `conversation.objective.confirm` app-message before advancing. The collected
 * values (if any) ride on `properties.output_variables` so the UI can let the
 * participant review/edit them before confirming.
 *
 * Tavus docs:
 *   https://docs.tavus.io/sections/conversational-video-interface/persona/objectives#objectives
 */
export interface ObjectivePendingEvent extends TavusEvent {
  event_type: "conversation.objective.pending";
  properties: {
    objective_name: string;
    output_variables?: Record<string, string>;
  };
}

/** Fired when the LLM invokes a tool call (e.g. end_conversation). */
export interface ToolCallEvent extends TavusEvent {
  event_type: "conversation.tool_call";
  properties: {
    name: string;
    arguments: string;
  };
}

/**
 * Fired when a Raven perception tool is triggered by visual or audio input.
 * Used to detect guardrail violations in real time.
 *
 * Tavus docs: https://docs.tavus.io/sections/event-schemas/conversation-perception-tool-call
 */
export interface PerceptionToolCallEvent extends TavusEvent {
  event_type: "conversation.perception_tool_call";
  properties: {
    name: string;
    modality: "vision" | "audio";
    arguments: Record<string, unknown> | string;
    frames?: Array<{ data: string; mime_type: string }>;
  };
}