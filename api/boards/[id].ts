import { rejectUnauthenticated } from "../_lib/auth.ts";
import { deleteBoard, isUuid, renameBoard } from "../_lib/boards.ts";
import { readJsonBody, rejectMethod, sendJson, withErrors } from "../_lib/http.ts";

import type { VercelRequest, VercelResponse } from "@vercel/node";

export default withErrors(async (req: VercelRequest, res: VercelResponse) => {
  if (rejectMethod(req, res, ["PATCH", "DELETE"])) {
    return;
  }
  if (rejectUnauthenticated(req, res)) {
    return;
  }

  const id = req.query.id as string;
  if (!isUuid(id)) {
    sendJson(res, 400, { error: "invalid_board_id" });
    return;
  }

  if (req.method === "DELETE") {
    await deleteBoard(id);
    sendJson(res, 200, { deleted: true });
    return;
  }

  const { name } = readJsonBody<{ name?: string }>(req);
  if (typeof name !== "string") {
    sendJson(res, 400, { error: "invalid_name" });
    return;
  }
  sendJson(res, 200, { board: await renameBoard(id, name) });
});
