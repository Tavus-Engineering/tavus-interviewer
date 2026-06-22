/**
 * CallControlBar.tsx
 *
 * Bottom-of-video control strip. Four buttons in order:
 *   1. mic toggle              — active state = muted
 *   2. camera toggle           — active state = camera off
 *   3. closed-captions toggle  — active state = TranscriptPanel open
 *   4. End call (text button)
 *
 * Noise cancellation is enabled silently on `joined-meeting` (Daily input
 * processor set to `noise-cancellation`) — there is no user-facing toggle.
 *
 * Strict monochrome — 1px black border, white bg, inverts to filled black on
 * active state. No red destructive variant for End call.
 */

import { useCallback } from "react";
import {
  useAudioTrack,
  useDaily,
  useDailyEvent,
  useLocalSessionId,
  useVideoTrack,
} from "@daily-co/daily-react";
import { useIsMobile } from "@/hooks/useIsMobile";

interface CallControlBarProps {
  onEndCall: () => void;
  captionsOpen: boolean;
  onToggleCaptions: () => void;
  /** Text on the end-call button (e.g. "End call"). */
  endLabel?: string;
}

const SIZE = 38;

const baseBtn: React.CSSProperties = {
  width: SIZE,
  height: SIZE,
  border: "1px solid #020202",
  background: "#FFFFFF",
  color: "#020202",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  borderRadius: 3,
  padding: 0,
  fontFamily: "var(--font-family-mono)",
  transition: "background-color 120ms ease, color 120ms ease",
};

const activeBtn: React.CSSProperties = {
  ...baseBtn,
  background: "#020202",
  color: "#FFFFFF",
};

