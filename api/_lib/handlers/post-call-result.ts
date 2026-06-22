/**
 * Handler: POST /api/conversation/post-call-result
 *
 * Delivery destination for the persona's `submit_audition_report` post-call
 * tool. Tavus POSTs the AI-filled report body here once the call ends. The app
 * actually reads the report back from the conversation's
 * `application.post_call_action_executed` event (verbose GET) — this endpoint
 * exists so the tool's delivery resolves with a clean 200 instead of erroring.
 */

import type { RouteRequest, RouteResponse } from "./types.js";

export async function postCallResult(req: RouteRequest): Promise<RouteResponse> {
  if (req.method !== "POST") {
    return { status: 405, body: { error: "Method not allowed" } };
  }
  return { status: 200, body: { received: true } };
}
