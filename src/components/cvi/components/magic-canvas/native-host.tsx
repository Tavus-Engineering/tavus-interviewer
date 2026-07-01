// Data-only "bring-your-own-renderer" host for Magic Canvas. Not part of the
// SHA-pinned parity set; it reuses the pinned runtime helpers as pure
// functions so native and iframe paths emit identical downstream behavior.

import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import styles from './magic-canvas.module.css';
import { postInteraction } from './bridge';
import {
	buildCanvasModelContextAppend,
	normalizeInteraction,
	shouldCompleteCanvasInteraction,
} from './runtime';
import type {
	CanvasConfig,
	CanvasErrorCode,
	CanvasErrorEvent,
	CanvasInstance,
	CanvasInteractionEvent,
	CanvasResolvedLayout,
	JsonRecord,
	PendingInteraction,
} from './runtime';
import { useSendAppMessage } from '../../hooks/cvi-events-hooks';

// Mirrors MODEL_CONTEXT_RELAY_INTERVAL_MS in index.tsx (the iframe relay);
// duplicated here because index.tsx imports this module (no circular import).
const MODEL_CONTEXT_RELAY_INTERVAL_MS = 1000;

// After a successful `submit` interaction, hold the card for this long before
// completing/removing it, so the component's submitted confirmation ("Sent.")
// is actually visible instead of lasting only for the POST round-trip. Mirrors
// SUBMIT_CONFIRMATION_CLEAR_DELAY_MS in magic-canvas-apps
// src/components/confirmation.ts; the two must move together, but they cannot
// share an import across repos today.
// Skip/dismiss/clear stay instant, and failed POSTs never complete at all.
export const CANVAS_SUBMIT_TEARDOWN_DELAY_MS = 1200;

export type CanvasCompletionScheduler = {
	/**
	 * Complete an interaction per decision 17: no-op when the interaction does
	 * not complete at all (shouldCompleteCanvasInteraction), instant for
	 * skip/dismiss/clear, deferred by CANVAS_SUBMIT_TEARDOWN_DELAY_MS for
	 * submit. A newer submit re-arms the window; a deferred completion is
	 * dropped when `isClosed()` reports the host tore down in the meantime.
	 */
	complete: (interaction: CanvasInteractionEvent, onComplete: () => void) => void;
	/** Cancel any pending deferred completion (host teardown/unmount). */
	cancel: () => void;
};

// Single implementation shared by BOTH cvi paths (iframe CanvasFrame and
// NativeCanvasHost) so the deferred-teardown semantics cannot drift between
// them. Failure paths never reach this: callers stop on a failed delivery
// (the F16 contract), so a failed POST neither defers nor completes.
export function createCanvasCompletionScheduler(
	isClosed: () => boolean
): CanvasCompletionScheduler {
	let timer: ReturnType<typeof setTimeout> | null = null;

	return {
		complete(interaction, onComplete) {
			if (!shouldCompleteCanvasInteraction(interaction)) return;

			if (interaction.type !== 'submit') {
				onComplete();
				return;
			}

			if (timer) clearTimeout(timer);
			timer = setTimeout(() => {
				timer = null;
				if (!isClosed()) onComplete();
			}, CANVAS_SUBMIT_TEARDOWN_DELAY_MS);
		},
		cancel() {
			if (timer) {
				clearTimeout(timer);
				timer = null;
			}
		},
	};
}

/**
 * Data-only props handed to a consumer-supplied renderer: the instance's
 * validated `{ component, version, args }` plus callbacks that drive the same
 * downstream behavior as the iframe path.
 */
export type CanvasRendererProps = {
	/** Validated component id, e.g. `"canvas.question"`. */
	component: string;
	/** Validated component version, e.g. `"v1"`. */
	version: string;
	/** Component arguments (runtime/layout keys already stripped out). */
	args: JsonRecord;
	/**
	 * Report a user interaction (`type` defaults to `'submit'`). Runs the same
	 * pure helpers as the iframe path, so payload + completion are identical.
	 */
	submit: (interaction: PendingInteraction) => void;
	/** Append model context — the `conversation.append_llm_context` path. */
	sendContext: (update: { content?: unknown; structuredContent?: unknown }) => void;
	/** Free-text response — the `conversation.respond` path. */
	respond: (text: string) => void;
	/** Report a renderer-side error through the same error channel. */
	onError: (error: unknown) => void;
};

/** A consumer-supplied native renderer for a single `component@version`. */
export type CanvasComponentRenderer = (props: CanvasRendererProps) => React.ReactNode;

/**
 * Registry of native renderers keyed by `"<component>@<version>"`. When
 * undefined or missing an entry, the iframe (`CanvasFrame`) path is used
 * unchanged — the default-off guarantee.
 */
export type CanvasRenderRegistry = Record<string, CanvasComponentRenderer>;

