/**
 * vite-plugin.ts
 *
 * Vite plugin that mounts the API route handlers as dev-server middleware.
 * This replaces the need for a separate backend during local development —
 * `npm run dev` serves both the React app and the API proxy from one process.
 *
 * In production, the same handlers are mounted by platform adapters
 * (Vercel, Netlify, etc.) instead of this plugin.
 */

import { loadEnv, type Plugin, type Connect } from "vite";
import type { IncomingMessage } from "node:http";
import { routes } from "./handlers/index.js";
import type { RouteRequest } from "./handlers/types.js";

/** Read the full request body as a parsed JSON object (or undefined). */
function readBody(req: IncomingMessage): Promise<Record<string, unknown> | undefined> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      if (chunks.length === 0) return resolve(undefined);
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch {
        resolve(undefined);
      }
    });
    req.on("error", () => resolve(undefined));
  });
}

/** Parse query string from a URL path. */
function parseQuery(url: string): Record<string, string> {
  const idx = url.indexOf("?");
  if (idx === -1) return {};
  const params = new URLSearchParams(url.slice(idx + 1));
  const result: Record<string, string> = {};
  params.forEach((v, k) => {
    result[k] = v;
  });
  return result;
}

/** Strip query string to get the pathname. */
function pathname(url: string): string {
  const idx = url.indexOf("?");
  return idx === -1 ? url : url.slice(0, idx);
}

export function apiPlugin(): Plugin {
  return {
    name: "tavus-api-proxy",

    config(_, { mode }) {
      // Load ALL env vars from .env into process.env (not just VITE_-prefixed).
      // The empty-string prefix "" means "load everything". These values are
      // only available server-side in the plugin — Vite still only exposes
      // VITE_-prefixed vars to the browser via import.meta.env.
      const env = loadEnv(mode, process.cwd(), "");
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
    },

    configureServer(server) {
      // Mount middleware before Vite's internal middleware so /api routes
      // are handled before the SPA fallback kicks in.
      server.middlewares.use(((req, res, next) => {
        const path = pathname(req.url ?? "");
        const handler = routes[path];

        if (!handler) return next();

        // Process the request asynchronously
        (async () => {
          const body = await readBody(req);
          const query = parseQuery(req.url ?? "");

          const routeReq: RouteRequest = {
            method: req.method ?? "GET",
            body,
            query,
          };

          const routeRes = await handler(routeReq);

          res.writeHead(routeRes.status, { "Content-Type": "application/json" });
          res.end(JSON.stringify(routeRes.body));
        })().catch((err) => {
          console.error("[api-plugin] Unhandled error:", err);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal server error" }));
        });
      }) as Connect.NextHandleFunction);
    },
  };
}
