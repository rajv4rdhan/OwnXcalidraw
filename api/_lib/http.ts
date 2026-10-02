import type { VercelRequest, VercelResponse } from "@vercel/node";

/** Sends a JSON response. */
export const sendJson = <T>(
  res: VercelResponse,
  status: number,
  body: T,
) => {
  res.status(status).json(body);
};

/** Parses a JSON request body (Vercel parses it automatically when possible). */
export const readJsonBody = <T>(req: VercelRequest): T => {
  if (typeof req.body === "string") {
    return JSON.parse(req.body) as T;
  }
  return (req.body ?? {}) as T;
};

/** Rejects the request unless the method matches. Returns true when handled. */
export const rejectMethod = (
  req: VercelRequest,
  res: VercelResponse,
  allowed: string[],
): boolean => {
  if (allowed.includes(req.method ?? "GET")) {
    return false;
  }
  res.setHeader("Allow", allowed.join(", "));
  sendJson(res, 405, { error: "method_not_allowed" });
  return true;
};

/** Wraps a handler so thrown errors become a 500 JSON response. */
export const withErrors =
  (
    handler: (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>,
  ) =>
  async (req: VercelRequest, res: VercelResponse) => {
    try {
      await handler(req, res);
    } catch (error: any) {
      console.error(error);
      if (!res.writableEnded) {
        sendJson(res, error?.statusCode ?? 500, {
          error: error?.publicMessage ?? "internal_error",
        });
      }
    }
  };
