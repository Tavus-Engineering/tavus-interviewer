/**
 * ObjectiveProgressBar.tsx
 *
 * A slim progress pill overlaid at the top-center of the live call. One dot per
 * objective in the persona's chain, driven by the same live status the
 * inspector uses (done / active / pending). Instead of an anonymous "Beat N",
 * the label names the beat the audition is actually on — derived from the
 * persona's own objective names. Purely presentational — all state flows in
 * from the screen via the already-computed `InspectorObjective[]`.
 */

import { type InspectorObjective } from "@/components/inspector/DeveloperInspector";

/**
 * Action-oriented copy for the pill, keyed on the persona's stable
 * `objective_name` (prefixes like `obj_` / `intake_` are stripped before
 * lookup). Describes what's happening at the current beat in plain language.
 * Any objective not listed falls back to its auto-humanized label, so a
 * renamed or added objective degrades gracefully rather than going blank.
 */
const ACTION_LABELS: Record<string, string> = {
  intro: "Getting acquainted",
  coldread: "Running the cold read",
  character: "Discussing the character",
  closing: "Wrapping up",
};

function actionLabel(objectiveName: string | undefined, fallback: string): string {
  if (!objectiveName) return fallback;
  const key = objectiveName.replace(/^obj_/, "").replace(/^intake_/, "");
  return ACTION_LABELS[key] ?? fallback;
}

interface ObjectiveProgressBarProps {
  objectives: InspectorObjective[];
}

export function ObjectiveProgressBar({ objectives }: ObjectiveProgressBarProps) {
  // Show every objective in the chain, including the first one — the
  // greeting/intro. Its completion is what advances the FSM out of INTRO, and
  // we surface it as the opening beat so the pill reflects the whole arc from
  // the introduction onward.
  if (objectives.length === 0) return null;

  const total = objectives.length;
  const activeIndex = objectives.findIndex((o) => o.status === "active");
  const doneCount = objectives.filter((o) => o.status === "done").length;
  // Which objective to name: the active one if a beat is live, otherwise the
  // next one the chain is heading into (clamped so it never reads past the
  // final beat once everything is done).
  const currentIndex =
    activeIndex >= 0 ? activeIndex : Math.min(doneCount, total - 1);
  const current = objectives[currentIndex];
  if (!current) return null;
  const currentLabel = actionLabel(current.objectiveName, current.label);

  return (
    <div
      className="objective-progress"
      role="status"
      aria-label={`Current beat: ${currentLabel} (${currentIndex + 1} of ${total})`}
    >
      <span className="objective-progress__label">{currentLabel}</span>
      <span className="objective-progress__dots">
        {objectives.map((o, i) => (
          <span
            key={i}
            className={`objective-progress__dot objective-progress__dot--${o.status}`}
          />
        ))}
      </span>
    </div>
  );
}
