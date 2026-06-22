/**
 * TranscriptPanel.tsx
 *
 * Right-side panel that sits beside the live video frame (in flow, not
 * overlaid), toggled by the CC button in the CallControlBar. Hosts the
 * full running transcript and a text input that posts a
 * `conversation.respond` interaction so the actor can "speak" by typing.
 *
 * The panel is a regular flex item — when CC is open InterviewScreen wraps
 * the video and the panel in a flex row so the video shrinks to make room.
 *
 * Auto-scroll is sticky-to-bottom only — once the user scrolls up to read
 * history, new utterances do NOT yank them back down.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { FormEvent } from "react";
import { useDaily } from "@daily-co/daily-react";
import type { Utterance } from "@/hooks/useUtteranceEvents";
import { useIsMobile } from "@/hooks/useIsMobile";

interface TranscriptPanelProps {
  utterances: Utterance[];
  conversationId: string | null;
  onClose: () => void;
  /** Display name shown for the AI replica (defaults to "Julian"). */
  replicaLabel?: string;
  /** Called with the user's typed text right after send so the transcript
   *  renders it optimistically (instantly). Tavus echoes the message back
   *  through the utterance stream, which then adopts that optimistic row —
   *  so the message shows once, immediately. */
  onUserTextSent?: (text: string) => void;
}

export const TRANSCRIPT_PANEL_WIDTH = 340;
const SCROLL_BOTTOM_THRESHOLD_PX = 24;
const COPIED_FLASH_MS = 1500;

