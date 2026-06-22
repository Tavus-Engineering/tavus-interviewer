/**
 * LobbyScreen.tsx
 *
 * Pre-call hair-check + audition intro. Two-column layout:
 *   - Left: welcome label, role heading, description, CTA
 *   - Right: live camera preview + Camera / Microphone / Speaker selectors
 */

import { Spinner } from "@/components/ui/Spinner";
import { CameraPreview } from "@/components/lobby/CameraPreview";
import { DeviceSelectorBar } from "@/components/lobby/DeviceSelectorBar";
import { PixelIcon } from "@/components/lobby/pixelIcons";

interface LobbyScreenProps {
  /** Role being cast, from the active preset, e.g. "Starfall Lead". */
  role: string;
  isCreating: boolean;
  error: string | null;
  videoDeviceId: string | null;
  audioDeviceId: string | null;
  speakerDeviceId: string | null;
  onCameraChange: (deviceId: string) => void;
  onMicChange: (deviceId: string) => void;
  onSpeakerChange: (deviceId: string) => void;
  onJoin: () => void;
}

export function LobbyScreen({
  role,
  isCreating,
  error,
  videoDeviceId,
  audioDeviceId,
  speakerDeviceId,
  onCameraChange,
  onMicChange,
  onSpeakerChange,
  onJoin,
}: LobbyScreenProps) {
  const conversationReady = !isCreating && !error;

  return (
    <div className="theme-light lobby-shell">
      <div className="lobby-grid" style={{ animation: "fadeInUp 400ms ease both" }}>
        <section className="lobby-grid__left">
          <div className="lobby-intro">
            <p className="lobby-intro__welcome">Welcome in</p>
            <h1 className="lobby-intro__heading">
              You're auditioning for the {role}
            </h1>
            <p className="lobby-intro__desc">
              This is a relaxed, 5-minute audition — a quick intro, a little
              improv, and an easy character beat. You'll be reading with Julian,
              our casting director at Meridian Pictures. No need to be perfect;
              this is the fun part.
            </p>

            <div className="lobby-meta">
              <span className="lobby-meta__item">
                <PixelIcon name="clock" className="lobby-meta__icon" /> About 5 minutes
              </span>
              <span className="lobby-meta__item">
                <PixelIcon name="shield" className="lobby-meta__icon" /> Private &amp; encrypted
              </span>
              <span className="lobby-meta__item">
                <PixelIcon name="video" className="lobby-meta__icon" /> Voice + video
              </span>
            </div>

            {error && <p className="lobby-error">{error}</p>}

            <div className="lobby-cta-row">
              {isCreating ? (
                <div className="lobby-cta-pending">
                  <Spinner size={14} />
                  <span>Connecting…</span>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn-primary lobby-cta"
                  onClick={onJoin}
                  disabled={!conversationReady}
                >
                  I'm ready, let's play
                  <span aria-hidden="true">→</span>
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="lobby-grid__right">
          <div className="lobby-preview">
            <CameraPreview videoDeviceId={videoDeviceId} audioDeviceId={audioDeviceId} />
          </div>
          <span className="lobby-devices-label">Audio &amp; video</span>
          <DeviceSelectorBar
            videoDeviceId={videoDeviceId}
            audioDeviceId={audioDeviceId}
            speakerDeviceId={speakerDeviceId}
            onCameraChange={onCameraChange}
            onMicChange={onMicChange}
            onSpeakerChange={onSpeakerChange}
          />
        </section>
      </div>
    </div>
  );
}
