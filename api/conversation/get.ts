/**
 * Vercel adapter: GET /api/conversation/get
 * Thin wrapper that delegates to the shared handler.
 */

import type { VercelRequest, VercelResponse } from "../_lib/vercel.js";
import { conversationGet } from "../_lib/handlers/conversation-get.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const result = await conversationGet({
    method: req.method ?? "GET",
    body: req.body,
    query: req.query as Record<string, string>,
  });
  return res.status(result.status).json(result.body);
}