export function TranscriptPanel({
  utterances,
  conversationId,
  onClose,
  replicaLabel = "Julian",
  onUserTextSent,
}: TranscriptPanelProps) {
  const daily = useDaily();
  const isMobile = useIsMobile();
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wasAtBottomRef = useRef(true);

  // Tracked at scroll-time so the layout effect below knows whether the user
  // was pinned to the bottom *before* the next utterance arrived.
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    wasAtBottomRef.current =
      distanceFromBottom <= SCROLL_BOTTOM_THRESHOLD_PX;
  }, []);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (wasAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [utterances]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    wasAtBottomRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // `disabled` flips false the moment Daily + conversationId arrive, which
  // re-enables the input/send button mid-render — no extra plumbing needed.
  const inputDisabled = !daily || !conversationId;
  const sendDisabled = inputDisabled || sending || value.trim().length === 0;

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const text = value.trim();
      if (!text || !daily || !conversationId) return;

      setSending(true);
      try {
        daily.sendAppMessage(
          {
            message_type: "conversation",
            event_type: "conversation.respond",
            conversation_id: conversationId,
            properties: { text },
          },
          "*"
        );
        // Render the typed message instantly (optimistic). Tavus echoes it
        // back through the user utterance stream, which adopts this row
        // rather than duplicating it — so it shows once, with no send delay.
        onUserTextSent?.(text);
        setValue("");
        // Sending implies the user wants to follow the conversation — re-pin
        // to the bottom so their reply and the next replica turn are visible.
        wasAtBottomRef.current = true;
        // Refocus the input so the user can keep typing without re-clicking.
        // (setValue alone preserves focus, but explicit focus is robust.)
        inputRef.current?.focus();
      } catch (err) {
        console.warn("[TranscriptPanel] sendAppMessage failed:", err);
      } finally {
        setSending(false);
      }
    },
    [daily, conversationId, value, onUserTextSent]
  );

  const handleCopyAll = useCallback(async () => {
    if (utterances.length === 0) return;
    const body = utterances
      .map((u) => {
        const role = u.role === "user" ? "You" : replicaLabel;
        return `${role}: ${u.text}`;
      })
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_FLASH_MS);
    } catch (err) {
      console.warn("[TranscriptPanel] clipboard write failed:", err);
    }
  }, [utterances, replicaLabel]);

  return (
    <aside
      style={{
        // Desktop: in-flow flex item beside the video (InterviewScreen wraps
        // video + panel in a flex ROW, so the video shrinks while CC is open).
        // Mobile: InterviewScreen switches that wrapper to a COLUMN, so the
        // panel becomes a full-width bottom sheet sitting under the video.
        flex: isMobile ? "1 1 45%" : `0 0 ${TRANSCRIPT_PANEL_WIDTH}px`,
        width: isMobile ? "100%" : TRANSCRIPT_PANEL_WIDTH,
        minHeight: 0,
        alignSelf: "stretch",
        background: "#FFFFFF",
        borderLeft: isMobile ? "none" : "1px solid rgba(2, 2, 2, 0.1)",
        borderTop: isMobile ? "1px solid rgba(2, 2, 2, 0.1)" : "none",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--font-family-sans, 'Suisse Intl', system-ui, sans-serif)",
        color: "#020202",
        // When the docked dev panel is open, slide the CC panel left by the
        // panel's width so it sits immediately to the panel's left instead of
        // being covered by it (the dev panel is a fixed overlay at right: 0).
        // On mobile the dev panel is a full-screen drawer, so no inset applies.
        marginRight: isMobile ? 0 : "var(--dev-panel-inset, 0px)",
        transition: "margin-right 200ms ease",
      }}
      aria-label="Transcript"
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "12px 14px",
          borderBottom: "1px solid rgba(2, 2, 2, 0.08)",
          flex: "0 0 auto",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            opacity: 0.55,
            flex: "1 1 auto",
            minWidth: 0,
          }}
        >
          Transcript
        </span>
        <button
          type="button"
          onClick={handleCopyAll}
          disabled={utterances.length === 0}
          aria-label="Copy transcript"
          style={{
            border: copied ? "1px solid var(--color-accent, #140206)" : "1px solid rgba(2, 2, 2, 0.15)",
            borderRadius: 7,
            background: copied ? "var(--color-accent, #140206)" : "transparent",
            color: copied ? "#FFFFFF" : "#020202",
            cursor: utterances.length === 0 ? "not-allowed" : "pointer",
            padding: "4px 10px",
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.02em",
            fontFamily: "inherit",
            opacity: utterances.length === 0 ? 0.4 : 1,
            transition: "background-color 120ms ease, color 120ms ease, border-color 120ms ease",
          }}
        >
          {copied ? "Copied" : "Copy all"}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close transcript"
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            border: "none",
            background: "transparent",
            color: "#020202",
            opacity: 0.6,
            cursor: "pointer",
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            lineHeight: 1,
            fontFamily: "inherit",
          }}
        >
          ×
        </button>
      </div>

      {/* Scrollable body — explicitly user-selectable so the transcript can
          be copied with the keyboard or context menu. */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        aria-live="polite"
        aria-atomic="false"
        style={{
          flex: "1 1 auto",
          overflowY: "auto",
          padding: "14px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          userSelect: "text",
          WebkitUserSelect: "text",
        }}
      >
        {utterances.length === 0 ? (
          <div
            style={{
              fontSize: 13,
              opacity: 0.45,
              textAlign: "center",
              marginTop: 28,
              lineHeight: 1.5,
            }}
          >
            Transcript will appear here.
          </div>
        ) : (
          utterances.map((u) => {
            const isUser = u.role === "user";
            const label = isUser ? "You" : replicaLabel;
            return (
              <div
                key={u.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isUser ? "flex-end" : "flex-start",
                  gap: 3,
                }}
              >
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: isUser ? "var(--color-accent, #140206)" : "#020202",
                    opacity: isUser ? 0.85 : 0.5,
                    padding: "0 4px",
                    userSelect: "text",
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    maxWidth: "88%",
                    padding: "8px 12px",
                    borderRadius: 14,
                    borderTopRightRadius: isUser ? 4 : 14,
                    borderTopLeftRadius: isUser ? 14 : 4,
                    background: isUser
                      ? "var(--color-accent-soft, rgba(20, 2, 6, 0.12))"
                      : "rgba(2, 2, 2, 0.05)",
                    fontSize: 14,
                    lineHeight: 1.45,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    userSelect: "text",
                  }}
                >
                  {u.text}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Input footer */}
      <form
        onSubmit={handleSubmit}
        style={{
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: 10,
          borderTop: "1px solid rgba(2, 2, 2, 0.08)",
          background: "#FFFFFF",
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          placeholder="Type a message..."
          disabled={inputDisabled || sending}
          aria-label="Type a message"
          style={{
            flex: 1,
            minWidth: 0,
            height: 38,
            padding: "0 12px",
            border: inputFocused
              ? "1px solid var(--color-accent, #140206)"
              : "1px solid rgba(2, 2, 2, 0.14)",
            borderRadius: 9,
            background: "#FFFFFF",
            color: "#020202",
            fontFamily: "inherit",
            fontSize: 14,
            outline: "none",
            boxShadow: inputFocused ? "0 0 0 3px var(--color-accent-soft, rgba(20, 2, 6, 0.12))" : "none",
            transition: "border-color 120ms ease, box-shadow 120ms ease",
          }}
        />
        <button
          type="submit"
          disabled={sendDisabled}
          aria-label="Send message"
          style={{
            height: 38,
            padding: "0 16px",
            border: "none",
            borderRadius: 9,
            background: sendDisabled ? "rgba(2, 2, 2, 0.06)" : "var(--color-accent, #140206)",
            color: sendDisabled ? "rgba(2, 2, 2, 0.4)" : "#FFFFFF",
            fontFamily: "inherit",
            fontSize: 14,
            fontWeight: 500,
            cursor: sendDisabled ? "not-allowed" : "pointer",
            transition: "background-color 120ms ease, color 120ms ease",
          }}
        >
          Send
        </button>
      </form>
    </aside>
  );
}
