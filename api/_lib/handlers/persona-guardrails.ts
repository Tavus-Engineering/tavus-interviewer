/**
 * Handler: GET /api/persona/guardrails
 * Fetches guardrails from the Tavus API. A persona references guardrails via
 * `guardrail_ids` (an array of individual guardrails, often paired with
 * `guardrail_tags`): GET /v2/guardrails/{id} for each, collected into `data`.
 *
 * Returns the raw guardrail definitions (name, prompt, modality).
 */

import type { RouteRequest, RouteResponse } from "./types.js";
import { TAVUS_API_BASE } from "./tavus.js";

interface TavusGuardrail {
  guardrail_name: string;
  guardrail_prompt: string;
  modality: string;
}

/** Fetch a single guardrail by id and normalize to the shared shape. */
async function fetchGuardrailById(
  id: string,
  apiKey: string
): Promise<TavusGuardrail | null> {
  const res = await fetch(`${TAVUS_API_BASE}/v2/guardrails/${id}`, {
    headers: { "x-api-key": apiKey },
  });
  if (!res.ok) {
    console.warn(`[persona/guardrails] guardrail ${id} fetch failed:`, res.status);
    return null;
  }
  const g = (await res.json()) as Partial<TavusGuardrail>;
  if (!g.guardrail_name) return null;
  return {
    guardrail_name: g.guardrail_name,
    guardrail_prompt: g.guardrail_prompt ?? "",
    modality: g.modality ?? "verbal",
  };
}

export async function personaGuardrails(req: RouteRequest): Promise<RouteResponse> {
  if (req.method !== "GET") {
    return { status: 405, body: { error: "Method not allowed" } };
  }

  const apiKey = process.env.TAVUS_API_KEY;
  const personaId = req.query?.persona_id;

  if (!apiKey) {
    return { status: 500, body: { error: "TAVUS_API_KEY not configured" } };
  }
  if (!personaId) {
    return { status: 500, body: { error: "persona_id not provided — set persona_id in config/presets.config.json" } };
  }

  try {
    // Step 1: Get persona to find its guardrail_ids
    const personaRes = await fetch(
      `${TAVUS_API_BASE}/v2/personas/${personaId}`,
      { headers: { "x-api-key": apiKey } }
    );

    if (!personaRes.ok) {
      const text = await personaRes.text();
      console.error("[persona/guardrails] Persona fetch failed:", personaRes.status, text);
      return { status: personaRes.status, body: { error: text } };
    }

    const persona = (await personaRes.json()) as {
      guardrail_ids?: string[] | null;
    };

    // Resolve the array of individual guardrail ids. Fetch each and drop any
    // that fail so one bad id never blanks the whole column.
    const ids = persona.guardrail_ids ?? [];
    if (ids.length === 0) {
      return { status: 200, body: { data: [] } };
    }

    const fetched = await Promise.all(ids.map((id) => fetchGuardrailById(id, apiKey)));
    const data = fetched.filter((g): g is TavusGuardrail => g !== null);

    return { status: 200, body: { data } };
  } catch (err) {
    console.error("[persona/guardrails] Error:", err);
    return { status: 500, body: { error: "Failed to load guardrails" } };
  }
}
