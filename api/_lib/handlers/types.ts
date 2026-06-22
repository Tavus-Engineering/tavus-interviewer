/**
 * Platform-agnostic request/response types for API route handlers.
 *
 * Handlers are written once against these types, then mounted by
 * thin adapters for each runtime (Vite dev plugin, Vercel, Netlify, etc.).
 */

export interface RouteRequest {
  method: string;
  body?: Record<string, unknown>;
  query?: Record<string, string>;
}

export interface RouteResponse {
  status: number;
  body: unknown;
}

export type RouteHandler = (req: RouteRequest) => Promise<RouteResponse>;