/** Build the registry key for an instance's component + version. */
export function canvasRendererKey(component: string, version: string): string {
	return `${component}@${version}`;
}

export type CanvasInteractionDelivery = { ok: true } | { ok: false; error: CanvasErrorEvent };

// Shared interaction delivery for the iframe and native paths: run the
// consumer onInteraction callback (a throw is reported but does not block the
// POST), then POST the interaction row. A failed POST is reported through the
// onError channel AND returned as `ok: false` so callers stop before
// respond/complete instead of signaling success while the canvas_interaction
// row is silently missing. Mirrors the tavus-deployment host ordering.
export async function deliverCanvasInteraction(options: {
	interaction: CanvasInteractionEvent;
	canvasConfig: CanvasConfig;
	onInteraction?: (event: CanvasInteractionEvent) => void | Promise<void>;
	reportError: (event: CanvasErrorEvent) => void;
	buildError: (code: CanvasErrorCode, defaultMessage: string, cause: unknown) => CanvasErrorEvent;
}): Promise<CanvasInteractionDelivery> {
	const { interaction, canvasConfig, onInteraction, reportError, buildError } = options;

	if (onInteraction) {
		try {
			await onInteraction(interaction);
		} catch (error) {
			reportError(
				buildError(
					'on_interaction_callback_failed',
					'Magic Canvas onInteraction callback threw.',
					error
				)
			);
		}
	}

	try {
		await postInteraction(interaction, canvasConfig);
	} catch (error) {
		const postError = buildError(
			'interaction_post_failed',
			'Magic Canvas interaction POST failed.',
			error
		);
		reportError(postError);
		return { ok: false, error: postError };
	}

	return { ok: true };
}

/**
 * Resolve the native renderer for an instance, or `null` to fall back to the
 * iframe path. Single chokepoint for default-off: no registry or no matching
 * entry → `null`.
 */
export function resolveCanvasRenderer(
	registry: CanvasRenderRegistry | undefined,
	instance: CanvasInstance
): CanvasComponentRenderer | null {
	if (!registry) return null;
	const key = canvasRendererKey(
		instance.canvas_config.component,
		instance.canvas_config.component_version
	);
	return registry[key] ?? null;
}

type NativeCanvasHostProps = {
	instance: CanvasInstance;
	layout: CanvasResolvedLayout;
	render: CanvasComponentRenderer;
	dimmed?: boolean;
	onComplete?: () => void;
	onInteraction?: (event: CanvasInteractionEvent) => void | Promise<void>;
	onError?: (event: CanvasErrorEvent) => void;
};

