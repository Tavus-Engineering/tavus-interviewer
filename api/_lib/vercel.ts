/**
 * Minimal request/response types for serverless adapters.
 *
 * Kept local so we don't depend on @vercel/node (which ships a vulnerable
 * transitive dep tree just to provide these shapes). Compatible with Vercel's
 * runtime — the fields below are what the adapters actually use.
 */

export interface VercelRequest {
  method?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?: any;
  query: Record<string, string | string[]>;
  headers: Record<string, string | string[] | undefined>;
}

export interface VercelResponse {
  status(code: number): VercelResponse;
  json(body: unknown): VercelResponse;
  send(body: unknown): VercelResponse;
  setHeader(name: string, value: string | string[]): VercelResponse;
  end(body?: unknown): VercelResponse;
}
