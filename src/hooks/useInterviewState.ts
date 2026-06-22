/**
 * useInterviewState.ts
 *
 * Owns the interview FSM and the live state attached to it: ordered
 * objective progress, captured persona tools, and the end-of-call
 * perception observations. Drives App.tsx routing.
 *
 * FSM:  WELCOME → LOBBY → INTRO → QUESTIONING → RESULTS
 *
 * Phase changes are mirrored into `window.location.hash` so the browser
 * back/forward buttons move between phases. INTRO/QUESTIONING are blocked
 * from popstate entry to avoid landing in an empty live screen.
 *
 * Objectives are seeded from the Tavus API (persona → objectives_id →
 * objectives). Unknown objectives that arrive in events are added on the
 * fly so the inspector stays in sync with whatever the persona actually fires.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type {
  InterviewPhase,
  ObjectiveProgress,
  InterviewResult,
  PerceptionObservation,
} from "@/types/interview";
import type { PersonaObjective } from "@/lib/tavus/fetchObjectives";
import type { Utterance } from "@/hooks/useUtteranceEvents";

const PHASE_TO_HASH: Record<InterviewPhase, string> = {
  WELCOME: "",
  LOBBY: "lobby",
  INTRO: "interview",
  QUESTIONING: "interview",
  RESULTS: "results",
};

const HASH_TO_PHASE: Record<string, InterviewPhase> = {
  "": "LOBBY",
  welcome: "LOBBY",
  lobby: "LOBBY",
  interview: "INTRO",
  results: "RESULTS",
};

function getPhaseFromHash(): InterviewPhase {
  const hash = window.location.hash.replace("#", "");
  return HASH_TO_PHASE[hash] ?? "LOBBY";
}

/** Humanize an objective_name for display. */
function humanize(name: string): string {
  return name
    .replace(/^obj_/, "")
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Compare two objective_names tolerantly. Some personas surface events as
 * `intro` while the API returns `obj_intro` (or vice versa). Normalize both
 * sides before matching so we update the existing row instead of appending
 * a stray duplicate.
 */
function objectiveKey(name: string): string {
  return name.replace(/^obj_/, "").toLowerCase();
}

function objectiveMatches(a: string, b: string): boolean {
  return objectiveKey(a) === objectiveKey(b);
}

export function useInterviewState(personaObjectives: PersonaObjective[] | null) {
  const [phase, setPhaseRaw] = useState<InterviewPhase>(getPhaseFromHash);
  const [objectives, setObjectives] = useState<ObjectiveProgress[]>([]);
  const [perceptionObservations, setPerceptionObservations] = useState<
    PerceptionObservation[]
  >([]);
  const [utterances, setUtterances] = useState<Utterance[]>([]);
  // Once flipped true by finishInterview, stays true for the lifetime of the
  // session. Used to gate `interviewResult` so its identity is stable across
  // re-renders.
  const [hasFinished, setHasFinished] = useState(false);

  // Phase changes from popstate must NOT push a new history entry, only
  // direct setPhase() calls do — otherwise back/forward double-pushes.
  const isPopstateRef = useRef(false);

  const setPhase = useCallback((newPhase: InterviewPhase) => {
    setPhaseRaw((prev) => {
      if (prev === newPhase) return prev;
      if (!isPopstateRef.current) {
        const hash = PHASE_TO_HASH[newPhase];
        window.history.pushState({ phase: newPhase }, "", hash ? `#${hash}` : window.location.pathname);
      }
      isPopstateRef.current = false;
      return newPhase;
    });
  }, []);

  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      const targetPhase: InterviewPhase = e.state?.phase ?? getPhaseFromHash();
      // Block back/forward into the live call — there's no conversation_url
      // when entering this way, which would leave the user staring at a spinner.
      if (targetPhase === "INTRO" || targetPhase === "QUESTIONING") return;
      isPopstateRef.current = true;
      setPhase(targetPhase);
    };
    window.addEventListener("popstate", onPopState);
    window.history.replaceState({ phase: getPhaseFromHash() }, "");
    return () => window.removeEventListener("popstate", onPopState);
  }, [setPhase]);

  const lastPersonaRef = useRef<PersonaObjective[] | null>(null);
  useEffect(() => {
    if (personaObjectives && personaObjectives.length > 0 && personaObjectives !== lastPersonaRef.current) {
      lastPersonaRef.current = personaObjectives;
      setObjectives(
        personaObjectives.map((o) => ({
          objective_name: o.objective_name,
          label: o.label,
          completed: false,
          activated: false,
        }))
      );
    }
  }, [personaObjectives]);

  const currentObjectiveIndex = useMemo(() => {
    // Prefer the most recently activated objective that hasn't completed
    // yet — Tavus sometimes activates the next objective before the
    // previous one's `completed` event fires, so falling back to "first
    // non-completed" would show the wrong objective as active mid-call.
    for (let i = objectives.length - 1; i >= 0; i--) {
      if (objectives[i].activated && !objectives[i].completed) return i;
    }
    // No activation yet (pre-call seed state) — fall back to the first
    // non-completed objective.
    return objectives.findIndex((o) => !o.completed);
  }, [objectives]);

  const currentObjective = useMemo(
    () => (currentObjectiveIndex >= 0 ? objectives[currentObjectiveIndex] : null),
    [objectives, currentObjectiveIndex]
  );

  const progress = useMemo(() => {
    const completed = objectives.filter((o) => o.completed).length;
    return { completed, total: objectives.length };
  }, [objectives]);

  const goToWelcome = useCallback(() => setPhase("WELCOME"), [setPhase]);
  const goToLobby = useCallback(() => setPhase("LOBBY"), [setPhase]);
  const goToInterview = useCallback(() => setPhase("INTRO"), [setPhase]);

  const activateObjective = useCallback((objectiveName: string) => {
    const now = Date.now();
    setObjectives((prev) => {
      const exists = prev.some((o) => objectiveMatches(o.objective_name, objectiveName));
      if (exists) {
        // Mark the existing entry as activated so the post-call inspector can
        // distinguish "reached during the call" from "preloaded but never fired".
        // Stamp `activatedAt` once (first activation wins).
        return prev.map((o) =>
          objectiveMatches(o.objective_name, objectiveName)
            ? { ...o, activated: true, activatedAt: o.activatedAt ?? now }
            : o
        );
      }
      // Persona may have fired an objective that wasn't in the seeded list
      // (e.g. dynamically inserted). Add it so the inspector keeps up.
      return [
        ...prev,
        {
          objective_name: objectiveName,
          label: humanize(objectiveName),
          completed: false,
          activated: true,
          activatedAt: now,
        },
      ];
    });
  }, []);

  const completeObjective = useCallback(
    (objectiveName: string, outputVariables: Record<string, string>) => {
      const now = Date.now();
      setObjectives((prev) => {
        let list = prev;

        if (!list.some((o) => objectiveMatches(o.objective_name, objectiveName))) {
          list = [
            ...list,
            {
              objective_name: objectiveName,
              label: humanize(objectiveName),
              completed: false,
              activated: true,
              activatedAt: now,
            },
          ];
        }

        const updated = list.map((o) =>
          objectiveMatches(o.objective_name, objectiveName)
            ? {
                ...o,
                completed: true,
                activated: true,
                activatedAt: o.activatedAt ?? now,
                completedAt: now,
                output_variables: outputVariables,
              }
            : o
        );

        // First objective completing is the signal that the intro has wrapped
        // and the structured questioning has begun.
        if (phase === "INTRO") {
          setPhase("QUESTIONING");
        }

        return updated;
      });
    },
    [phase, setPhase]
  );

  const finishInterview = useCallback(
    (observations: PerceptionObservation[], capturedUtterances?: Utterance[]) => {
      setPerceptionObservations(observations);
      if (capturedUtterances) {
        setUtterances(capturedUtterances);
      }
      setHasFinished(true);
      setPhase("RESULTS");
    },
    [setPhase]
  );

  const interviewResult: InterviewResult | null = useMemo(() => {
    if (!hasFinished) return null;
    const objectiveOutputs: Record<string, Record<string, string>> = {};
    for (const obj of objectives) {
      if (obj.output_variables) {
        objectiveOutputs[obj.objective_name] = obj.output_variables;
      }
    }
    return {
      objectives,
      perceptionObservations,
      objectiveOutputs,
      utterances,
    };
  }, [hasFinished, perceptionObservations, objectives, utterances]);

  return {
    phase,
    objectives,
    currentObjective,
    currentObjectiveIndex,
    progress,
    interviewResult,
    goToWelcome,
    goToLobby,
    goToInterview,
    activateObjective,
    completeObjective,
    finishInterview,
  };
}
