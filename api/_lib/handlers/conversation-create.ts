/**
 * Handler: POST /api/conversation/create
 * Creates a new conversation via the Tavus API.
 *
 * Tavus docs: https://docs.tavus.io/api-reference/conversations/create-conversation
 */

import type { RouteRequest, RouteResponse } from "./types.js";
import { TAVUS_API_BASE } from "./tavus.js";

export async function conversationCreate(req: RouteRequest): Promise<RouteResponse> {
  if (req.method !== "POST") {
    return { status: 405, body: { error: "Method not allowed" } };
  }

  const apiKey = process.env.TAVUS_API_KEY;

  if (!apiKey) {
    return { status: 500, body: { error: "TAVUS_API_KEY not configured" } };
  }

  const {
    role,
    conversationalContext,
    persona_id,
    replica_id,
    properties: incomingProperties,
  } = (req.body ?? {}) as {
    role?: string;
    conversationalContext?: string;
    persona_id?: string;
    replica_id?: string;
    properties?: Record<string, unknown>;
  };

  const personaId = persona_id;
  const replicaId = replica_id;

  if (!personaId) {
    return { status: 500, body: { error: "No persona_id provided — set persona_id in config/presets.config.json" } };
  }

  // Merge any incoming `properties` with the closed-captions toggle and the
  // server-enforced 10-minute max call duration. Closed captions only flow
  // through `conversation.utterance` events when the conversation was
  // created with `enable_closed_captions: true`. `max_call_duration` (in
  // seconds) lets Tavus end the call automatically once the cap is reached.
  const mergedProperties: Record<string, unknown> = {
    ...(incomingProperties ?? {}),
    enable_closed_captions: true,
    max_call_duration: 600,
  };

  const payload: Record<string, unknown> = {
    persona_id: personaId,
    conversation_name: `Interview — ${role ?? "Unknown Role"}`,
    properties: mergedProperties,
  };

  if (replicaId) {
    payload.replica_id = replicaId;
  }

  if (conversationalContext) {
    payload.conversational_context = conversationalContext;
  }

  try {
    const response = await fetch(`${TAVUS_API_BASE}/v2/conversations`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[conversation/create] Tavus API error:", response.status, text);
      return { status: response.status, body: { error: text } };
    }

    const data = await response.json();
    return { status: 200, body: data };
  } catch (err) {
    console.error("[conversation/create] Unexpected error:", err);
    return { status: 500, body: { error: "Internal server error" } };
  }
}
