import { rejectUnauthenticated } from "../_lib/auth.ts";
import { createBoard, listBoards } from "../_lib/boards.ts";
import { readJsonBody, rejectMethod, sendJson, withErrors } from "../_lib/http.ts";

import type { VercelRequest, VercelResponse } from "@vercel/node";

export default withErrors(async (req: VercelRequest, res: VercelResponse) => {
  if (rejectMethod(req, res, ["GET", "POST"])) {
    return;
  }
  if (rejectUnauthenticated(req, res)) {
    return;
  }

  if (req.method === "GET") {
    sendJson(res, 200, { boards: await listBoards() });
    return;
  }

  const { name } = readJsonBody<{ name?: string }>(req);
  sendJson(res, 201, { board: await createBoard(name) });
});
