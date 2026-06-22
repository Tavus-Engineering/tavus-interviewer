/**
 * usePersonaGuardrails.ts
 *
 * Fetches the persona's guardrails from the server on mount.
 * Returns the guardrail list so the inspector can render real names from the API.
 *
 * Consumed by: App.tsx
 */

import { useState, useEffect } from "react";
import { fetchGuardrails } from "@/lib/tavus/fetchGuardrails";
import type { GuardrailDefinition } from "@/types/interview";

interface UsePersonaGuardrailsReturn {
  guardrails: GuardrailDefinition[];
  loading: boolean;
  error: string | null;
}

export function usePersonaGuardrails(personaId?: string): UsePersonaGuardrailsReturn {
  const [guardrails, setGuardrails] = useState<GuardrailDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!personaId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchGuardrails(personaId)
      .then((data) => {
        if (!cancelled) {
          setGuardrails(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load guardrails");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [personaId]);

  return { guardrails, loading, error };
}
