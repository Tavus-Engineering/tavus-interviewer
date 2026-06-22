/**
 * App.tsx
 *
 * Root component. Owns selected media-device IDs (camera/mic/speaker),
 * fetches per-persona objectives + guardrails + active layer info from the
 * single configured preset, and routes to the correct screen for the
 * current FSM phase.
 *
 * FSM: LOBBY → INTRO → QUESTIONING → RESULTS
 *
 * There is only one preset (the casting audition). The app boots directly into
 * the LobbyScreen and kicks off conversation creation in the background.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { LobbyScreen } from "@/screens/LobbyScreen";
import { InterviewScreen } from "@/screens/InterviewScreen";
import { ResultsScreen } from "@/screens/ResultsScreen";
import { ReportScreen } from "@/screens/ReportScreen";
import { Spinner } from "@/components/ui/Spinner";
import { useConversation } from "@/hooks/useConversation";
import { useInterviewState } from "@/hooks/useInterviewState";
import { useInterviewReport } from "@/hooks/useInterviewReport";
import { usePersonaObjectives } from "@/hooks/usePersonaObjectives";
import { usePersonaGuardrails } from "@/hooks/usePersonaGuardrails";
import { usePersonaTools } from "@/hooks/usePersonaTools";
import { presetsConfig } from "@/lib/config/loader";
import type { PerceptionObservation } from "@/types/interview";
import type { Utterance } from "@/hooks/useUtteranceEvents";

const INTERVIEW_PRESET = presetsConfig.presets[0];

export function App() {
  const conversation = useConversation();
  // Selected media devices — chosen in the Lobby, applied on Daily join.
  const [videoDeviceId, setVideoDeviceId] = useState<string | null>(null);
  const [audioDeviceId, setAudioDeviceId] = useState<string | null>(null);
  const [speakerDeviceId, setSpeakerDeviceId] = useState<string | null>(null);
  const { objectives: personaObjectives } = usePersonaObjectives(INTERVIEW_PRESET.persona_id);
  const { guardrails: personaGuardrails } = usePersonaGuardrails(INTERVIEW_PRESET.persona_id);
  const { perceptionModel, layers, visualTools, audioTools } = usePersonaTools(
    INTERVIEW_PRESET.persona_id
  );
  // The casting persona has no LLM tools — its tools are Raven perception
  // tools (visual + audio). Combine + dedupe by name for the inspector's
  // TOOLS section.
  const perceptionTools = useMemo(() => {
    const seen = new Set<string>();
    return [...visualTools, ...audioTools].filter((t) => {
      if (seen.has(t.name)) return false;
      seen.add(t.name);
      return true;
    });
  }, [visualTools, audioTools]);
  const interview = useInterviewState(personaObjectives);

  // Once the call ends (RESULTS), poll the conversation for the post-call
  // report tool's output. `showReport` toggles between the thank-you card and
  // the full report detail view — both live inside the RESULTS phase.
  const [showReport, setShowReport] = useState(false);
  const report = useInterviewReport(
    conversation.conversationId,
    interview.phase === "RESULTS"
  );

  // Fresh demo run starts with a clean perception history — the previous
  // run's sessionStorage entries are cleared on mount (this used to live on
  // the now-removed WelcomeScreen).
  useEffect(() => {
    try {
      sessionStorage.removeItem("ai-interviewer.perception-history");
    } catch {
      /* ignore */
    }
  }, []);

  // Conversation creation kicks off as soon as the app boots into the lobby.
  // Guarded so it only ever runs once per session even if the user navigates
  // back to LOBBY via the browser back button.
  useEffect(() => {
    if (
      interview.phase === "LOBBY" &&
      !conversation.conversationUrl &&
      !conversation.isCreating &&
      !conversation.error
    ) {
      conversation.create(
        INTERVIEW_PRESET.title,
        INTERVIEW_PRESET.persona_id,
        INTERVIEW_PRESET.replica_id
      );
    }
  }, [interview.phase, conversation]);

  const handleJoinInterview = useCallback(() => {
    interview.goToInterview();
  }, [interview]);

  const handleLeave = useCallback(
    (observations: PerceptionObservation[], utterances: Utterance[]) => {
      interview.finishInterview(observations, utterances);
    },
    [interview]
  );

  switch (interview.phase) {
    case "LOBBY":
      return (
        <LobbyScreen
          role={INTERVIEW_PRESET.title}
          isCreating={conversation.isCreating}
          error={conversation.error}
          videoDeviceId={videoDeviceId}
          audioDeviceId={audioDeviceId}
          speakerDeviceId={speakerDeviceId}
          onCameraChange={setVideoDeviceId}
          onMicChange={setAudioDeviceId}
          onSpeakerChange={setSpeakerDeviceId}
          onJoin={handleJoinInterview}
        />
      );

    case "INTRO":
    case "QUESTIONING":
      if (!conversation.conversationUrl) {
        return (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100vh",
              backgroundColor: "var(--color-page-bg, var(--color-background))",
            }}
          >
            <Spinner size={32} />
          </div>
        );
      }
      return (
        <InterviewScreen
          conversationUrl={conversation.conversationUrl}
          conversationId={conversation.conversationId}
          phase={interview.phase}
          objectives={interview.objectives}
          currentObjectiveIndex={interview.currentObjectiveIndex}
          progress={interview.progress}
          guardrails={personaGuardrails}
          tools={perceptionTools}
          perceptionModel={perceptionModel}
          layers={layers}
          videoDeviceId={videoDeviceId}
          audioDeviceId={audioDeviceId}
          speakerDeviceId={speakerDeviceId}
          onObjectiveActivated={interview.activateObjective}
          onObjectiveCompleted={interview.completeObjective}
          onLeave={handleLeave}
          onEndConversation={conversation.end}
        />
      );

    case "RESULTS":
      if (!interview.interviewResult) {
        return (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100vh",
              backgroundColor: "var(--color-page-bg, var(--color-background))",
            }}
          >
            <Spinner size={32} />
          </div>
        );
      }
      if (showReport) {
        return (
          <ReportScreen
            analysis={report.analysis}
            isAnalysisLoading={report.isLoading}
            analysisError={report.error}
            role={INTERVIEW_PRESET.title}
            onBack={() => setShowReport(false)}
            onRetry={report.retry}
          />
        );
      }
      return (
        <ResultsScreen
          onViewReport={() => setShowReport(true)}
          reportStatus={
            report.analysis ? "ready" : report.error ? "error" : "loading"
          }
        />
      );
  }
}
