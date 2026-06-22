/**
 * Route registry — maps URL paths to platform-agnostic handlers.
 *
 * Used by the Vite dev plugin and can be used by any other adapter
 * (Express, Cloudflare Workers, etc.) to mount all API routes at once.
 */

import type { RouteHandler } from "./types.js";
import { conversationCreate } from "./conversation-create.js";
import { conversationEnd } from "./conversation-end.js";
import { conversationGet } from "./conversation-get.js";
import { postCallResult } from "./post-call-result.js";
import { personaObjectives } from "./persona-objectives.js";
import { personaGuardrails } from "./persona-guardrails.js";
import { personaTools } from "./persona-tools.js";

export const routes: Record<string, RouteHandler> = {
  "/api/conversation/create": conversationCreate,
  "/api/conversation/end": conversationEnd,
  "/api/conversation/get": conversationGet,
  "/api/conversation/post-call-result": postCallResult,
  "/api/persona/objectives": personaObjectives,
  "/api/persona/guardrails": personaGuardrails,
  "/api/persona/tools": personaTools,
};
