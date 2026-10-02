import { rejectUnauthenticated } from "../../../_lib/auth.ts";
import { isUuid } from "../../../_lib/boards.ts";
import { readEnv } from "../../../_lib/env.ts";
import { getSupabase } from "../../../_lib/supabase.ts";
import { readJsonBody, rejectMethod, sendJson, withErrors } from "../../../_lib/http.ts";

import type { VercelRequest, VercelResponse } from "@vercel/node";

const UPLOAD_TTL_SEC = 60 * 10; // 10 minutes

/**
 * Mints a signed upload URL so the browser can upload an image directly to
 * Supabase Storage, bypassing Vercel's request body size limit.
 */
export default withErrors(async (req: VercelRequest, res: VercelResponse) => {
  if (rejectMethod(req, res, ["POST"])) {
    return;
  }
  if (rejectUnauthenticated(req, res)) {
    return;
  }

  const boardId = req.query.id as string;
  const { fileId, mimeType } = readJsonBody<{
    fileId?: string;
    mimeType?: string;
  }>(req);

  if (!isUuid(boardId) || !fileId || typeof fileId !== "string") {
    sendJson(res, 400, { error: "invalid_request" });
    return;
  }

  const { bucket } = readEnv();
  const storagePath = `boards/${boardId}/${fileId}`;

  const { data, error } = await getSupabase()
    .storage.from(bucket)
    .createSignedUploadUrl(storagePath);

  if (error) {
    throw error;
  }

  await getSupabase()
    .from("board_files")
    .upsert(
      {
        board_id: boardId,
        file_id: fileId,
        storage_path: storagePath,
        mime_type: mimeType ?? "application/octet-stream",
      },
      { onConflict: "board_id,file_id" },
    );

  sendJson(res, 200, {
    uploadUrl: data.signedUrl,
    token: data.token,
    path: data.path,
    expiresIn: UPLOAD_TTL_SEC,
  });
});
