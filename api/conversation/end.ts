/**
 * Vercel adapter: POST /api/conversation/end
 * Thin wrapper that delegates to the shared handler.
 */

import type { VercelRequest, VercelResponse } from "../_lib/vercel.js";
import { conversationEnd } from "../_lib/handlers/conversation-end.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const result = await conversationEnd({
    method: req.method ?? "GET",
    body: req.body,
    query: req.query as Record<string, string>,
  });
  return res.status(result.status).json(result.body);
}
