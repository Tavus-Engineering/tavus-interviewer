/**
 * Handler: GET /api/conversation/get?conversation_id=...
 * Fetches a conversation with `verbose=true` so the response includes the
 * `events[]` array — including `application.post_call_action_executed`, which
 * carries the post-call report tool's rendered request body.
 *
 * Tavus docs: https://docs.tavus.io/api-reference/conversations/get-conversation
 */

import type { RouteRequest, RouteResponse } from "./types.js";
import { TAVUS_API_BASE } from "./tavus.js";

export async function conversationGet(req: RouteRequest): Promise<RouteResponse> {
  if (req.method !== "GET") {
    return { status: 405, body: { error: "Method not allowed" } };
  }

  const apiKey = process.env.TAVUS_API_KEY;
  if (!apiKey) {
    return { status: 500, body: { error: "TAVUS_API_KEY not configured" } };
  }

  const conversationId = req.query?.conversation_id;
  if (!conversationId) {
    return { status: 400, body: { error: "conversation_id is required" } };
  }

  try {
    const response = await fetch(
      `${TAVUS_API_BASE}/v2/conversations/${conversationId}?verbose=true`,
      { headers: { "x-api-key": apiKey } }
    );

    const text = await response.text();
    if (!response.ok) {
      console.error("[conversation/get] Tavus API error:", response.status, text);
      return { status: response.status, body: { error: text } };
    }

    return { status: 200, body: JSON.parse(text) };
  } catch (err) {
    console.error("[conversation/get] Unexpected error:", err);
    return { status: 500, body: { error: "Internal server error" } };
  }
}
