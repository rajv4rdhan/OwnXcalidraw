import { isAuthenticated } from "./_lib/auth.ts";
import { sendJson, withErrors, rejectMethod } from "./_lib/http.ts";

import type { VercelRequest, VercelResponse } from "@vercel/node";

export default withErrors((req: VercelRequest, res: VercelResponse) => {
  if (rejectMethod(req, res, ["GET"])) {
    return;
  }
  sendJson(res, 200, { authed: isAuthenticated(req) });
});
