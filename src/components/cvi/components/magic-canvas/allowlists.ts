// Magic Canvas URL allowlists.
// `sandbox_url` / `mcp_server_url` / `api_base_url` / `interaction_url` arrive
// from the wire and decide which origins the iframe loads from and where
// interactions get POSTed. This ships a fixed allowlist; if you self-host
// against a non-tavusapi.com backend, fork these constants.

const ALLOWED_CANVAS_SANDBOX_HOSTS = new Set([
	'mcp-ui.tavus.io',
	// Tavus-hosted preview origin for the Magic Canvas components worker.
	'mcp-ui.tavus-preview.io',
]);
const ALLOWED_CANVAS_SANDBOX_HOST_SUFFIXES = ['.sandbox-tavus.io'];
const ALLOWED_CANVAS_API_HOSTS = new Set(['tavusapi.com']);

export function isAllowedCanvasSandboxUrl(rawUrl: string) {
	let url: URL;
	try {
		url = new URL(rawUrl);
	} catch {
		return false;
	}

	if (isLocalCanvasSandboxUrl(url)) return true;
	if (url.protocol !== 'https:') return false;
	if (ALLOWED_CANVAS_SANDBOX_HOSTS.has(url.hostname)) return true;
	return ALLOWED_CANVAS_SANDBOX_HOST_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix));
}

export function isAllowedCanvasMcpUrl(rawUrl: string) {
	return isAllowedCanvasSandboxUrl(rawUrl);
}

export function isAllowedCanvasApiUrl(rawUrl: string) {
	let url: URL;
	try {
		url = new URL(rawUrl);
	} catch {
		return false;
	}

	if (isLocalCanvasUrl(url)) return true;
	return url.protocol === 'https:' && ALLOWED_CANVAS_API_HOSTS.has(url.hostname);
}

function isLocalCanvasSandboxUrl(url: URL) {
	return isLocalCanvasUrl(url);
}

function isLocalCanvasUrl(url: URL) {
	if (!isLocalHostPage()) return false;
	if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
	return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname);
}

function isLocalHostPage() {
	try {
		const hostname = globalThis.location?.hostname;
		return (
			typeof hostname === 'string' && ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname)
		);
	} catch {
		return false;
	}
}
