/// <reference types="node" />
/**
 * Dev-only Vite plugin that runs the `api/` serverless handlers in-process.
 *
 * This lets `yarn start` serve the SPA and `/api` on a single origin without
 * the Vercel CLI. Production is unaffected (`apply: "serve"`): on Vercel the
 * same `api/` files are deployed as serverless functions.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnv } from "vite";

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect, Plugin, ViteDevServer } from "vite";

const API_DIR = fileURLToPath(new URL("../api/", import.meta.url));

/** Server-only env vars the handlers read from `process.env`. */
const SERVER_ENV_KEYS = [
  "APP_PASSWORD",
  "SESSION_SECRET",
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_BUCKET",
] as const;

type Route = {
  method: string[];
  pattern: RegExp;
  keys: string[];
  module: string;
};

const ROUTES: Route[] = [
  { method: ["GET"], pattern: /^\/session\/?$/, keys: [], module: "session.ts" },
  { method: ["POST"], pattern: /^\/login\/?$/, keys: [], module: "login.ts" },
  { method: ["POST"], pattern: /^\/logout\/?$/, keys: [], module: "logout.ts" },
  {
    method: ["GET", "POST"],
    pattern: /^\/boards\/?$/,
    keys: [],
    module: "boards/index.ts",
  },
  {
    method: ["PATCH", "DELETE"],
    pattern: /^\/boards\/([^/]+)\/?$/,
    keys: ["id"],
    module: "boards/[id].ts",
  },
  {
    method: ["GET", "PUT"],
    pattern: /^\/boards\/([^/]+)\/scene\/?$/,
    keys: ["id"],
    module: "boards/[id]/scene.ts",
  },
  {
    method: ["POST"],
    pattern: /^\/boards\/([^/]+)\/files\/sign\/?$/,
    keys: ["id"],
    module: "boards/[id]/files/sign.ts",
  },
  {
    method: ["GET"],
    pattern: /^\/boards\/([^/]+)\/files\/([^/]+)\/?$/,
    keys: ["id", "fileId"],
    module: "boards/[id]/files/[fileId].ts",
  },
];

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk as Buffer));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });

/** Minimal Vercel-compatible response built on the Node ServerResponse. */
const createResponse = (res: ServerResponse) => {
  let statusCode = 200;
  const adapter = {
    writableEnded: false,
    status(code: number) {
      statusCode = code;
      return adapter;
    },
    setHeader(name: string, value: string) {
      res.setHeader(name, value);
      return adapter;
    },
    json(body: unknown) {
      if (adapter.writableEnded) {
        return adapter;
      }
      res.statusCode = statusCode;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(body));
      adapter.writableEnded = true;
      return adapter;
    },
    send(body: Buffer | string) {
      if (adapter.writableEnded) {
        return adapter;
      }
      res.statusCode = statusCode;
      res.end(body);
      adapter.writableEnded = true;
      return adapter;
    },
    end(body?: Buffer | string) {
      if (!adapter.writableEnded) {
        res.statusCode = statusCode;
        res.end(body);
        adapter.writableEnded = true;
      }
    },
  };
  return adapter;
};

/** Builds a Vercel-compatible request from the Node request. */
const createRequest = async (
  req: IncomingMessage,
  params: Record<string, string>,
) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });
  Object.assign(query, params);

  const raw = await readBody(req);
  let body: unknown;
  if (raw && (req.headers["content-type"] ?? "").includes("application/json")) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = undefined;
    }
  }

  return {
    method: req.method,
    headers: req.headers,
    url: req.url,
    socket: req.socket,
    query,
    body,
  };
};

const matchRoute = (pathname: string) => {
  for (const route of ROUTES) {
    const match = route.pattern.exec(pathname);
    if (match) {
      const params: Record<string, string> = {};
      route.keys.forEach((key, index) => {
        params[key] = decodeURIComponent(match[index + 1]);
      });
      return { route, params };
    }
  }
  return null;
};

export const apiDevPlugin = (): Plugin => ({
  name: "excalidraw-api-dev",
  apply: "serve",
  configResolved(config) {
    const env = loadEnv(config.mode, config.envDir ?? process.cwd(), "");
    for (const key of SERVER_ENV_KEYS) {
      if (env[key] !== undefined) {
        process.env[key] = env[key];
      }
    }
  },
  configureServer(server: ViteDevServer) {
    const middleware: Connect.NextHandleFunction = async (req, res, next) => {
      if (!req.url?.startsWith("/api/")) {
        return next();
      }

      const pathname = req.url.slice("/api".length).split("?")[0];
      const matched = matchRoute(pathname);
      if (!matched) {
        return next();
      }

      const { route, params } = matched;
      const handlerPath = path
        .join(API_DIR, route.module)
        .replace(/\\/g, "/");

      try {
        // Read the body before loading so the module graph stays warm.
        const adapterReq = await createRequest(req, params);
        const handlerModule = await server.ssrLoadModule(handlerPath);
        await handlerModule.default(adapterReq, createResponse(res));
      } catch (error) {
        server.config.logger.error(
          `[api-dev] ${route.module}: ${(error as Error).message}`,
        );
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
        }
        res.end(JSON.stringify({ error: "internal_error" }));
      }
    };

    server.middlewares.use(middleware);
  },
});
