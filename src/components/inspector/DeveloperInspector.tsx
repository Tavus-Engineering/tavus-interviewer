/**
 * DeveloperInspector.tsx
 *
 * Zone 2 of the developer panel — the Inspector tab. Stacked, full-width
 * sections (the panel is a tall, narrow right-dock) where every item is
 * stateful + timestamped rather than a static list:
 *
 *   1. OBJECTIVES   — status + transition timestamp ("✓ Greeting · 08:30:14")
 *   2. GUARDRAILS   — last-evaluated time + violation-count badge; row turns
 *                     red on violation and surfaces the reason + a link to the
 *                     triggering event in Zone 3
 *   3. TOOLS        — each defined tool with call count + last args
 *   4. PERCEPTION   — combined visual/audio Raven streaming log (unchanged)
 *
 * All data flows from props sourced from the Tavus API or live CVI events.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { GuardrailStatus, PersonaLayers, PersonaTool } from "@/types/interview";
import type { ToolStats } from "@/hooks/useToolCallEvents";

export interface InspectorObjective {
  label: string;
  /** Stable Tavus objective_name — used to key the on-screen progress copy. */
  objectiveName?: string;
  /**
   * "done"        = ✓ — completed during the call
   * "active"      = ○ — activated but not completed
   * "pending"     = – — preloaded, awaiting activation (live mode)
   * "not-reached" = — — the call ended without this objective ever firing
   */
  status: "done" | "active" | "pending" | "not-reached";
  /** Transition timestamp (HH:MM:SS) for done/active rows, if known. */
  timestamp?: string;
}

export interface InspectorPerceptionItem {
  label: string;
  value: string;
}

interface DeveloperInspectorProps {
  mode?: "live" | "summary";
  /** Objective list to render */
  objectives: InspectorObjective[];
  /** Header — defaults to OBJECTIVES (n/total) */
  objectivesTitle?: string;
  /** Guardrail statuses (name, label, modality, violation count, last reason). */
  guardrails: GuardrailStatus[];
  /** Defined persona tools (LLM + perception) for the TOOLS section. */
  tools?: PersonaTool[];
  /** Per-tool call stats keyed by tool name. */
  toolStats?: ToolStats;
  /** Most recent `user_visual_analysis` string from a user utterance */
  visualAnalysis?: string | null;
  /** Most recent `user_audio_analysis` string from a user utterance */
  audioAnalysis?: string | null;
  /**
   * Active perception model from the persona (e.g. "raven-1", "off").
   * When "off" or null, the perception section renders a "disabled" placeholder.
   */
  perceptionModel?: string | null;
  /** Active layer info (reserved). */
  layers?: PersonaLayers;
  /** When true, guardrails render in "scanning" mode (pulsing dot). */
  callActive?: boolean;
  /** Jump to the most recent matching event for a guardrail in Zone 3. */
  onJumpToEvent?: (guardrailName: string) => void;
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    </svg>
  );
}

