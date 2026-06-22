/**
 * Vercel adapter: GET /api/persona/objectives
 * Thin wrapper that delegates to the shared handler.
 */

import type { VercelRequest, VercelResponse } from "../_lib/vercel.js";
import { personaObjectives } from "../_lib/handlers/persona-objectives.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const result = await personaObjectives({
    method: req.method ?? "GET",
    body: req.body,
    query: req.query as Record<string, string>,
  });
  return res.status(result.status).json(result.body);
}
