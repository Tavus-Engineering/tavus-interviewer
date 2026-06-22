/**
 * Handler: POST /api/conversation/end
 * Ends an active conversation via the Tavus API.
 *
 * Tavus docs: https://docs.tavus.io/api-reference/conversations/end-conversation
 */

import type { RouteRequest, RouteResponse } from "./types.js";
import { TAVUS_API_BASE } from "./tavus.js";

export async function conversationEnd(req: RouteRequest): Promise<RouteResponse> {
  if (req.method !== "POST") {
    return { status: 405, body: { error: "Method not allowed" } };
  }

  const apiKey = process.env.TAVUS_API_KEY;
  if (!apiKey) {
    return { status: 500, body: { error: "TAVUS_API_KEY not configured" } };
  }

  const { conversation_id } = req.body ?? {};
  if (!conversation_id) {
    return { status: 400, body: { error: "conversation_id is required" } };
  }

  try {
    const response = await fetch(
      `${TAVUS_API_BASE}/v2/conversations/${conversation_id}/end`,
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("[conversation/end] Tavus API error:", response.status, text);
      return { status: response.status, body: { error: text } };
    }

    return { status: 200, body: { status: "ended" } };
  } catch (err) {
    console.error("[conversation/end] Unexpected error:", err);
    return { status: 500, body: { error: "Internal server error" } };
  }
}
