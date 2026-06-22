/**
 * Vercel adapter: POST /api/conversation/create
 * Thin wrapper that delegates to the shared handler.
 */

import type { VercelRequest, VercelResponse } from "../_lib/vercel.js";
import { conversationCreate } from "../_lib/handlers/conversation-create.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const result = await conversationCreate({
    method: req.method ?? "GET",
    body: req.body,
    query: req.query as Record<string, string>,
  });
  return res.status(result.status).json(result.body);
}
