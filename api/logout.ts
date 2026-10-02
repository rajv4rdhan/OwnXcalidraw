import { clearSessionCookie } from "./_lib/auth.ts";
import { rejectMethod, sendJson, withErrors } from "./_lib/http.ts";

import type { VercelRequest, VercelResponse } from "@vercel/node";

export default withErrors((req: VercelRequest, res: VercelResponse) => {
  if (rejectMethod(req, res, ["POST"])) {
    return;
  }
  clearSessionCookie(req, res);
  sendJson(res, 200, { authed: false });
});
