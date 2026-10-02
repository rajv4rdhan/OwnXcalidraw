import { rejectUnauthenticated } from "../../_lib/auth.ts";
import {
  collectFileIds,
  garbageCollectFiles,
  getScene,
  isUuid,
  pruneDeletedElements,
} from "../../_lib/boards.ts";
import { getSupabase } from "../../_lib/supabase.ts";
import { readJsonBody, rejectMethod, sendJson, withErrors } from "../../_lib/http.ts";

import type { VercelRequest, VercelResponse } from "@vercel/node";

type SceneBody = {
  elements?: unknown[];
  appState?: Record<string, unknown>;
  version?: number;
};

export default withErrors(async (req: VercelRequest, res: VercelResponse) => {
  if (rejectMethod(req, res, ["GET", "PUT"])) {
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

  if (req.method === "GET") {
    const scene = await getScene(id);
    sendJson(res, 200, { scene });

    // Startup sweep: drop files no longer referenced by this board.
    void garbageCollectFiles(id, collectFileIds(scene?.elements ?? []));
    return;
  }

  const body = readJsonBody<SceneBody>(req);
  // Soft-deleted elements aren't needed after reload, so don't store them.
  const elements = pruneDeletedElements(body.elements ?? []);

  const { data, error } = await getSupabase()
    .from("scenes")
    .upsert(
      {
        board_id: id,
        elements,
        app_state: body.appState ?? {},
        version: body.version ?? 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "board_id" },
    )
    .select("board_id, version, updated_at")
    .single();

  if (error) {
    // The board was deleted (or never existed) — stale client save.
    if ((error as { code?: string }).code === "23503") {
      sendJson(res, 404, { error: "board_not_found" });
      return;
    }
    throw error;
  }

  // Keep the board's updated_at fresh so the picker can sort by recency.
  await getSupabase()
    .from("boards")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);

  sendJson(res, 200, { scene: data });

  // Drop files that this save left unreferenced.
  void garbageCollectFiles(id, collectFileIds(elements));
});
