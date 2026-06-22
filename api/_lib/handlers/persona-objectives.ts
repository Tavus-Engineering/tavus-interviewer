/**
 * Handler: GET /api/persona/objectives
 * Fetches objectives from the Tavus API by:
 *   1. GET /v2/personas/{persona_id} → objectives_id
 *   2. GET /v2/objectives/{objectives_id} → ordered objective list
 *
 * Returns objectives in chain order with human-readable labels.
 */

import type { RouteRequest, RouteResponse } from "./types.js";
import { TAVUS_API_BASE } from "./tavus.js";

interface TavusObjective {
  objective_name: string;
  objective_prompt: string;
  confirmation_mode?: string;
  output_variables?: string[];
  modality?: string;
  next_required_objective?: string;
}

/** Derive a human-readable label from the objective_name. */
function humanize(name: string): string {
  return name
    .replace(/^obj_/, "")
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Order objectives by following the next_required_objective chain. */
function orderObjectives(objectives: TavusObjective[]) {
  const byName = new Map(objectives.map((o) => [o.objective_name, o]));

  // Find the first objective (not referenced as next_required by any other)
  const nextTargets = new Set(
    objectives.map((o) => o.next_required_objective).filter(Boolean)
  );
  let first = objectives.find((o) => !nextTargets.has(o.objective_name));
  if (!first) first = objectives[0];

  const ordered: {
    objective_name: string;
    label: string;
    output_variables: string[];
  }[] = [];
  const visited = new Set<string>();
  let current: TavusObjective | undefined = first;

  while (current && !visited.has(current.objective_name)) {
    visited.add(current.objective_name);
    ordered.push({
      objective_name: current.objective_name,
      label: humanize(current.objective_name),
      output_variables: current.output_variables ?? [],
    });
    current = current.next_required_objective
      ? byName.get(current.next_required_objective)
      : undefined;
  }

  // Add any unchained objectives
  for (const obj of objectives) {
    if (!visited.has(obj.objective_name)) {
      ordered.push({
        objective_name: obj.objective_name,
        label: humanize(obj.objective_name),
        output_variables: obj.output_variables ?? [],
      });
    }
  }

  return ordered;
}

export async function personaObjectives(req: RouteRequest): Promise<RouteResponse> {
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
    // Step 1: Get persona to find objectives_id
    const personaRes = await fetch(
      `${TAVUS_API_BASE}/v2/personas/${personaId}`,
      { headers: { "x-api-key": apiKey } }
    );

    if (!personaRes.ok) {
      const text = await personaRes.text();
      console.error("[persona/objectives] Persona fetch failed:", personaRes.status, text);
      return { status: personaRes.status, body: { error: text } };
    }

    const persona = (await personaRes.json()) as { objectives_id?: string };
    const objectivesId = persona.objectives_id;

    if (!objectivesId) {
      return { status: 200, body: { objectives: [] } };
    }

    // Step 2: Fetch objectives
    const objectivesRes = await fetch(
      `${TAVUS_API_BASE}/v2/objectives/${objectivesId}`,
      { headers: { "x-api-key": apiKey } }
    );

    if (!objectivesRes.ok) {
      const text = await objectivesRes.text();
      console.error("[persona/objectives] Objectives fetch failed:", objectivesRes.status, text);
      return { status: objectivesRes.status, body: { error: text } };
    }

    const objectivesData = (await objectivesRes.json()) as { data?: TavusObjective[] };
    const rawObjectives: TavusObjective[] = objectivesData.data ?? [];
    const ordered = orderObjectives(rawObjectives);

    return { status: 200, body: { objectives: ordered } };
  } catch (err) {
    console.error("[persona/objectives] Error:", err);
    return { status: 500, body: { error: "Failed to load objectives" } };
  }
}
