/**
 * CameraPreview.tsx
 *
 * Live camera preview shown in the lobby before joining the call. Uses
 * `getUserMedia` directly because no Daily call is active yet at this
 * stage — the preview just needs the local webcam, not a meeting.
 *
 * Surfaces a permission-denied state with a "Try again" button so the user
 * can recover from a denied prompt.
 *
 * Consumed by: LobbyScreen
 */

import { useEffect, useRef, useState, useCallback } from "react";

interface CameraPreviewProps {
  /** Selected videoinput deviceId — null = browser default. */
  videoDeviceId: string | null;
  /** Selected audioinput deviceId — null = browser default. Used to combine
   *  the camera + microphone permission prompts into a single grant so Daily
   *  doesn't trigger a second prompt when the user joins the call. */
  audioDeviceId?: string | null;
  /** When true, the preview is suspended (tracks released) and a placeholder shown. */
  isCameraOff?: boolean;
}

type PreviewState = "loading" | "ready" | "denied" | "error";

export function CameraPreview({ videoDeviceId, audioDeviceId = null, isCameraOff = false }: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<PreviewState>("loading");
  const [retryNonce, setRetryNonce] = useState(0);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    if (isCameraOff) {
      stop();
      return;
    }

    let cancelled = false;
    setState("loading");

    async function startPreview() {
      try {
        // Stop any previous stream before requesting a new one.
        stop();
        // Request video AND audio together so the browser only shows a single
        // permission prompt covering both. We immediately stop the audio
        // tracks once they're acquired — Daily will own audio capture once
        // the call joins, and overlapping mic ownership can cause conflicts.
        const constraints: MediaStreamConstraints = {
          video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
          audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        // Strip the audio tracks — we only display video here. Permission
        // for the mic stays granted at the browser level so Daily won't
        // trigger a second prompt.
        stream.getAudioTracks().forEach((t) => {
          t.stop();
          stream.removeTrack(t);
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        const name = (err as { name?: string })?.name ?? "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setState("denied");
        } else {
          setState("error");
        }
        console.error("[CameraPreview] Failed to start preview:", err);
      }
    }
    startPreview();

    return () => {
      cancelled = true;
      stop();
    };
    // NOTE: audioDeviceId is intentionally NOT a dependency. The preview only
    // displays video (the audio track is stripped right after the combined
    // permission grant), and the chosen mic is handed to Daily on join — not
    // used here. Re-running getUserMedia on a mic change would re-acquire the
    // camera too, flickering/resetting the video.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoDeviceId, isCameraOff, retryNonce, stop]);

  const wrapperStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    aspectRatio: "16 / 10",
    background: "#140206",
    border: "none",
    borderRadius: 0,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "var(--font-family-mono)",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    position: "relative",
  };

  if (isCameraOff) {
    return <div style={wrapperStyle}>Camera off</div>;
  }

  if (state === "denied" || state === "error") {
    return (
      <div style={{ ...wrapperStyle, flexDirection: "column", gap: 10, padding: 16, textAlign: "center" }}>
        <span style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.45, textTransform: "none", letterSpacing: 0 }}>
          {state === "denied"
            ? "Camera and microphone permission needed."
            : "Could not access camera."}
        </span>
        <button
          type="button"
          onClick={() => setRetryNonce((n) => n + 1)}
          style={{
            background: "#FFFFFF",
            color: "#020202",
            border: "1px solid #FFFFFF",
            padding: "6px 10px",
            fontSize: 12,
            fontFamily: "var(--font-family-mono)",
            cursor: "pointer",
            borderRadius: 0,
            letterSpacing: "-0.28px",
            textTransform: "none",
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div style={wrapperStyle}>
      <span className="lobby-preview__pill">
        <span className="dot" /> Camera on
      </span>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
      />
    </div>
  );
}
