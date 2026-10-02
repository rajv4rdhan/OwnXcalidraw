import { rejectUnauthenticated } from "../../../_lib/auth";
import { isUuid } from "../../../_lib/boards";
import { readSupabaseEnv } from "../../../_lib/env";
import { getSupabase } from "../../../_lib/supabase";
import { rejectMethod, sendJson, withErrors } from "../../../_lib/http";

import type { VercelRequest, VercelResponse } from "@vercel/node";

/** Streams a stored image back to the authenticated browser. */
export default withErrors(async (req: VercelRequest, res: VercelResponse) => {
  if (rejectMethod(req, res, ["GET"])) {
    return;
  }
  if (rejectUnauthenticated(req, res)) {
    return;
  }

  const boardId = req.query.id as string;
  const fileId = req.query.fileId as string;
  if (!isUuid(boardId) || !fileId) {
    sendJson(res, 400, { error: "invalid_request" });
    return;
  }

  const { bucket } = readSupabaseEnv();
  const storagePath = `boards/${boardId}/${fileId}`;

  const { data, error } = await getSupabase()
    .storage.from(bucket)
    .download(storagePath);

  if (error || !data) {
    sendJson(res, 404, { error: "file_not_found" });
    return;
  }

  const { data: meta } = await getSupabase()
    .from("board_files")
    .select("mime_type")
    .eq("board_id", boardId)
    .eq("file_id", fileId)
    .maybeSingle();

  const buffer = Buffer.from(await data.arrayBuffer());
  res.setHeader("Content-Type", meta?.mime_type ?? "application/octet-stream");
  res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
  res.status(200).send(buffer);
});
