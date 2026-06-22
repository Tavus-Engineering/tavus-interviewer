/**
 * Handler: GET /api/persona/tools
 * Fetches the persona's tool definitions and active layer info from Tavus:
 *   1. GET /v2/personas/{persona_id}
 *   2. Extract tools from layers.llm.tools, layers.perception.visual_tools,
 *      layers.perception.audio_tools.
 *   3. Extract active layer identifiers (LLM model, TTS engine, perception
 *      model, Sparrow turn-detection model + turn-taking patience +
 *      replica interruptibility) so the inspector can surface real Tavus
 *      feature names instead of inferring them from objective output_variables.
 */

import type { RouteRequest, RouteResponse } from "./types.js";
import { TAVUS_API_BASE } from "./tavus.js";

interface TavusToolFunction {
  name?: string;
  description?: string;
}

interface TavusTool {
  type?: string;
  function?: TavusToolFunction;
}

interface TavusPersonaResponse {
  layers?: {
    llm?: {
      model?: string | null;
      tools?: TavusTool[];
    };
    tts?: {
      tts_engine?: string | null;
      tts_engine_name?: string | null;
    };
    perception?: {
      perception_model?: string | null;
      visual_tools?: TavusTool[];
      audio_tools?: TavusTool[];
    };
    conversational_flow?: {
      turn_detection_model?: string | null;
      turn_taking_patience?: string | null;
      replica_interruptibility?: string | null;
    };
  };
}

interface PersonaToolOut {
  name: string;
  description?: string;
}

/** Extract `{ name, description }` entries from a Tavus tool[] array. */
function mapTools(tools: TavusTool[] | undefined): PersonaToolOut[] {
  if (!Array.isArray(tools)) return [];
  return tools
    .map((t) => {
      const name = t?.function?.name;
      if (!name) return null;
      const description = t.function?.description;
      return description ? { name, description } : { name };
    })
    .filter((t): t is PersonaToolOut => t !== null);
}

/**
 * The dedicated tools endpoint (GET /v2/personas/{id}/tools?verbose=true) returns
 * a bare array of inline `{ name, description, parameters }` tools, but we also
 * tolerate OpenAI-style `{ type, function: { name, description } }` and
 * `{ tools }` / `{ data }` wrappers in case the shape varies.
 */
interface EndpointTool {
  type?: string;
  function?: { name?: string; description?: string };
  name?: string;
  description?: string;
}

function mapEndpointTools(payload: unknown): PersonaToolOut[] {
  const wrapper = payload as
    | { tools?: EndpointTool[]; data?: EndpointTool[] }
    | EndpointTool[]
    | null;
  const raw: EndpointTool[] = Array.isArray(wrapper)
    ? wrapper
    : wrapper?.tools ?? wrapper?.data ?? [];
  return raw
    .map((t) => {
      const name = t.function?.name ?? t.name;
      if (!name) return null;
      const description = t.function?.description ?? t.description;
      return description ? { name, description } : { name };
    })
    .filter((t): t is PersonaToolOut => t !== null);
}

export async function personaTools(req: RouteRequest): Promise<RouteResponse> {
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
    const personaRes = await fetch(
      `${TAVUS_API_BASE}/v2/personas/${personaId}`,
      { headers: { "x-api-key": apiKey } }
    );

    if (!personaRes.ok) {
      const text = await personaRes.text();
      console.error("[persona/tools] Persona fetch failed:", personaRes.status, text);
      return { status: personaRes.status, body: { error: text } };
    }

    const persona = (await personaRes.json()) as TavusPersonaResponse;
    const llm = persona.layers?.llm;
    const tts = persona.layers?.tts;
    const perception = persona.layers?.perception;
    const flow = persona.layers?.conversational_flow;

    const ttsEngine = tts?.tts_engine ?? tts?.tts_engine_name ?? null;
    const perceptionModel = perception?.perception_model ?? null;

    // LLM tools are sourced from the dedicated tools endpoint
    // (GET /v2/personas/{id}/tools?verbose=true). Fall back to the persona's
    // layers.llm.tools only if that endpoint is unavailable, so the inspector
    // never blanks out on an API hiccup.
    let llmTools = mapTools(llm?.tools);
    try {
      const toolsRes = await fetch(
        `${TAVUS_API_BASE}/v2/personas/${personaId}/tools?verbose=true`,
        { headers: { "x-api-key": apiKey } }
      );
      if (toolsRes.ok) {
        llmTools = mapEndpointTools(await toolsRes.json());
      } else {
        const text = await toolsRes.text();
        console.warn(
          `[persona/tools] tools endpoint ${toolsRes.status}; using persona layers.llm.tools:`,
          text
        );
      }
    } catch (err) {
      console.warn(
        "[persona/tools] tools endpoint error; using persona layers.llm.tools:",
        err
      );
    }

    return {
      status: 200,
      body: {
        llmTools,
        visualTools: mapTools(perception?.visual_tools),
        audioTools: mapTools(perception?.audio_tools),
        perceptionModel,
        layers: {
          llm: { model: llm?.model ?? null },
          tts: { engine: ttsEngine },
          perception: { model: perceptionModel },
          conversational_flow: {
            turn_detection_model: flow?.turn_detection_model ?? null,
            turn_taking_patience: flow?.turn_taking_patience ?? null,
            replica_interruptibility: flow?.replica_interruptibility ?? null,
          },
        },
      },
    };
  } catch (err) {
    console.error("[persona/tools] Error:", err);
    return { status: 500, body: { error: "Failed to load persona tools" } };
  }
}
