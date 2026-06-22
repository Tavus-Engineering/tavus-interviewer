/**
 * Shared fetch wrappers for calling /api/* server-side proxies.
 * All Tavus API calls from the browser go through these proxies —
 * never directly to tavusapi.com.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiGet<TRes>(endpoint: string): Promise<TRes> {
  const response = await fetch(endpoint);

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, `${endpoint} failed: ${text}`);
  }

  return response.json() as Promise<TRes>;
}

export async function apiPost<TReq, TRes>(
  endpoint: string,
  body: TReq
): Promise<TRes> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, `${endpoint} failed: ${text}`);
  }

  return response.json() as Promise<TRes>;
}
