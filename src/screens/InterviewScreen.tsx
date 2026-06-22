/**
 * InterviewScreen.tsx
 *
 * Live audition session — replica video sits inside a monochrome
 * window-frame treatment (titlebar with status indicator + label +
 * decorative rules + close X). Beneath: the dark Developer Inspector
 * with live Sparrow turn-taking metrics + Raven visual/audio awareness.
 * Captions / text input / live transcript are housed in the TranscriptPanel
 * side panel, toggled via the CC button in the CallControlBar.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useDaily } from "@daily-co/daily-react";
import type { DailyCall } from "@daily-co/daily-js";
import { VideoProvider } from "@/components/video/VideoProvider";
import sampleAnswers from "../../persona/sample_answers.json";
import { ConversationView } from "@/components/video/ConversationView";
import { InteractionBus } from "@/components/video/InteractionBus";
import { GuardrailToast } from "@/components/interview/GuardrailToast";
import { CallControlBar } from "@/components/interview/CallControlBar";
import { TranscriptPanel } from "@/components/interview/TranscriptPanel";
import { Spinner } from "@/components/ui/Spinner";
import { type InspectorObjective } from "@/components/inspector/DeveloperInspector";
import { ObjectiveProgressBar } from "@/components/interview/ObjectiveProgressBar";
import { FloatingInspector } from "@/components/layout/FloatingInspector";

import { useIsMobile } from "@/hooks/useIsMobile";
import { useObjectiveEvents } from "@/hooks/useObjectiveEvents";
import { usePerceptionAnalysis } from "@/hooks/usePerceptionAnalysis";
import { useGuardrailEvents } from "@/hooks/useGuardrailEvents";
import { useGuardrailResponder } from "@/hooks/useGuardrailResponder";
import { useToolCallEvents } from "@/hooks/useToolCallEvents";
import { useUtteranceEvents, type Utterance } from "@/hooks/useUtteranceEvents";
import { useSparrowMetrics } from "@/hooks/useSparrowMetrics";
import { useSpeakingState } from "@/hooks/useSpeakingState";
import { useElapsedTime } from "@/hooks/useElapsedTime";
import { useEventLog } from "@/hooks/useEventLog";
import type { TavusEvent } from "@/types/events";
import type {
  ObjectiveProgress,
  InterviewPhase,
  PerceptionObservation,
  PersonaLayers,
  GuardrailDefinition,
  PersonaTool,
} from "@/types/interview";

/**
 * Tiny bridge component that lives inside <VideoProvider> so it can call
 * useDaily(), and reports the active Daily client back to InterviewScreen
 * via a callback. Lets us trigger `conversation.respond` from outside the
 * provider tree (e.g. the floating dev inspector button).
 */
function DailyClientBinder({ onClient }: { onClient: (d: DailyCall | null) => void }) {
  const daily = useDaily();
  const ref = useRef(onClient);
  ref.current = onClient;
  useEffect(() => {
    ref.current(daily ?? null);
  }, [daily]);
  return null;
}

/** Mutes the user's mic during the INTRO (greeting) phase, unmutes on QUESTIONING. */
function GreetingMute({ phase }: { phase: InterviewPhase }) {
  const daily = useDaily();
  const hasUnmutedRef = useRef(false);

  useEffect(() => {
    if (!daily) return;
    if (phase === "INTRO") {
      daily.setLocalAudio(false);
    } else if (phase === "QUESTIONING" && !hasUnmutedRef.current) {
      hasUnmutedRef.current = true;
      daily.setLocalAudio(true);
    }
  }, [daily, phase]);

  return null;
}

/** Max time (ms) to wait for Raven perception data after ending the conversation. */
const PERCEPTION_WAIT_MS = 2500;

/** Hard cap on call length, in seconds. Mirrors the `max_call_duration` sent
 *  to Tavus on conversation creation so the client-side auto-leave fires at
 *  the same moment the server force-ends the call. */
const MAX_CALL_DURATION_SECONDS = 600;

/** Grace period (ms) to keep the cold-read slide up after obj_coldread ends, so
 *  the actor's final line isn't clipped by completion-detection jitter. */
const COLD_READ_SLIDE_GRACE_MS = 3000;

