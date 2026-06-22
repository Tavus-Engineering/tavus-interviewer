/**
 * fetchGuardrails.ts
 *
 * Fetches the persona's guardrails from the server-side proxy.
 *
 * Consumed by: hooks/usePersonaGuardrails.ts
 */

import { apiGet } from "./client";
import type { GuardrailDefinition } from "@/types/interview";

interface GuardrailsResponse {
  data: GuardrailDefinition[];
}

export async function fetchGuardrails(personaId?: string): Promise<GuardrailDefinition[]> {
  const url = personaId
    ? `/api/persona/guardrails?persona_id=${encodeURIComponent(personaId)}`
    : "/api/persona/guardrails";
  const data = await apiGet<GuardrailsResponse>(url);
  return data.data;
}
