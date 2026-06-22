/**
 * usePersonaTools.ts
 *
 * Fetches the persona's tool definitions (LLM tools, visual perception tools,
 * audio perception tools), the active perception model, and the active-layer
 * info (LLM model, TTS engine, perception model, Sparrow turn-detection model
 * / patience / interruptibility) from the server.
 *
 * Consumed by App.tsx — `layers` powers the inspector LAYERS header strip;
 * the static patience/interruptibility values feed the SPARROW column.
 */

import { useState, useEffect } from "react";
import { apiGet } from "@/lib/tavus/client";
import type { PersonaLayers, PersonaTool } from "@/types/interview";

const EMPTY_LAYERS: PersonaLayers = {
  llm: { model: null },
  tts: { engine: null },
  perception: { model: null },
  conversational_flow: {
    turn_detection_model: null,
    turn_taking_patience: null,
    replica_interruptibility: null,
  },
};

interface PersonaToolsResponse {
  llmTools: PersonaTool[];
  visualTools: PersonaTool[];
  audioTools: PersonaTool[];
  perceptionModel: string | null;
  layers?: PersonaLayers;
}

interface UsePersonaToolsReturn {
  llmTools: PersonaTool[];
  visualTools: PersonaTool[];
  audioTools: PersonaTool[];
  perceptionModel: string | null;
  layers: PersonaLayers;
  loading: boolean;
  error: string | null;
}

export function usePersonaTools(personaId?: string): UsePersonaToolsReturn {
  const [llmTools, setLlmTools] = useState<PersonaTool[]>([]);
  const [visualTools, setVisualTools] = useState<PersonaTool[]>([]);
  const [audioTools, setAudioTools] = useState<PersonaTool[]>([]);
  const [perceptionModel, setPerceptionModel] = useState<string | null>(null);
  const [layers, setLayers] = useState<PersonaLayers>(EMPTY_LAYERS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!personaId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const url = `/api/persona/tools?persona_id=${encodeURIComponent(personaId)}`;
    apiGet<PersonaToolsResponse>(url)
      .then((data) => {
        if (cancelled) return;
        setLlmTools(data.llmTools ?? []);
        setVisualTools(data.visualTools ?? []);
        setAudioTools(data.audioTools ?? []);
        setPerceptionModel(data.perceptionModel ?? null);
        setLayers(data.layers ?? EMPTY_LAYERS);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load persona tools");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [personaId]);

  return {
    llmTools,
    visualTools,
    audioTools,
    perceptionModel,
    layers,
    loading,
    error,
  };
}
