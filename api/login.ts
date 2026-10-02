import { readEnv } from "./_lib/env.ts";
import { safeEqual, setSessionCookie } from "./_lib/auth.ts";
import { rejectMethod, readJsonBody, sendJson, withErrors } from "./_lib/http.ts";
import { isRateLimited } from "./_lib/rate-limit.ts";

import type { VercelRequest, VercelResponse } from "@vercel/node";

const RATE_LIMIT = { limit: 10, windowMs: 60_000 };

const clientKey = (req: VercelRequest) => {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (ip ?? req.socket?.remoteAddress ?? "unknown").split(",")[0].trim();
};

export default withErrors((req: VercelRequest, res: VercelResponse) => {
  if (rejectMethod(req, res, ["POST"])) {
    return;
  }

  if (isRateLimited(clientKey(req), RATE_LIMIT)) {
    sendJson(res, 429, { error: "too_many_attempts" });
    return;
  }

  const { password } = readJsonBody<{ password?: string }>(req);
  if (!password || !safeEqual(password, readEnv().appPassword)) {
    sendJson(res, 401, { error: "invalid_password" });
    return;
  }

  setSessionCookie(req, res);
  sendJson(res, 200, { authed: true });
});
