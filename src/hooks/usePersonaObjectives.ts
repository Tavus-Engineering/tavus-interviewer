/**
 * usePersonaObjectives.ts
 *
 * Fetches the persona's objectives from the server on mount.
 * Returns the objective list for dynamic progress tracking.
 *
 * Consumed by: App.tsx
 */

import { useState, useEffect } from "react";
import { fetchObjectives, type PersonaObjective } from "@/lib/tavus/fetchObjectives";

interface UsePersonaObjectivesReturn {
  objectives: PersonaObjective[] | null;
  isLoading: boolean;
  error: string | null;
}

export function usePersonaObjectives(personaId?: string): UsePersonaObjectivesReturn {
  const [objectives, setObjectives] = useState<PersonaObjective[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!personaId) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchObjectives(personaId)
      .then((data) => {
        if (!cancelled) {
          setObjectives(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load objectives");
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [personaId]);

  return { objectives, isLoading, error };
}
