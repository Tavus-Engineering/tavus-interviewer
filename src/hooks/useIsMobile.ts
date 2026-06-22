/**
 * useIsMobile.ts
 *
 * Reports whether the viewport is at or below a mobile breakpoint (640px by
 * default). Used to switch the desktop-first call layout — fixed-width side
 * panels that sit beside the video — into mobile-friendly stacked layouts
 * (transcript as a bottom sheet, larger touch targets) at runtime.
 *
 * Inline-styled components (CallControlBar, TranscriptPanel) can't be
 * overridden by CSS media queries, so they read this hook instead.
 */

import { useEffect, useState } from "react";

export function useIsMobile(breakpoint = 640): boolean {
  const query = `(max-width: ${breakpoint}px)`;
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return isMobile;
}
