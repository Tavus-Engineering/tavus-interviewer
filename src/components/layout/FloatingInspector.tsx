/**
 * FloatingInspector.tsx
 *
 * Right-docked, collapsible developer panel. Collapsed, it shows a small
 * terminal-style toggle; expanded, it docks against the right edge as a
 * full-height panel with three zones:
 *
 *   Zone 1 — Live State vitals strip (always visible, pinned below the header)
 *   Zone 2 — Inspector tab (objectives / guardrails / tools / perception)
 *   Zone 3 — Events tab (severity-colored CVI event console)
 *
 * Rendered through a portal at document.body so ancestor `transform`
 * (e.g. fadeInUp animations) can't capture its `position: fixed`. Open/closed
 * state and the active tab persist in localStorage, but it always boots
 * collapsed so it never covers the replica on call entry.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DeveloperInspector,
  type InspectorObjective,
} from "@/components/inspector/DeveloperInspector";
import { EventsConsole } from "@/components/inspector/EventsConsole";
import { VitalsStrip, type ConversationStatus } from "@/components/inspector/VitalsStrip";
import type { LoggedEvent } from "@/hooks/useEventLog";
import type { ToolStats } from "@/hooks/useToolCallEvents";
import type { Speaker } from "@/hooks/useSpeakingState";
import { devPanel, useDevPanel, type DevPanelTab } from "@/hooks/useDevPanel";
import type { GuardrailStatus, PersonaLayers, PersonaTool } from "@/types/interview";

interface FloatingInspectorProps {
  objectives: InspectorObjective[];
  guardrails: GuardrailStatus[];
  tools?: PersonaTool[];
  toolStats?: ToolStats;
  perceptionModel?: string | null;
  layers?: PersonaLayers;
  mode?: "live" | "summary";
  /** Zone 1 — live conversation status. */
  status?: ConversationStatus;
  /** Zone 1 — elapsed call seconds. */
  elapsedSeconds?: number;
  /** Zone 1 — who's speaking right now. */
  speaker?: Speaker;
  /** Zone 1 — optional Sparrow turn-taking stats. */
  turns?: number;
  interruptions?: number;
  /** Zone 1 — live Tavus conversation ID. */
  conversationId?: string | null;
  visualAnalysis?: string | null;
  audioAnalysis?: string | null;
  /** When true, guardrails render in "scanning" mode. */
  callActive?: boolean;
  /** Injects a pre-canned answer via `conversation.respond` (dev convenience). */
  onInjectAnswer?: () => void;
  /** Live CVI event log. When provided, the "Events" tab is shown. */
  events?: LoggedEvent[];
  /** Clears the event log (wired to the Events Console "Clear" button). */
  onClearEvents?: () => void;
}

