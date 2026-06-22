/**
 * EventsConsole.tsx
 *
 * Zone 3 of the developer panel — the Events tab. A readable, severity-colored
 * console for CVI events (not a wall of uniform green):
 *
 *   - heartbeats (system.replica_present) collapse into one expandable row
 *   - rows are colored by severity (muted / neutral / amber / red) so the eye
 *     jumps to guardrail violations + shutdown
 *   - each row expands to its raw `properties` JSON with a per-row copy button
 *   - a type filter + "Copy All" + "Clear" toolbar
 *
 * The guardrail rows in Zone 2 can deep-link here: bumping `jumpToken` scrolls
 * to + flashes the most recent event whose type matches `jumpFilter`.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { LoggedEvent } from "@/hooks/useEventLog";
import { isHeartbeat } from "@/lib/eventSeverity";

interface EventsConsoleProps {
  events: LoggedEvent[];
  onClear: () => void;
  /** Bumped by the parent to request a jump-to-event (deep link from Zone 2). */
  jumpToken?: number;
  /** Substring matched against event type to pick the jump target. */
  jumpFilter?: string;
}

type Row =
  | { kind: "event"; event: LoggedEvent }
  | { kind: "heartbeat"; ids: number[]; count: number; lastTime: string; key: string };

export function EventsConsole({ events, onClear, jumpToken, jumpFilter }: EventsConsoleProps) {
  const [filter, setFilter] = useState<string>("all");
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [copiedRow, setCopiedRow] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stuckToBottomRef = useRef(true);

  const types = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) set.add(e.type);
    return Array.from(set).sort();
  }, [events]);

  const filtered = useMemo(
    () => (filter === "all" ? events : events.filter((e) => e.type === filter)),
    [events, filter]
  );

  // Fold consecutive heartbeats into a single collapsible row.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let run: LoggedEvent[] = [];
    const flush = () => {
      if (run.length === 0) return;
      if (run.length === 1) {
        out.push({ kind: "event", event: run[0] });
      } else {
        out.push({
          kind: "heartbeat",
          ids: run.map((e) => e.id),
          count: run.length,
          lastTime: run[run.length - 1].time,
          key: `hb-${run[0].id}`,
        });
      }
      run = [];
    };
    for (const e of filtered) {
      if (isHeartbeat(e.type)) {
        run.push(e);
      } else {
        flush();
        out.push({ kind: "event", event: e });
      }
    }
    flush();
    return out;
  }, [filtered]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stuckToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [rows.length]);

  // Deep-link jump: find the most recent event matching the filter, expand +
  // flash + scroll to it.
  useEffect(() => {
    if (!jumpToken || !jumpFilter) return;
    setFilter("all");
    const target = [...events].reverse().find((e) => e.type.includes(jumpFilter));
    if (!target) return;
    setHighlightId(target.id);
    setExpanded((prev) => new Set(prev).add(`ev-${target.id}`));
    // Defer scroll until the row renders.
    requestAnimationFrame(() => {
      const node = scrollRef.current?.querySelector(`[data-event-id="${target.id}"]`);
      node?.scrollIntoView({ block: "center" });
    });
    const t = window.setTimeout(() => setHighlightId(null), 2000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpToken]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stuckToBottomRef.current = el.scrollHeight - (el.scrollTop + el.clientHeight) <= 16;
  };

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const handleCopyAll = async () => {
    const text = filtered.map((e) => `${e.time}  ${e.type}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard may be unavailable — non-fatal */
    }
  };

  const handleCopyRow = async (e: LoggedEvent) => {
    const text = `${e.time}  ${e.type}\n${JSON.stringify(e.properties, null, 2)}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedRow(e.id);
      window.setTimeout(() => setCopiedRow((id) => (id === e.id ? null : id)), 1200);
    } catch {
      /* non-fatal */
    }
  };

  return (
    <div className="events-console">
      <div className="events-console__toolbar">
        <label className="events-console__filter">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
          </svg>
          <select
            className="events-console__select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All Events</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <span className="events-console__chevron" aria-hidden>▾</span>
        </label>
        <div className="events-console__actions">
          <button
            type="button"
            className="events-console__btn"
            onClick={handleCopyAll}
            disabled={filtered.length === 0}
          >
            {copied ? "Copied" : "Copy All"}
          </button>
          <button
            type="button"
            className="events-console__btn"
            onClick={onClear}
            disabled={events.length === 0}
          >
            Clear
          </button>
        </div>
      </div>

      <p className="events-console__count">
        Real-time console for CVI events. Events: {events.length}
      </p>

      <div className="events-console__log" ref={scrollRef} onScroll={handleScroll}>
        {rows.length === 0 ? (
          <p className="events-console__empty">
            awaiting events<span className="inspector__cursor" aria-hidden />
          </p>
        ) : (
          rows.map((row) => {
            if (row.kind === "heartbeat") {
              const open = expanded.has(row.key);
              return (
                <div key={row.key} className="events-console__group">
                  <button
                    type="button"
                    className="events-console__row events-console__row--muted events-console__row--toggle"
                    onClick={() => toggle(row.key)}
                  >
                    <span className="events-console__caret" aria-hidden>{open ? "▾" : "▸"}</span>
                    <span className="events-console__type">
                      {row.count} heartbeats
                    </span>
                    <span className="events-console__time">{row.lastTime}</span>
                  </button>
                  {open && (
                    <div className="events-console__heartbeat-detail">
                      system.replica_present × {row.count}
                    </div>
                  )}
                </div>
              );
            }

            const e = row.event;
            const key = `ev-${e.id}`;
            const open = expanded.has(key);
            const hasProps = e.properties && Object.keys(e.properties).length > 0;
            return (
              <div
                key={key}
                data-event-id={e.id}
                className={`events-console__group${highlightId === e.id ? " events-console__group--flash" : ""}`}
              >
                <button
                  type="button"
                  className={`events-console__row events-console__row--${e.severity} events-console__row--toggle`}
                  onClick={() => toggle(key)}
                  aria-expanded={open}
                >
                  <span className="events-console__caret" aria-hidden>
                    {hasProps ? (open ? "▾" : "▸") : "·"}
                  </span>
                  <span className="events-console__time">{e.time}</span>
                  <span className="events-console__type" title={e.type}>{e.label}</span>
                </button>
                {open && (
                  <div className="events-console__detail">
                    <div className="events-console__detail-head">
                      <span className="events-console__detail-type">{e.type}</span>
                      <button
                        type="button"
                        className="events-console__btn events-console__btn--mini"
                        onClick={() => handleCopyRow(e)}
                      >
                        {copiedRow === e.id ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <pre className="events-console__json">
                      {hasProps ? JSON.stringify(e.properties, null, 2) : "(no properties)"}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
