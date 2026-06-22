/**
 * useDevPanel.ts
 *
 * Shared store for the right-docked developer panel's open/closed state and
 * active tab. Lifted out of FloatingInspector so other parts of the call
 * screen — the bottom-left toggle button and the call control bar — can read
 * and drive the same state even though they live in different parts of the
 * tree (the control bar is inside the Daily provider; the panel is portaled
 * to document.body).
 *
 * On every change it mirrors the panel width into the `--dev-panel-inset`
 * CSS custom property on <html>. The call controls read that variable to stay
 * centered in the visible video area to the LEFT of the panel when it's open.
 */

import { useSyncExternalStore } from "react";

export type DevPanelTab = "inspector" | "events";

export interface DevPanelState {
  open: boolean;
  tab: DevPanelTab;
}

/** Must match the width of `.dev-panel` in styles.css. */
export const DEV_PANEL_WIDTH = 440;

const STORAGE_KEY = "ai-interviewer.dev-panel.v3";

function load(): DevPanelState {
  const fallback: DevPanelState = { open: false, tab: "inspector" };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const stored = JSON.parse(raw) as Partial<DevPanelState>;
    // Always boot collapsed so the panel never covers the replica on entry.
    return { open: false, tab: stored.tab === "events" ? "events" : "inspector" };
  } catch {
    return fallback;
  }
}

let state: DevPanelState = load();
const listeners = new Set<() => void>();

function syncInset() {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty(
    "--dev-panel-inset",
    state.open ? `${DEV_PANEL_WIDTH}px` : "0px"
  );
}
syncInset();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota errors */
  }
}

function set(patch: Partial<DevPanelState>) {
  state = { ...state, ...patch };
  persist();
  syncInset();
  listeners.forEach((l) => l());
}

export const devPanel = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  get: () => state,
  open: () => set({ open: true }),
  close: () => set({ open: false }),
  toggle: () => set({ open: !state.open }),
  setTab: (tab: DevPanelTab) => set({ tab }),
  /** Clear the layout inset — call when the call screen unmounts so a stale
   *  offset can't follow the user onto the results screen. */
  reset: () => {
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--dev-panel-inset", "0px");
    }
  },
};

export function useDevPanel(): DevPanelState {
  return useSyncExternalStore(devPanel.subscribe, devPanel.get, devPanel.get);
}