function MicIcon({ muted }: { muted: boolean }) {
  if (muted) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M9 6C9 5.20435 9.31607 4.44129 9.87868 3.87868C10.4413 3.31607 11.2044 3 12 3C12.7956 3 13.5587 3.31607 14.1213 3.87868C14.6839 4.44129 15 5.20435 15 6V11C15 11.7956 14.6839 12.5587 14.1213 13.1213C13.5587 13.6839 12.7956 14 12 14C11.2044 14 10.4413 13.6839 9.87868 13.1213C9.31607 12.5587 9 11.7956 9 11V6Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M5 11V11C5 12.857 5.7375 14.637 7.05025 15.9497C8.36301 17.2625 10.1435 18 12 18C13.8565 18 15.637 17.2625 16.9497 15.9497C18.2625 14.637 19 12.857 19 11V11"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 18V21"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <line
          x1="4"
          y1="4"
          x2="20"
          y2="20"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 6C9 5.20435 9.31607 4.44129 9.87868 3.87868C10.4413 3.31607 11.2044 3 12 3C12.7956 3 13.5587 3.31607 14.1213 3.87868C14.6839 4.44129 15 5.20435 15 6V11C15 11.7956 14.6839 12.5587 14.1213 13.1213C13.5587 13.6839 12.7956 14 12 14C11.2044 14 10.4413 13.6839 9.87868 13.1213C9.31607 12.5587 9 11.7956 9 11V6Z"
        fill="currentColor"
      />
      <path
        d="M5 11V11C5 12.857 5.7375 14.637 7.05025 15.9497C8.36301 17.2625 10.1435 18 12 18C13.8565 18 15.637 17.2625 16.9497 15.9497C18.2625 14.637 19 12.857 19 11V11"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 18V21"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CaptionsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="2.5"
        y="5"
        width="19"
        height="14"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
      />
      <path
        d="M10 10.5C10 10 9.4 9.5 8.5 9.5C7.4 9.5 6.5 10.4 6.5 11.5V12.5C6.5 13.6 7.4 14.5 8.5 14.5C9.4 14.5 10 14 10 13.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17.5 10.5C17.5 10 16.9 9.5 16 9.5C14.9 9.5 14 10.4 14 11.5V12.5C14 13.6 14.9 14.5 16 14.5C16.9 14.5 17.5 14 17.5 13.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CamIcon({ muted }: { muted: boolean }) {
  if (muted) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M5 5C4.20435 5 3.44129 5.31607 2.87868 5.87868C2.31607 6.44129 2 7.20435 2 8V16C2 16.7956 2.31607 17.5587 2.87868 18.1213C3.44129 18.6839 4.20435 19 5 19H15C15.7956 19 16.5587 18.6839 17.1213 18.1213C17.6839 17.5587 18 16.7956 18 16V14.414L20.293 16.707C20.4329 16.8468 20.611 16.942 20.805 16.9806C20.9989 17.0192 21.2 16.9993 21.3827 16.9237C21.5654 16.848 21.7215 16.7199 21.8314 16.5555C21.9413 16.391 22 16.1978 22 16V8C22 7.80225 21.9413 7.60895 21.8314 7.44454C21.7215 7.28013 21.5654 7.15199 21.3827 7.07632C21.2 7.00065 20.9989 6.98085 20.805 7.01942C20.611 7.05798 20.4329 7.15319 20.293 7.293L18 9.586V8C18 7.20435 17.6839 6.44129 17.1213 5.87868C16.5587 5.31607 15.7956 5 15 5H5Z"
          stroke="currentColor"
          strokeWidth="1.6"
          fill="none"
        />
        <line
          x1="4"
          y1="4"
          x2="20"
          y2="20"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5 5C4.20435 5 3.44129 5.31607 2.87868 5.87868C2.31607 6.44129 2 7.20435 2 8V16C2 16.7956 2.31607 17.5587 2.87868 18.1213C3.44129 18.6839 4.20435 19 5 19H15C15.7956 19 16.5587 18.6839 17.1213 18.1213C17.6839 17.5587 18 16.7956 18 16V14.414L20.293 16.707C20.4329 16.8468 20.611 16.942 20.805 16.9806C20.9989 17.0192 21.2 16.9993 21.3827 16.9237C21.5654 16.848 21.7215 16.7199 21.8314 16.5555C21.9413 16.391 22 16.1978 22 16V8C22 7.80225 21.9413 7.60895 21.8314 7.44454C21.7215 7.28013 21.5654 7.15199 21.3827 7.07632C21.2 7.00065 20.9989 6.98085 20.805 7.01942C20.611 7.05798 20.4329 7.15319 20.293 7.293L18 9.586V8C18 7.20435 17.6839 6.44129 17.1213 5.87868C16.5587 5.31607 15.7956 5 15 5H5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function CallControlBar({
  onEndCall,
  captionsOpen,
  onToggleCaptions,
  endLabel = "End call",
}: CallControlBarProps) {
  const daily = useDaily();
  const isMobile = useIsMobile();
  const localSessionId = useLocalSessionId();
  const { isOff: isMicMuted } = useAudioTrack(localSessionId);
  const { isOff: isCamMuted } = useVideoTrack(localSessionId);

  // Bump the icon buttons to a 44px touch target on mobile (WCAG min);
  // desktop keeps the tighter 38px chrome.
  const btnBase = isMobile ? { ...baseBtn, width: 44, height: 44 } : baseBtn;
  const btnActive = isMobile ? { ...activeBtn, width: 44, height: 44 } : activeBtn;

  // Noise cancellation is applied silently on `joined-meeting`. No user
  // toggle — this is the desired default for the entire call.
  useDailyEvent(
    "joined-meeting",
    useCallback(() => {
      if (!daily) return;
      daily
        .updateInputSettings({
          audio: { processor: { type: "noise-cancellation" } },
        })
        .catch((err) => {
          console.warn("[CallControlBar] noise-cancellation init failed:", err);
        });
    }, [daily])
  );

  const handleToggleMic = () => {
    if (!daily) return;
    daily.setLocalAudio(isMicMuted);
  };

  const handleToggleCam = () => {
    if (!daily) return;
    daily.setLocalVideo(isCamMuted);
  };

  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        left: 0,
        // Shrink the control strip's track from the right by the dev panel's
        // width when it's open, so the buttons stay centered in the visible
        // video area between the screen's left edge and the panel. On mobile
        // the dev panel is a full-screen drawer, so no inset applies.
        right: isMobile ? 0 : "var(--dev-panel-inset, 0px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
        zIndex: 30,
        transition: "right 200ms ease",
      }}
    >
      <button
        type="button"
        onClick={handleToggleMic}
        style={isMicMuted ? btnActive : btnBase}
        aria-label={isMicMuted ? "Unmute microphone" : "Mute microphone"}
        title={isMicMuted ? "Unmute" : "Mute"}
      >
        <MicIcon muted={isMicMuted} />
      </button>
      <button
        type="button"
        onClick={handleToggleCam}
        style={isCamMuted ? btnActive : btnBase}
        aria-label={isCamMuted ? "Turn camera on" : "Turn camera off"}
        title={isCamMuted ? "Camera on" : "Camera off"}
      >
        <CamIcon muted={isCamMuted} />
      </button>
      <button
        type="button"
        onClick={onToggleCaptions}
        style={captionsOpen ? btnActive : btnBase}
        aria-label={
          captionsOpen ? "Hide closed captions" : "Show closed captions"
        }
        aria-pressed={captionsOpen}
        title="Closed captions"
      >
        <CaptionsIcon />
      </button>
      <button
        type="button"
        onClick={onEndCall}
        style={{
          ...btnBase,
          width: "auto",
          padding: "0 16px",
          fontSize: 14,
          letterSpacing: "-0.28px",
        }}
        aria-label={endLabel}
      >
        {endLabel}
      </button>
    </div>
  );
}