export function FloatingInspector({
  objectives,
  guardrails,
  tools,
  toolStats,
  perceptionModel,
  layers,
  mode,
  status = "active",
  elapsedSeconds = 0,
  speaker = "silence",
  turns,
  interruptions,
  conversationId,
  visualAnalysis,
  audioAnalysis,
  callActive = false,
  onInjectAnswer,
  events,
  onClearEvents,
}: FloatingInspectorProps) {
  const { open, tab } = useDevPanel();
  const [injecting, setInjecting] = useState(false);
  const injectTimeoutRef = useRef<number | null>(null);

  // Deep-link state for jumping from a guardrail row (Zone 2) to its event
  // (Zone 3). Bumping the token re-triggers the jump effect in EventsConsole.
  const [jumpToken, setJumpToken] = useState(0);

  const hasEvents = Array.isArray(events);
  const activeTab: DevPanelTab = hasEvents ? tab : "inspector";

  const violationCount = guardrails.reduce((sum, g) => sum + g.violationCount, 0);

  const handleJumpToEvent = useCallback(() => {
    if (!hasEvents) return;
    devPanel.setTab("events");
    setJumpToken((t) => t + 1);
  }, [hasEvents]);

  useEffect(() => {
    return () => {
      if (injectTimeoutRef.current !== null) {
        window.clearTimeout(injectTimeoutRef.current);
      }
      devPanel.reset();
    };
  }, []);

  const handleInjectClick = useCallback(() => {
    if (!onInjectAnswer || injecting) return;
    setInjecting(true);
    onInjectAnswer();
    if (injectTimeoutRef.current !== null) {
      window.clearTimeout(injectTimeoutRef.current);
    }
    injectTimeoutRef.current = window.setTimeout(() => {
      setInjecting(false);
      injectTimeoutRef.current = null;
    }, 1500);
  }, [onInjectAnswer, injecting]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <button
        type="button"
        className={`dev-panel__toggle${open ? " dev-panel__toggle--active" : ""}`}
        onClick={devPanel.toggle}
        aria-expanded={open}
        aria-label={open ? "Close developer tools" : "Open developer tools"}
      >
        <span className="dev-panel__toggle-glyph" aria-hidden>
          {open ? "›" : "‹"}
        </span>
        <span className="dev-panel__toggle-label">Dev Inspector</span>
      </button>

      <aside className="dev-panel" hidden={!open} role="dialog" aria-label="Developer Tools">
        <header className="dev-panel__header">
          <span className="dev-panel__title">
            <span className="dev-panel__glyph" aria-hidden>
              {">_"}
            </span>
            Developer Tools
          </span>
          <div className="dev-panel__header-actions">
            {onInjectAnswer && (
              <button
                type="button"
                className="floating-inspector__inject-btn floating-inspector__inject-btn--inline"
                onClick={handleInjectClick}
                disabled={injecting}
              >
                {injecting ? "Sending" : "Inject sample answer"}
                {injecting ? (
                  <span
                    className="inspector__spinner floating-inspector__inject-spinner"
                    aria-hidden
                  />
                ) : (
                  <span aria-hidden>→</span>
                )}
              </button>
            )}
            <button
              type="button"
              className="dev-panel__close"
              onClick={devPanel.close}
              aria-label="Close developer tools"
            >
              ✕
            </button>
          </div>
        </header>

        {/* Zone 1 — always visible, never scrolls away */}
        <VitalsStrip
          status={status}
          elapsedSeconds={elapsedSeconds}
          speaker={speaker}
          objectives={objectives}
          guardrailViolations={violationCount}
          turns={turns}
          interruptions={interruptions}
          conversationId={conversationId}
        />

        {hasEvents && (
          <div className="dev-panel__tabs">
            <button
              type="button"
              className={`dev-panel__tab${activeTab === "inspector" ? " dev-panel__tab--active" : ""}`}
              onClick={() => devPanel.setTab("inspector")}
            >
              Inspector
            </button>
            <button
              type="button"
              className={`dev-panel__tab${activeTab === "events" ? " dev-panel__tab--active" : ""}`}
              onClick={() => devPanel.setTab("events")}
            >
              Events
              {events!.length > 0 && (
                <span className="dev-panel__tab-count">{events!.length}</span>
              )}
            </button>
          </div>
        )}

        <div className="dev-panel__body">
          {activeTab === "events" && hasEvents ? (
            <EventsConsole
              events={events!}
              onClear={onClearEvents ?? (() => {})}
              jumpToken={jumpToken}
              jumpFilter="guardrail"
            />
          ) : (
            <DeveloperInspector
              objectives={objectives}
              guardrails={guardrails}
              tools={tools}
              toolStats={toolStats}
              perceptionModel={perceptionModel}
              layers={layers}
              mode={mode}
              visualAnalysis={visualAnalysis}
              audioAnalysis={audioAnalysis}
              callActive={callActive}
              onJumpToEvent={hasEvents ? handleJumpToEvent : undefined}
            />
          )}
        </div>
      </aside>
    </>,
    document.body
  );
}