interface InterviewScreenProps {
  conversationUrl: string;
  conversationId: string | null;
  phase: InterviewPhase;
  objectives: ObjectiveProgress[];
  currentObjectiveIndex: number;
  progress: { completed: number; total: number };
  guardrails?: GuardrailDefinition[];
  tools?: PersonaTool[];
  perceptionModel?: string | null;
  layers?: PersonaLayers;
  videoDeviceId?: string | null;
  audioDeviceId?: string | null;
  speakerDeviceId?: string | null;
  onObjectiveActivated: (name: string) => void;
  onObjectiveCompleted: (name: string, outputs: Record<string, string>) => void;
  onLeave: (observations: PerceptionObservation[], utterances: Utterance[]) => void;
  onEndConversation: () => void;
}

export function InterviewScreen({
  conversationUrl,
  conversationId,
  phase,
  objectives,
  currentObjectiveIndex,
  progress: _progress,
  guardrails = [],
  tools = [],
  perceptionModel = null,
  layers,
  videoDeviceId = null,
  audioDeviceId = null,
  speakerDeviceId = null,
  onObjectiveActivated,
  onObjectiveCompleted,
  onLeave,
  onEndConversation,
}: InterviewScreenProps) {
  const isMobile = useIsMobile();
  const { handleEvent: handleObjectiveEvent } = useObjectiveEvents(
    onObjectiveActivated,
    onObjectiveCompleted
  );
  const { observations, handleEvent: handlePerceptionEvent } = usePerceptionAnalysis();
  // Guardrail tracking is seeded from the persona's API guardrails (name +
  // modality), so the inspector stays data-pure — no hardcoded fallback list.
  const guardrailConfigs = useMemo(
    () =>
      guardrails.map((g) => ({
        guardrail_name: g.guardrail_name,
        modality: (g.modality === "visual" ? "visual" : "verbal") as "visual" | "verbal",
      })),
    [guardrails]
  );
  // Daily client lives inside <VideoProvider>; a binder component in the tree
  // populates this ref so we can send interactions from outside the provider.
  // Shared by the guardrail responder and the dev "inject answer" affordance.
  const dailyRef = useRef<DailyCall | null>(null);
  // When an actionable guardrail trips, prompt the replica to address it
  // in-character via conversation.respond (see useGuardrailResponder).
  const respondToViolation = useGuardrailResponder(dailyRef, conversationId);
  const {
    guardrails: guardrailStatuses,
    handleEvent: handleGuardrailEvent,
    toastMessage,
    dismissToast,
  } = useGuardrailEvents(guardrailConfigs, { onViolation: respondToViolation });
  const { handleEvent: handleToolCallEvent, toolStats } = useToolCallEvents();
  const {
    utterances,
    latestVisualAnalysis,
    latestAudioAnalysis,
    awarenessObservations,
    handleEvent: handleUtteranceEvent,
    appendUserText,
  } = useUtteranceEvents();
  // Mirror the latest utterances into a ref so the leave-effect (which
  // intentionally doesn't depend on `utterances` to avoid re-firing on every
  // new chunk) can still read the freshest list at leave-time.
  const utterancesRef = useRef<Utterance[]>(utterances);
  utterancesRef.current = utterances;
  // Live Raven awareness observations accumulate throughout the call; we
  // forward the final list at leave-time as a fallback for the report when
  // no end-of-call `conversation.perception-analysis` event fired.
  const awarenessObservationsRef = useRef<PerceptionObservation[]>([]);
  awarenessObservationsRef.current = awarenessObservations;
  const {
    turns,
    interruptions,
    handleEvent: handleSparrowEvent,
  } = useSparrowMetrics();
  // Live State vitals strip — who's speaking + elapsed call time.
  const { speaker, handleEvent: handleSpeakingEvent } = useSpeakingState();
  // Live CVI event log — feeds the developer panel's "Events" console tab.
  const { events, handleEvent: handleEventLog, clear: clearEvents } = useEventLog();
  const [captionsOpen, setCaptionsOpen] = useState(false);
  const handleToggleCaptions = useCallback(
    () => setCaptionsOpen((prev) => !prev),
    []
  );

  // --- Inject sample answer (dev-only demo affordance) ---
  // Reuses `dailyRef` (declared above, shared with the guardrail responder).
  const sampleAnswerData = (sampleAnswers as { data: Record<string, string> }).data;

  /** Try a few key variations so the JSON works whether the persona uses
   *  `intro` / `obj_intro` / etc. */
  const lookupSample = useCallback(
    (objectiveName: string | undefined): string | null => {
      if (!objectiveName) return null;
      const candidates = [
        objectiveName,
        objectiveName.replace(/^obj_/, ""),
        `obj_${objectiveName}`,
      ];
      for (const key of candidates) {
        if (sampleAnswerData[key]) return sampleAnswerData[key];
      }
      return null;
    },
    [sampleAnswerData]
  );

  const handleInjectAnswer = useCallback(() => {
    if (!dailyRef.current || !conversationId) {
      console.warn(
        "[InjectAnswer] no daily client / conversation_id yet — call may still be connecting"
      );
      return;
    }
    const objectiveName = objectives[currentObjectiveIndex]?.objective_name;
    const answer = lookupSample(objectiveName);
    if (!answer) {
      console.warn(
        "[InjectAnswer] no sample answer for the active objective:",
        objectiveName
      );
      return;
    }
    try {
      dailyRef.current.sendAppMessage(
        {
          message_type: "conversation",
          event_type: "conversation.respond",
          conversation_id: conversationId,
          properties: { text: answer },
        },
        "*"
      );
      // Mirror the typed-message behavior — Tavus doesn't echo
      // `conversation.respond` payloads back as utterance events, so
      // append a synthetic user entry locally to keep the transcript
      // honest.
      appendUserText(answer);
    } catch (err) {
      console.warn("[InjectAnswer] sendAppMessage failed:", err);
    }
  }, [
    conversationId,
    objectives,
    currentObjectiveIndex,
    lookupSample,
    sampleAnswerData,
    appendUserText,
  ]);

  // --- Leave flow: end conversation, wait for perception, then transition ---
  const [isLeaving, setIsLeaving] = useState(false);
  // Set when the replica fires the `end_conversation` tool. We don't tear the
  // call down immediately — the tool call typically arrives while Julian's
  // closing line is still being spoken — so a separate effect waits for him to
  // finish before leaving.
  const [endRequested, setEndRequested] = useState(false);
  const hasLeftRef = useRef(false);
  const onLeaveRef = useRef(onLeave);
  onLeaveRef.current = onLeave;

  const initiateLeave = useCallback(() => {
    if (isLeaving) return;
    setIsLeaving(true);
    onEndConversation();
  }, [isLeaving, onEndConversation]);

  // Elapsed call time for the vitals strip — freezes once the leave flow starts.
  const elapsedSeconds = useElapsedTime(!isLeaving);

  // 10-minute call cap. Starts ticking when this screen mounts with a valid
  // `conversationUrl` (App.tsx only mounts InterviewScreen once the URL is
  // ready, so this matches the moment the user actually enters the call) and
  // triggers a graceful leave when the cap is hit. Tavus also enforces the
  // cap server side via `max_call_duration` — this just keeps the client honest.
  useEffect(() => {
    if (!conversationUrl) return;
    if (isLeaving) return;
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      if (Math.floor((Date.now() - startedAt) / 1000) >= MAX_CALL_DURATION_SECONDS) {
        window.clearInterval(id);
        initiateLeave();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [conversationUrl, isLeaving, initiateLeave]);

  useEffect(() => {
    if (!isLeaving || hasLeftRef.current) return;

    // Prefer the structured end-of-call Raven analysis when it arrives. Fall
    // back to the in-call awareness observations accumulated from user
    // utterance events — this populates the report's perception section for
    // personas configured with awareness queries but no
    // `perception_analysis_queries` (so no end-of-call analysis event fires).
    const resolveObservations = () =>
      observations.length > 0 ? observations : awarenessObservationsRef.current;

    if (observations.length > 0) {
      hasLeftRef.current = true;
      onLeaveRef.current(resolveObservations(), utterancesRef.current);
      return;
    }

    const timer = setTimeout(() => {
      if (!hasLeftRef.current) {
        hasLeftRef.current = true;
        onLeaveRef.current(resolveObservations(), utterancesRef.current);
      }
    }, PERCEPTION_WAIT_MS);

    return () => clearTimeout(timer);
  }, [isLeaving, observations]);

  // Fallback close: once every objective is complete, the interview is over.
  // The persona is also told to fire the `end_conversation` tool at this point,
  // but tool-calling at end-of-call is not 100% reliable — so we auto-leave as
  // a backstop. We only arm the timer while nobody is speaking, and the timer
  // resets the moment Julian or the actor talks again (the effect re-runs
  // on every `speaker` change). This way the full closing exchange — including
  // any "any questions for me?" back-and-forth — finishes before we leave,
  // instead of a flat timer cutting Julian off mid-wrap-up.
  const allObjectivesDone =
    objectives.length > 0 && objectives.every((o) => o.completed);
  useEffect(() => {
    if (!allObjectivesDone || isLeaving) return;
    // Someone is still talking — don't arm the leave timer yet.
    if (speaker !== "silence") return;
    const timer = setTimeout(() => initiateLeave(), 15000);
    return () => clearTimeout(timer);
  }, [allObjectivesDone, isLeaving, speaker, initiateLeave]);

  // When the replica fires `end_conversation`, leave once it has stopped
  // speaking (so the closing line plays in full), but no later than a hard cap
  // so an explicit end can never hang the call.
  useEffect(() => {
    if (!endRequested || isLeaving) return;
    const grace = speaker === "silence" ? 2500 : 12000;
    const timer = setTimeout(() => initiateLeave(), grace);
    return () => clearTimeout(timer);
  }, [endRequested, isLeaving, speaker, initiateLeave]);

  const handleEndConversationEvent = useCallback(
    (event: TavusEvent) => {
      if (event.event_type !== "conversation.tool_call") return;
      const name = (event.properties as { name?: string }).name;
      if (name === "end_conversation") {
        setEndRequested(true);
      }
    },
    []
  );

  const handlers = useMemo(
    () => [
      handleObjectiveEvent,
      handlePerceptionEvent,
      handleToolCallEvent,
      handleEndConversationEvent,
      handleGuardrailEvent,
      handleUtteranceEvent,
      handleSparrowEvent,
      handleSpeakingEvent,
      handleEventLog,
    ],
    [
      handleObjectiveEvent,
      handlePerceptionEvent,
      handleToolCallEvent,
      handleEndConversationEvent,
      handleGuardrailEvent,
      handleUtteranceEvent,
      handleSparrowEvent,
      handleSpeakingEvent,
      handleEventLog,
    ]
  );

  const formatClock = (ms?: number): string | undefined => {
    if (!ms) return undefined;
    const d = new Date(ms);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  const inspectorObjectives: InspectorObjective[] = objectives.map((o, i) => {
    const status: InspectorObjective["status"] = o.completed
      ? "done"
      : i === currentObjectiveIndex
        ? "active"
        : // An earlier objective whose `completed` event hasn't fired yet
          // but a later one has activated — treat it as done so the visual
          // state matches what the conversation has already moved past.
          o.activated && currentObjectiveIndex >= 0 && i < currentObjectiveIndex
          ? "done"
          : "pending";
    return {
      label: o.label,
      objectiveName: o.objective_name,
      status,
      // Only show a real completion time. An objective's activation instant
      // equals the previous objective's completion instant (one ends as the
      // next begins), so stamping active rows — or done rows that lack a real
      // completion event — with `activatedAt` made adjacent rows read as the
      // same time. Rows without a genuine `completedAt` show no timestamp.
      timestamp: o.completedAt ? formatClock(o.completedAt) : undefined,
    };
  });

  // On-screen slide (Tavus presentation skill). The persona has the presentation
  // skill attached with the Starfall "sides" document (slides_trigger on_demand),
  // so Julian brings the slide up during the cold read.
  //
  // The presentation skill leaves the screen-share track published after the
  // moment ends — it never drops it — so this client gate is the ONLY teardown.
  // We show the slide while obj_coldread is the active beat, then hide it a few
  // seconds after the beat ends. obj_coldread now completes only once both
  // captain lines have been read (see its objective prompt), so the slide stays
  // up for the whole two-line read and drops right after; the short grace
  // absorbs completion-detection jitter so the actor's last line isn't clipped.
  const activeObjectiveName =
    objectives[currentObjectiveIndex]?.objective_name ?? "";
  const activeBeat = activeObjectiveName.replace(/^obj_/, "").toLowerCase();
  const [showPresentation, setShowPresentation] = useState(false);
  useEffect(() => {
    if (activeBeat === "coldread") {
      setShowPresentation(true);
      return;
    }
    const t = window.setTimeout(
      () => setShowPresentation(false),
      COLD_READ_SLIDE_GRACE_MS
    );
    return () => window.clearTimeout(t);
  }, [activeBeat]);

  return (
    <div className="theme-light live-shell">
      <div className="live-content" style={{ animation: "fadeInUp 400ms ease both" }}>
        <ObjectiveProgressBar objectives={inspectorObjectives} />
        <div className="live-frame">

          {/* Video + transcript row. The VideoProvider must wrap BOTH the
              video and the TranscriptPanel because TranscriptPanel uses
              `useDaily()` to send `conversation.respond` messages. When the
              transcript is open, the video shrinks (flex: 1) and the panel
              sits beside it in flow at 340px wide. */}
          <VideoProvider>
            <DailyClientBinder
              onClient={(d) => {
                dailyRef.current = d;
              }}
            />
            <div
              style={{
                display: "flex",
                // Mobile stacks the transcript under the video as a bottom
                // sheet; desktop keeps it beside the video in a row.
                flexDirection: isMobile ? "column" : "row",
                width: "100%",
                height: "100%",
                // Transparent so the white gutter — not a black fill — shows in
                // the gap the transcript panel leaves beside the dev inspector.
                background: "transparent",
                overflow: "hidden",
              }}
            >
              {/* Video area — keeps its own positioning context so the
                  picture-in-picture self-view stays anchored to the video,
                  not to the wrapper row. */}
              <div
                className="live__video"
                style={{
                  position: "relative",
                  flex: "1 1 auto",
                  minWidth: 0,
                  // minHeight:0 lets the video shrink when the transcript
                  // bottom sheet claims part of the column on mobile.
                  minHeight: 0,
                  height: isMobile ? "auto" : "100%",
                  // Override the fixed height from .live__video — the row
                  // controls height now so the panel can match it.
                  width: "auto",
                }}
              >
                <ConversationView
                  conversationUrl={conversationUrl}
                  onLeave={initiateLeave}
                  videoDeviceId={videoDeviceId}
                  audioDeviceId={audioDeviceId}
                  speakerDeviceId={speakerDeviceId}
                  showPresentation={showPresentation}
                >
                  <InteractionBus handlers={handlers} />
                  <GreetingMute phase={phase} />
                  <GuardrailToast message={toastMessage} onDismiss={dismissToast} />
                  <CallControlBar
                    onEndCall={initiateLeave}
                    captionsOpen={captionsOpen}
                    onToggleCaptions={handleToggleCaptions}
                  />
                </ConversationView>
                {isLeaving && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "column",
                      gap: 12,
                      background: "#020202",
                      color: "#FFFFFF",
                      fontSize: 15,
                      letterSpacing: "0.01em",
                      zIndex: 10,
                    }}
                  >
                    <Spinner size={24} color="#FFFFFF" />
                    <span>Wrapping up your audition...</span>
                  </div>
                )}
              </div>

              {/* Transcript panel sits beside the video when open. */}
              {captionsOpen && (
                <TranscriptPanel
                  utterances={utterances}
                  conversationId={conversationId}
                  onClose={() => setCaptionsOpen(false)}
                  onUserTextSent={appendUserText}
                />
              )}
            </div>
          </VideoProvider>
        </div>

        <FloatingInspector
          objectives={inspectorObjectives}
          guardrails={guardrailStatuses}
          tools={tools}
          toolStats={toolStats}
          perceptionModel={perceptionModel}
          layers={layers}
          status={isLeaving ? "shutting-down" : "active"}
          elapsedSeconds={elapsedSeconds}
          speaker={speaker}
          turns={turns}
          interruptions={interruptions}
          conversationId={conversationId}
          visualAnalysis={latestVisualAnalysis}
          audioAnalysis={latestAudioAnalysis}
          callActive={true}
          onInjectAnswer={handleInjectAnswer}
          events={events}
          onClearEvents={clearEvents}
        />
      </div>
    </div>
  );
}
