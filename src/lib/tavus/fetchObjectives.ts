/**
 * fetchObjectives.ts
 *
 * Fetches the persona's objectives from the server-side proxy.
 *
 * Consumed by: hooks/usePersonaObjectives.ts
 */

import { apiGet } from "./client";

export interface PersonaObjective {
  objective_name: string;
  label: string;
  output_variables: string[];
}

interface ObjectivesResponse {
  objectives: PersonaObjective[];
}

export async function fetchObjectives(personaId?: string): Promise<PersonaObjective[]> {
  const url = personaId
    ? `/api/persona/objectives?persona_id=${encodeURIComponent(personaId)}`
    : "/api/persona/objectives";
  const data = await apiGet<ObjectivesResponse>(url);
  return data.objectives;
}
