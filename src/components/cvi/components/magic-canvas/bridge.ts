// Interaction POST + AppBridge teardown helpers. Network and SDK-shutdown
// concerns live here so the React surface in `index.tsx` can stay focused on
// lifecycle wiring.

import type { AppBridge } from '@modelcontextprotocol/ext-apps/app-bridge';

import type { CanvasConfig, CanvasInteractionEvent } from './runtime.js';

const TAVUS_API_BASE_URL = 'https://tavusapi.com';
const CANVAS_INTERACTION_TIMEOUT_MS = 5000;

export async function postInteraction(event: CanvasInteractionEvent, canvasConfig: CanvasConfig) {
	const endpoint = getInteractionEndpoint(event, canvasConfig);
	const response = await fetchWithTimeout(endpoint, {
		method: 'POST',
		redirect: 'error',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			interaction_id: event.interaction_id,
			tool_call_id: event.tool_call_id,
			component: event.component,
			component_version: event.component_version,
			type: event.type,
			value: event.value,
			metadata: event.metadata,
		}),
	});

	if (!response.ok) {
		throw new Error(`Magic Canvas interaction POST failed with ${response.status}.`);
	}
}

export async function closeBridge(bridge: AppBridge) {
	try {
		await bridge.teardownResource({}, { timeout: 1000 });
	} catch {
		// The app may not acknowledge teardown; the bridge transport is closed below either way.
	}
	try {
		await bridge.close();
	} catch {
		// Transport may already be torn down by the iframe unmount; ignore.
	}
}

function getInteractionEndpoint(event: CanvasInteractionEvent, canvasConfig: CanvasConfig) {
	if (canvasConfig.interaction_url) {
		return canvasConfig.interaction_url.replace(
			'{conversation_id}',
			encodeURIComponent(event.conversation_id)
		);
	}

	const apiBaseUrl = (canvasConfig.api_base_url ?? TAVUS_API_BASE_URL).replace(/\/$/, '');
	return `${apiBaseUrl}/v2/conversations/${encodeURIComponent(event.conversation_id)}/canvas/interactions`;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit) {
	const controller = new AbortController();
	const timeout = globalThis.setTimeout(() => controller.abort(), CANVAS_INTERACTION_TIMEOUT_MS);

	try {
		return await fetch(input, { ...init, signal: controller.signal });
	} finally {
		globalThis.clearTimeout(timeout);
	}
}
