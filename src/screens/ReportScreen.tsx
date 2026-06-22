/**
 * ReportScreen.tsx
 *
 * Casting-facing detail view of the generated analysis. Contains the score
 * row, summary paragraph, perception bars, story breakdown, and transcript
 * highlights — driven by the InterviewAnalysis read from the persona's
 * `submit_audition_report` post-call tool (via useInterviewReport).
 *
 * Consumed by: App.tsx (RESULTS phase, "View report")
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import type { InterviewAnalysis, InterviewScores } from "@/types/interview";

interface ReportScreenProps {
  analysis: InterviewAnalysis | null;
  isAnalysisLoading: boolean;
  analysisError: string | null;
  role?: string;
  durationMinutes?: number;
  interviewerName?: string;
  onBack: () => void;
  /** Re-pulls the conversation to check for the post-call report again. */
  onRetry: () => void;
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "report"
  );
}

/** Triggers a client-side download of `content` as a Markdown file. */
function downloadMarkdown(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Renders the on-screen report data into a Markdown document. */
function buildInterviewMarkdown(opts: {
  role: string;
  durationMinutes: number;
  interviewerName: string;
  scores: InterviewScores | null;
  summary?: string;
  bars: NonNullable<InterviewAnalysis["perceptionBars"]>;
  star: NonNullable<InterviewAnalysis["starBreakdown"]> | null;
  highlights: NonNullable<InterviewAnalysis["transcriptHighlights"]>;
}): string {
  const { role, durationMinutes, interviewerName, scores, summary, bars, star, highlights } = opts;
  const lines: string[] = [];
  lines.push(`# Audition Report — ${role}`, "");
  lines.push(`_Auditioned yesterday · ${durationMinutes} min · ${interviewerName}_`, "");

  if (scores) {
    lines.push("## Scores", "");
    lines.push(`- **Overall:** ${scores.overall.toFixed(1)} / 10`);
    lines.push(`- **Craft:** ${scores.technical.toFixed(1)}`);
    lines.push(`- **Presence:** ${scores.communication.toFixed(1)}`);
    lines.push(`- **Story structure:** ${scores.starAdherence.toFixed(1)}`, "");
  }
  if (summary) {
    lines.push("## Summary", "", summary, "");
  }
  if (bars.length > 0) {
    lines.push("## Perception signals over time", "");
    for (const b of bars) lines.push(`- **${b.label}:** ${b.value}`);
    lines.push("");
  }
  if (star) {
    lines.push("## Story breakdown", "");
    lines.push(`- **Situation:** ${star.situation}`);
    lines.push(`- **Task:** ${star.task}`);
    lines.push(`- **Action:** ${star.action}`);
    lines.push(`- **Result:** ${star.result}`, "");
  }
  if (highlights.length > 0) {
    lines.push("## Transcript — key moments flagged", "");
    for (const h of highlights) lines.push(`- **${h.timestamp} · ${h.label}** — "${h.quote}"`);
    lines.push("");
  }
  return lines.join("\n");
}

export function ReportScreen({
  analysis,
  isAnalysisLoading,
  analysisError,
  role = "Starfall Lead",
  durationMinutes = 10,
  interviewerName = "Julian (AI Casting Director)",
  onBack,
  onRetry,
}: ReportScreenProps) {
  const isLoading = isAnalysisLoading;
  const error = analysisError;

  // The AI occasionally returns the per-axis scores but leaves `overall` as 0
  // (or omits it). Treat 0 as "not scored" and derive overall as the mean of
  // the three real measurements so the report never shows "0.0" alongside
  // healthy axis values.
  const rawScores = analysis?.scores ?? null;
  const scores: InterviewScores | null = rawScores
    ? {
        ...rawScores,
        overall:
          rawScores.overall && rawScores.overall > 0
            ? rawScores.overall
            : (rawScores.technical + rawScores.communication + rawScores.starAdherence) / 3,
      }
    : null;
  const bars = analysis?.perceptionBars ?? [];
  const star = analysis?.starBreakdown ?? null;
  const highlights = analysis?.transcriptHighlights ?? [];
  const summary = analysis?.summary;

  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2400);
  }, []);
  useEffect(
    () => () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    },
    []
  );

  const handleExport = useCallback(() => {
    if (!analysis) {
      showToast("Report is still generating — try again in a moment.");
      return;
    }
    const md = buildInterviewMarkdown({
      role,
      durationMinutes,
      interviewerName,
      scores,
      summary,
      bars,
      star,
      highlights,
    });
    downloadMarkdown(`audition-report-${slugify(role)}.md`, md);
    showToast("Report exported as Markdown.");
  }, [
    analysis,
    role,
    durationMinutes,
    interviewerName,
    scores,
    summary,
    bars,
    star,
    highlights,
    showToast,
  ]);

  return (
    <div className="theme-light screen-shell">
      <div className="report" style={{ animation: "fadeInUp 400ms ease both" }}>
        <div className="report__header">
          <div>
            <button type="button" className="report__back" onClick={onBack}>
              ← Back
            </button>
            <p className="report__eyebrow">Generated report</p>
            <h1 className="report__title">Audition · {role}</h1>
            <p className="report__subtitle">
              Auditioned today · {durationMinutes} min · {interviewerName}
            </p>
          </div>
          <div className="report__actions">
            <button type="button" className="btn-outline" onClick={handleExport}>
              Export
            </button>
          </div>
        </div>

        {/* Loading / error states */}
        {isLoading && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 24,
              fontSize: 13,
              color: "var(--color-text-muted)",
            }}
          >
            <Spinner size={14} />
            <span>Generating report from audition data...</span>
          </div>
        )}
        {error && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              padding: 12,
              border: "1px solid var(--color-destructive)",
              color: "var(--color-destructive)",
              fontSize: 13,
              marginBottom: 24,
            }}
          >
            <span>{error}</span>
            <button
              type="button"
              className="btn-outline"
              onClick={onRetry}
              style={{ alignSelf: "flex-start" }}
            >
              Try again
            </button>
          </div>
        )}

        {/* Group A — everything from the audition itself (performance + transcript). */}
        <div className="report__group-label">From the audition</div>

        {/* Score row — shown only once analysis resolves */}
        {scores && (
          <div className="report__scores">
            <div className="report__score">
              <div className="report__score-label">Overall</div>
              <div className="report__score-value">
                {scores.overall.toFixed(1)} <sub>/ 10</sub>
              </div>
            </div>
            <div className="report__score">
              <div className="report__score-label">Craft</div>
              <div className="report__score-value">{scores.technical.toFixed(1)}</div>
            </div>
            <div className="report__score">
              <div className="report__score-label">Presence</div>
              <div className="report__score-value">{scores.communication.toFixed(1)}</div>
            </div>
            <div className="report__score">
              <div className="report__score-label">Story structure</div>
              <div className="report__score-value">{scores.starAdherence.toFixed(1)}</div>
            </div>
          </div>
        )}

        {/* SUMMARY */}
        <section className="report__section">
          <div className="report__section-label">Summary</div>
          <p className="report__summary-body">
            {summary || "Summary will appear once analysis is complete."}
          </p>
        </section>

        {/* STORY BREAKDOWN */}
        <section className="report__section">
          <div className="report__section-label">Story breakdown</div>
          {star ? (
            <div className="report__star-grid">
              <div className="report__star-cell">
                <div className="report__star-label">Situation</div>
                <div className="report__star-text">{star.situation}</div>
              </div>
              <div className="report__star-cell">
                <div className="report__star-label">Task</div>
                <div className="report__star-text">{star.task}</div>
              </div>
              <div className="report__star-cell">
                <div className="report__star-label">Action</div>
                <div className="report__star-text">{star.action}</div>
              </div>
              <div className="report__star-cell">
                <div className="report__star-label">Result</div>
                <div className="report__star-text">{star.result}</div>
              </div>
            </div>
          ) : (
            <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
              Story breakdown will appear once analysis is complete.
            </p>
          )}
        </section>

        {/* TRANSCRIPT HIGHLIGHTS */}
        <section className="report__section">
          <div className="report__section-label">Transcript · key moments flagged</div>
          <div className="report__highlights">
            {highlights.length === 0 && (
              <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
                No transcript highlights available yet.
              </p>
            )}
            {highlights.map((h, i) => (
              <div key={`${h.timestamp}-${i}`} className="report__highlight">
                <div className="report__highlight-meta">
                  {h.timestamp} · {h.label}
                </div>
                <div className="report__highlight-quote">"{h.quote}"</div>
              </div>
            ))}
          </div>
        </section>

        {/* Group B — perception-derived signals (Raven, from video & audio),
            kept visually distinct from the audition performance data. */}
        {bars.length > 0 && (
          <>
            <div className="report__group-label report__group-label--perception">
              From video &amp; audio · perception
            </div>
            <section className="report__section report__perception">
              <div className="report__section-label">Observed by perception · Raven</div>
              <p className="report__perception-caption">
                Inferred by our perception model from the actor's video &amp; audio during the
                audition — not from what was said.
              </p>
              <div className="report__bars">
                {bars.map((b) => (
                  <div key={b.label} className="report__bar-row">
                    <div className="report__bar-label">{b.label}</div>
                    <div className="report__bar-track">
                      <div
                        className={`report__bar-fill${b.warn ? " report__bar-fill--warn" : ""}`}
                        style={{ width: `${Math.max(0, Math.min(100, b.percent))}%` }}
                      />
                    </div>
                    <div className="report__bar-value">{b.value}</div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>

      {toast && (
        <div className="demo-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}
