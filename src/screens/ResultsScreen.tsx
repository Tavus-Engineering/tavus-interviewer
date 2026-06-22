/**
 * ResultsScreen.tsx
 *
 * End-of-call thank-you card with a link into the generated casting report
 * (produced by the persona's `submit_audition_report` post-call tool).
 *
 * The report tool runs a few seconds *after* the call ends, so the "View report"
 * button stays disabled — cycling through status copy — until the report is
 * ready (or generation errors out, in which case ReportScreen shows the error).
 */

import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/Spinner";

/** Status copy cycled while the post-call report is still generating. */
const GENERATING_STEPS = [
  "Reading transcript…",
  "Reviewing visuals…",
  "Scoring your read…",
  "Finalizing report…",
];
const STEP_INTERVAL_MS = 8000;

/** Advances through the generating steps while `active`, holding on the last. */
function useGeneratingStep(active: boolean): string {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!active) {
      setIndex(0);
      return;
    }
    const id = window.setInterval(() => {
      setIndex((i) => Math.min(i + 1, GENERATING_STEPS.length - 1));
    }, STEP_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [active]);
  return GENERATING_STEPS[index];
}

interface ResultsScreenProps {
  onViewReport: () => void;
  /** "loading" while the post-call report generates — gates the button. */
  reportStatus: "loading" | "ready" | "error";
}

export function ResultsScreen({ onViewReport, reportStatus }: ResultsScreenProps) {
  const isGenerating = reportStatus === "loading";
  const stepLabel = useGeneratingStep(isGenerating);

  return (
    <div className="theme-light results-shell">
      <div className="results-content" style={{ animation: "fadeInUp 400ms ease both" }}>
        <h1 className="results-heading">
          That's a wrap.<br />
          Thanks for playing.
        </h1>
        <p className="results-desc">
          The casting team will sit with your tape and circle back. Go enjoy the
          rest of your day.
        </p>
        <div style={{ marginTop: 8 }}>
          {isGenerating ? (
            <button type="button" className="btn-primary" disabled aria-live="polite">
              <Spinner size={16} color="#FFFFFF" />
              {stepLabel}
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={onViewReport}>
              View report
              <span aria-hidden="true">→</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
