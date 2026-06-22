/**
 * Vercel adapter: GET /api/persona/tools
 * Thin wrapper that delegates to the shared handler.
 */

import type { VercelRequest, VercelResponse } from "../_lib/vercel.js";
import { personaTools } from "../_lib/handlers/persona-tools.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const result = await personaTools({
    method: req.method ?? "GET",
    body: req.body,
    query: req.query as Record<string, string>,
  });
  return res.status(result.status).json(result.body);
}