export const NativeCanvasHost = memo(
	({
		instance,
		layout,
		render,
		dimmed,
		onComplete,
		onInteraction,
		onError,
	}: NativeCanvasHostProps) => {
		const instanceRef = useRef(instance);
		const sendAppMessage = useSendAppMessage();
		const sendAppMessageRef = useRef(sendAppMessage);
		const onCompleteRef = useRef(onComplete);
		const onInteractionRef = useRef(onInteraction);
		const onErrorRef = useRef(onError);
		// Mirror CanvasFrame's `closed` flag: in-flight submit continuations must
		// not fire callbacks after unmount (a stale onComplete could clear an
		// unrelated instance that reused the same id).
		const closedRef = useRef(false);

		// Decision 17 deferred-submit completion, shared with CanvasFrame. One
		// scheduler per host; the unmount cleanup cancels any pending defer so a
		// late completion can never fire on behalf of a dead host.
		const completionSchedulerRef = useRef<CanvasCompletionScheduler | null>(null);
		if (!completionSchedulerRef.current) {
			completionSchedulerRef.current = createCanvasCompletionScheduler(() => closedRef.current);
		}
		const completionScheduler = completionSchedulerRef.current;

		useEffect(() => {
			closedRef.current = false;
			return () => {
				closedRef.current = true;
				completionScheduler.cancel();
			};
		}, [completionScheduler]);

		useEffect(() => {
			instanceRef.current = instance;
		}, [instance]);

		useEffect(() => {
			sendAppMessageRef.current = sendAppMessage;
			onCompleteRef.current = onComplete;
			onInteractionRef.current = onInteraction;
			onErrorRef.current = onError;
		}, [sendAppMessage, onComplete, onInteraction, onError]);

		const buildHostError = useCallback(
			(code: CanvasErrorCode, defaultMessage: string, cause: unknown): CanvasErrorEvent => {
				const current = instanceRef.current;
				return {
					code,
					message: cause instanceof Error && cause.message ? cause.message : defaultMessage,
					conversation_id: current.conversation_id,
					tool_call_id: current.tool_call_id,
					component: current.canvas_config.component,
					cause,
				};
			},
			[]
		);

		const reportError = useCallback((event: CanvasErrorEvent) => {
			if (!closedRef.current) onErrorRef.current?.(event);
		}, []);

		// submit(value) → the SAME pure helpers + host path CanvasFrame uses:
		// normalizeInteraction → onInteraction → postInteraction →
		// shouldCompleteCanvasInteraction drives completion/clear.
		const submit = useCallback(
			(interactionPayload: PendingInteraction) => {
				const current = instanceRef.current;
				const payload: PendingInteraction = {
					type: 'submit',
					...interactionPayload,
				};

				let interaction: CanvasInteractionEvent;
				try {
					interaction = normalizeInteraction(current, payload);
				} catch (error) {
					reportError(
						buildHostError(
							'interaction_normalization_failed',
							'Magic Canvas failed to normalize an interaction.',
							error
						)
					);
					return;
				}

				void (async () => {
					const delivery = await deliverCanvasInteraction({
						interaction,
						canvasConfig: current.canvas_config,
						onInteraction: onInteractionRef.current,
						reportError,
						buildError: buildHostError,
					});

					// A teardown can race the awaited delivery: don't complete an
					// unmounted host. A failed POST must not complete (and clear)
					// the card either: the interaction row was never recorded, so
					// the renderer stays up and the consumer keeps a retry signal
					// via onError.
					if (closedRef.current || !delivery.ok) return;

					// Decision 17: submit defers by CANVAS_SUBMIT_TEARDOWN_DELAY_MS
					// so the renderer's confirmation stays visible; everything else
					// completes instantly.
					completionScheduler.complete(interaction, () => onCompleteRef.current?.());
				})();
			},
			[buildHostError, completionScheduler, reportError]
		);

		// sendContext(message) → the append_llm_context path, throttled like
		// CanvasFrame's onupdatemodelcontext relay (latest update wins,
		// trailing-edge flush) so a chatty renderer can't flood the channel.
		const pendingContextUpdateRef = useRef<{
			content?: unknown;
			structuredContent?: unknown;
		} | null>(null);
		const contextRelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

		const flushContextUpdate = useCallback(() => {
			const update = pendingContextUpdateRef.current;
			pendingContextUpdateRef.current = null;
			if (!update) return;
			const current = instanceRef.current;
			sendAppMessageRef.current({
				message_type: 'conversation',
				event_type: 'conversation.append_llm_context',
				conversation_id: current.conversation_id,
				properties: {
					context: buildCanvasModelContextAppend(current, update),
				},
			});
		}, []);

		const sendContext = useCallback(
			(update: { content?: unknown; structuredContent?: unknown }) => {
				pendingContextUpdateRef.current = update;
				if (!contextRelayTimerRef.current) {
					contextRelayTimerRef.current = setTimeout(() => {
						contextRelayTimerRef.current = null;
						flushContextUpdate();
					}, MODEL_CONTEXT_RELAY_INTERVAL_MS);
				}
			},
			[flushContextUpdate]
		);

		// Mirror the iframe teardown: clear the timer and flush the last buffered
		// update instead of dropping it.
		useEffect(() => {
			return () => {
				if (contextRelayTimerRef.current) {
					clearTimeout(contextRelayTimerRef.current);
					contextRelayTimerRef.current = null;
				}
				flushContextUpdate();
			};
		}, [flushContextUpdate]);

		// respond(text) → the conversation.respond path CanvasFrame uses.
		const respond = useCallback((text: string) => {
			const current = instanceRef.current;
			sendAppMessageRef.current({
				message_type: 'conversation',
				event_type: 'conversation.respond',
				conversation_id: current.conversation_id,
				properties: { text },
			});
		}, []);

		const onRendererError = useCallback(
			(error: unknown) => {
				reportError(
					buildHostError(
						'on_interaction_callback_failed',
						'Magic Canvas native renderer reported an error.',
						error
					)
				);
			},
			[buildHostError, reportError]
		);

		const rendererProps = useMemo<CanvasRendererProps>(
			() => ({
				component: instance.canvas_config.component,
				version: instance.canvas_config.component_version,
				args: instance.arguments,
				submit,
				sendContext,
				respond,
				onError: onRendererError,
			}),
			[
				instance.canvas_config.component,
				instance.canvas_config.component_version,
				instance.arguments,
				submit,
				sendContext,
				respond,
				onRendererError,
			]
		);

		const isFull = layout.viable_slot === 'full' || layout.display_mode === 'fullscreen';

		return (
			<div
				className={[
					styles.frameShell,
					styles.frameShellReady,
					isFull ? styles.frameShellFull : '',
					dimmed ? styles.frameShellDimmed : '',
				]
					.filter(Boolean)
					.join(' ')}
				data-magic-canvas-native=""
				data-component={instance.canvas_config.component}
				data-component-version={instance.canvas_config.component_version}
				data-dimmed={dimmed ? '' : undefined}
				style={{ height: isFull ? '100%' : undefined }}
			>
				{render(rendererProps)}
			</div>
		);
	}
);

NativeCanvasHost.displayName = 'NativeCanvasHost';
