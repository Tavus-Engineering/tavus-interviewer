/**
 * Vercel adapter: POST /api/conversation/post-call-result
 * Thin wrapper that delegates to the shared handler.
 */

import type { VercelRequest, VercelResponse } from "../_lib/vercel.js";
import { postCallResult } from "../_lib/handlers/post-call-result.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const result = await postCallResult({
    method: req.method ?? "GET",
    body: req.body,
    query: req.query as Record<string, string>,
  });
  return res.status(result.status).json(result.body);
}
