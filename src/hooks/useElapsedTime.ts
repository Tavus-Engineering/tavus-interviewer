/**
 * useElapsedTime.ts
 *
 * Lightweight MM:SS call timer for the Live State vitals strip. Ticks once a
 * second while `running` is true and freezes when it flips false (e.g. when the
 * leave flow starts). Self-contained — the live screens already run a separate
 * 10-minute cap timer, but that one doesn't surface elapsed seconds.
 */

import { useEffect, useRef, useState } from "react";

export function formatMMSS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function useElapsedTime(running: boolean): number {
  const [seconds, setSeconds] = useState(0);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    // Resume from the current count so a brief !running blip (or remount)
    // doesn't reset the clock.
    startedAtRef.current = Date.now() - seconds * 1000;
    const id = window.setInterval(() => {
      const base = startedAtRef.current ?? Date.now();
      setSeconds(Math.floor((Date.now() - base) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  return seconds;
}