function formatClock(ms?: number): string {
  if (!ms) return "—";
  const d = new Date(ms);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Compact one-line preview of a tool's last arguments. */
function previewArgs(args: unknown): string {
  if (args === undefined || args === null) return "";
  let s: string;
  try {
    s = typeof args === "string" ? args : JSON.stringify(args);
  } catch {
    s = String(args);
  }
  return s.length > 64 ? s.slice(0, 61) + "…" : s;
}

export function DeveloperInspector({
  mode = "live",
  objectives,
  objectivesTitle,
  guardrails,
  tools = [],
  toolStats = {},
  visualAnalysis,
  audioAnalysis,
  perceptionModel,
  callActive = false,
  onJumpToEvent,
}: DeveloperInspectorProps) {
  const completed = objectives.filter((o) => o.status === "done").length;
  const total = objectives.length;
  const computedTitle = objectivesTitle ?? `Objectives (${completed}/${total})`;
  const perceptionOff = perceptionModel === "off" || !perceptionModel;

  return (
    <div className="inspector inspector--stacked">
      {/* OBJECTIVES */}
      <section className="inspector__section">
        <div className="inspector__col-label">{computedTitle}</div>
        <div className="inspector__list">
          {objectives.map((obj) => (
            <div key={obj.label} className={`inspector__item inspector__item--${obj.status}`}>
              <span className="inspector__icon" aria-hidden>
                {obj.status === "done" ? (
                  <CheckIcon />
                ) : obj.status === "active" ? (
                  <span className="inspector__spinner" />
                ) : (
                  <span aria-hidden>–</span>
                )}
              </span>
              <span className="inspector__item-label">{obj.label}</span>
              {obj.timestamp && (
                <span className="inspector__item-time">{obj.timestamp}</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* GUARDRAILS */}
      <section className="inspector__section">
        <div className="inspector__col-label">
          {mode === "summary" ? "Guardrails configured" : "Guardrails scanning"}
        </div>
        <div className="inspector__list">
          {guardrails.map((g) => {
            const violated = g.triggered;
            const state = violated ? "violated" : callActive ? "scanning" : "pending";
            return (
              <div key={g.guardrail_name} className={`inspector__item inspector__item--${state}`}>
                <div className="inspector__guardrail-head">
                  <span className="inspector__icon" aria-hidden>
                    {violated ? (
                      <AlertIcon />
                    ) : callActive ? (
                      <span className="inspector__pulse-dot" />
                    ) : (
                      "–"
                    )}
                  </span>
                  <span className="inspector__item-label">
                    {g.label}
                    {g.modality && (
                      <span className="inspector__bullet-modality"> · {g.modality}</span>
                    )}
                  </span>
                  {violated && (
                    <span className="inspector__badge inspector__badge--alert">
                      ×{g.violationCount}
                    </span>
                  )}
                  <span className="inspector__item-time">
                    {g.lastEvaluatedAt ? formatClock(g.lastEvaluatedAt) : "—"}
                  </span>
                </div>
                {violated && (g.lastReason || onJumpToEvent) && (
                  <div className="inspector__guardrail-reason">
                    {g.lastReason && <span>{g.lastReason}</span>}
                    {onJumpToEvent && (
                      <button
                        type="button"
                        className="inspector__link"
                        onClick={() => onJumpToEvent(g.guardrail_name)}
                      >
                        view event →
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {guardrails.length === 0 && (
            <div className="inspector__item inspector__item--pending">
              <span className="inspector__icon" aria-hidden>–</span>
              <span className="inspector__item-label">none configured</span>
            </div>
          )}
        </div>
      </section>

      {/* TOOLS */}
      <section className="inspector__section">
        <div className="inspector__col-label">Tools</div>
        <div className="inspector__list">
          {tools.length === 0 && (
            <div className="inspector__item inspector__item--pending">
              <span className="inspector__icon" aria-hidden>–</span>
              <span className="inspector__item-label">none defined</span>
            </div>
          )}
          {tools.map((t) => {
            const stat = toolStats[t.name];
            const called = (stat?.count ?? 0) > 0;
            const argsPreview = called ? previewArgs(stat?.lastArgs) : "";
            return (
              <div
                key={t.name}
                className={`inspector__item inspector__item--${called ? "done" : "pending"}`}
              >
                <div className="inspector__guardrail-head">
                  <span className="inspector__icon" aria-hidden>
                    {called ? <CheckIcon /> : "–"}
                  </span>
                  <span className="inspector__item-label" title={t.description || undefined}>
                    {t.name}
                  </span>
                  {called && (
                    <span className="inspector__badge">×{stat?.count}</span>
                  )}
                </div>
                {argsPreview && (
                  <div className="inspector__tool-args">{argsPreview}</div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* PERCEPTION · RAVEN */}
      <section className="inspector__section" style={perceptionOff ? { opacity: 0.4 } : undefined}>
        <div className="inspector__col-label">Perception · Raven</div>
        {perceptionOff ? (
          <div className="inspector__perception inspector__perception--combined">
            <span style={{ opacity: 0.4 }}>disabled</span>
          </div>
        ) : (
          <PerceptionStream
            visualAnalysis={visualAnalysis ?? null}
            audioAnalysis={audioAnalysis ?? null}
          />
        )}
      </section>
    </div>
  );
}

interface PerceptionStreamProps {
  visualAnalysis: string | null;
  audioAnalysis: string | null;
}

const PERCEPTION_HISTORY_MAX = 5;
const WORD_INTERVAL_MS = 110; // pace at which words "type" in — readable
const PERCEPTION_STORAGE_KEY = "ai-interviewer.perception-history";

function loadPerceptionHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(PERCEPTION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Streaming Raven log — appends each new observation as it arrives, types
 * out the latest entry one word at a time, and scrolls the container so
 * the newest words stay in view as they appear.
 */
function PerceptionStream({ visualAnalysis, audioAnalysis }: PerceptionStreamProps) {
  const [history, setHistory] = useState<string[]>(loadPerceptionHistory);
  const lastSeenRef = useRef<string>("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stuckToBottomRef = useRef(true);

  useEffect(() => {
    try {
      sessionStorage.setItem(PERCEPTION_STORAGE_KEY, JSON.stringify(history));
    } catch {
      /* ignore quota errors */
    }
  }, [history]);

  useEffect(() => {
    const latest = [visualAnalysis, audioAnalysis].filter(Boolean).join(" ").trim();
    if (latest && latest !== lastSeenRef.current) {
      lastSeenRef.current = latest;
      setHistory((h) => {
        const next = [...h, latest];
        return next.length > PERCEPTION_HISTORY_MAX
          ? next.slice(next.length - PERCEPTION_HISTORY_MAX)
          : next;
      });
    }
  }, [visualAnalysis, audioAnalysis]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
    stuckToBottomRef.current = distanceFromBottom <= 16;
  };

  const scrollToBottomIfStuck = () => {
    const el = containerRef.current;
    if (!el) return;
    if (stuckToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  };

  if (history.length === 0) {
    return (
      <div className="inspector__perception inspector__perception--combined">
        <span className="inspector__awaiting">
          awaiting<span className="inspector__cursor" aria-hidden />
        </span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="inspector__perception inspector__perception--combined inspector__perception--stream"
    >
      {history.map((entry, i) => (
        <PerceptionEntry
          key={i}
          text={entry}
          animate={i === history.length - 1}
          onProgress={scrollToBottomIfStuck}
        />
      ))}
    </div>
  );
}

interface PerceptionEntryProps {
  text: string;
  animate: boolean;
  onProgress: () => void;
}

function PerceptionEntry({ text, animate, onProgress }: PerceptionEntryProps) {
  const words = text.split(/\s+/).filter(Boolean);
  const [revealed, setRevealed] = useState(animate ? 0 : words.length);

  useEffect(() => {
    if (!animate || revealed >= words.length) return;
    const t = setTimeout(() => {
      setRevealed((c) => c + 1);
    }, WORD_INTERVAL_MS);
    return () => clearTimeout(t);
  }, [animate, revealed, words.length]);

  useLayoutEffect(() => {
    onProgress();
  }, [revealed, onProgress]);

  return (
    <p className="inspector__perception-entry">
      {words.slice(0, revealed).join(" ")}
    </p>
  );
}
