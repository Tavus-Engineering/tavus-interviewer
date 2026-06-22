/**
 * guardrailActions.ts
 *
 * Decides what (if anything) should happen for the participant when a guardrail
 * trips. The developer inspector always logs every guardrail regardless — this
 * file only governs the two *participant-facing* surfaces:
 *
 *   - speak: the replica verbally addresses it, in-character, via a
 *     conversation.respond interaction (see useGuardrailResponder).
 *   - toast: a brief visual alert over the video (GuardrailToast).
 *
 * Not every guardrail warrants either. The policy is keyed to the persona's
 * actual deployed guardrails (verified against the Tavus API), with a modality
 * fallback for any guardrail not named below.
 *
 * The deployed interviewer persona's guardrails are ALL verbal — they fire
 * because the candidate just spoke, and the replica already enforces each one
 * in its own next reply (server-side steering). So they all resolve to "neither
 * surface": the developer sees them in the inspector, the candidate is not
 * shown a redundant toast, and (for system_integrity especially) a prompt-
 * injection attempt is never tipped off on screen.
 *
 * The visual fallback speaks: if a `visual` guardrail is ever added to the
 * persona (e.g. a bystander-on-camera check), the replica will warmly address
 * it with no code change — that's a visible condition the candidate can fix.
 */

/**
 * Sentinel prefix on every injected instruction. The transcript hook
 * (useUtteranceEvents) drops any user-role utterance that starts with this, so
 * if Tavus echoes the `conversation.respond` back as a user turn, the bracketed
 * system note never shows up in the visible transcript.
 */
export const GUARDRAIL_SYSTEM_PREFIX = "[[guardrail-system]]";

export interface GuardrailActionContext {
  guardrail_name: string;
  label: string;
  modality: "verbal" | "visual";
  reason?: string;
}

export interface GuardrailAction {
  /** Replica verbally addresses the violation, in-character. */
  speak: boolean;
  /** Show a participant-facing visual toast over the video. */
  toast: boolean;
  /** Participant-facing toast copy. Falls back to the guardrail label. */
  toastMessage?: string;
  /** Builds the system-style instruction injected via `conversation.respond`.
   *  Only present (and used) when `speak` is true. */
  buildInstruction?: (ctx: GuardrailActionContext) => string;
}

function normalize(name: string): string {
  return name.replace(/^obj_/, "").toLowerCase();
}

/** Default instruction for a visible (camera) condition the candidate can fix. */
function defaultVisualInstruction(ctx: GuardrailActionContext): string {
  const reasonClause = ctx.reason ? ` Specifically: ${ctx.reason}.` : "";
  return (
    `${GUARDRAIL_SYSTEM_PREFIX} A visual condition ("${ctx.label}") was just ` +
    `detected on camera during the interview.${reasonClause} In your own ` +
    `natural voice and persona, briefly and professionally let the candidate ` +
    `know what you've noticed and that you'll pause the interview until it's ` +
    `resolved, then stop and wait for them to address it. Do not mention ` +
    `guardrails, systems, rules, or that you received any note — speak only as ` +
    `yourself.`
  );
}

/**
 * Per-guardrail policy, keyed by normalized guardrail_name. Falls back to the
 * modality default below for any name not listed. No entries today: every
 * deployed guardrail is verbal and resolves correctly via the default.
 */
const OVERRIDES: Record<string, GuardrailAction> = {};

export function resolveGuardrailAction(ctx: {
  guardrail_name: string;
  label: string;
  modality: "verbal" | "visual";
}): GuardrailAction {
  const override = OVERRIDES[normalize(ctx.guardrail_name)];
  if (override) return override;

  if (ctx.modality === "visual") {
    return { speak: true, toast: false, buildInstruction: defaultVisualInstruction };
  }
  return { speak: false, toast: false };
}
