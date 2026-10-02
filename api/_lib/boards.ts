import { readSupabaseEnv } from "./env";
import { getSupabase } from "./supabase";

/**
 * How long an unreferenced file is kept before being deleted. Protects
 * in-flight uploads and undo. Override with FILE_GC_GRACE_MINUTES.
 */
const GC_GRACE_MS =
  Math.max(0, Number(process.env.FILE_GC_GRACE_MINUTES ?? "5")) * 60 * 1000;

/** File ids referenced by the given (non-deleted) elements. */
export const collectFileIds = (elements: unknown[]): Set<string> => {
  const ids = new Set<string>();
  for (const element of elements as Array<{
    fileId?: string;
    isDeleted?: boolean;
  }>) {
    if (element?.fileId && !element.isDeleted) {
      ids.add(element.fileId);
    }
  }
  return ids;
};

/** Drops soft-deleted elements so the stored scene matches what's rendered. */
export const pruneDeletedElements = (elements: unknown[]): unknown[] =>
  (elements as Array<{ isDeleted?: boolean }>).filter(
    (element) => !element?.isDeleted,
  );

/** Lists every stored object under a board's storage prefix. */
const listBoardStoragePaths = async (boardId: string): Promise<string[]> => {
  const supabase = getSupabase();
  const { bucket } = readSupabaseEnv();
  const prefix = `boards/${boardId}`;
  const paths: string[] = [];
  let offset = 0;

  // Supabase Storage lists flat objects here (no sub-folders expected).
  for (;;) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: 1000, offset });
    if (error || !data?.length) {
      break;
    }
    for (const object of data) {
      if (object.id) {
        paths.push(`${prefix}/${object.name}`);
      }
    }
    if (data.length < 1000) {
      break;
    }
    offset += data.length;
  }

  return paths;
};

/**
 * Deletes stored files for the board that are no longer referenced by the
 * scene and are older than the grace period. Best-effort: never throws.
 */
export const garbageCollectFiles = async (
  boardId: string,
  referenced: Set<string>,
): Promise<number> => {
  try {
    const supabase = getSupabase();
    const { data: rows, error } = await supabase
      .from("board_files")
      .select("file_id, storage_path, created_at")
      .eq("board_id", boardId);

    if (error || !rows?.length) {
      return 0;
    }

    const cutoff = Date.now() - GC_GRACE_MS;
    const stale = rows.filter(
      (row) =>
        !referenced.has(row.file_id) &&
        new Date(row.created_at).getTime() < cutoff,
    );

    if (!stale.length) {
      return 0;
    }

    const { bucket } = readSupabaseEnv();
    await supabase.storage
      .from(bucket)
      .remove(stale.map((row) => row.storage_path));
    await supabase
      .from("board_files")
      .delete()
      .eq("board_id", boardId)
      .in(
        "file_id",
        stale.map((row) => row.file_id),
      );

    return stale.length;
  } catch (error) {
    console.warn("file gc failed", boardId, error);
    return 0;
  }
};

export type Board = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type SceneRecord = {
  board_id: string;
  elements: unknown[];
  app_state: Record<string, unknown>;
  version: number;
  updated_at: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: string | undefined): value is string =>
  !!value && UUID_RE.test(value);

export const listBoards = async (): Promise<Board[]> => {
  const { data, error } = await getSupabase()
    .from("boards")
    .select("id, name, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }
  return data ?? [];
};

export const createBoard = async (name?: string): Promise<Board> => {
  const { data, error } = await getSupabase()
    .from("boards")
    .insert({ name: name?.trim() || "Untitled board" })
    .select()
    .single();

  if (error) {
    throw error;
  }

  // Every board gets an empty scene document up-front.
  const { error: sceneError } = await getSupabase()
    .from("scenes")
    .insert({ board_id: data.id });

  if (sceneError) {
    throw sceneError;
  }

  return data;
};

export const renameBoard = async (
  id: string,
  name: string,
): Promise<Board> => {
  const { data, error } = await getSupabase()
    .from("boards")
    .update({ name: name.trim() || "Untitled board", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
};

export const deleteBoard = async (id: string): Promise<void> => {
  const supabase = getSupabase();
  const { bucket } = readSupabaseEnv();

  // Remove every stored object under the board prefix (covers blobs that have
  // no board_files row), then fall back to recorded paths if listing failed.
  const paths = await listBoardStoragePaths(id);
  if (paths.length) {
    await supabase.storage.from(bucket).remove(paths);
  } else {
    const { data: files } = await supabase
      .from("board_files")
      .select("storage_path")
      .eq("board_id", id);
    if (files?.length) {
      await supabase.storage
        .from(bucket)
        .remove(files.map((file) => file.storage_path));
    }
  }

  // Scene/file rows cascade via foreign keys.
  const { error } = await supabase.from("boards").delete().eq("id", id);
  if (error) {
    throw error;
  }
};

let lastReapAt = 0;
const REAP_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Startup sweep: removes storage objects whose board no longer exists.
 * Throttled so it runs at most once per interval per warm instance.
 */
export const reapOrphanBoardStorage = async (): Promise<number> => {
  if (Date.now() - lastReapAt < REAP_INTERVAL_MS) {
    return 0;
  }
  lastReapAt = Date.now();

  try {
    const supabase = getSupabase();
    const { bucket } = readSupabaseEnv();

    const { data: prefixes } = await supabase.storage
      .from(bucket)
      .list("boards", { limit: 1000 });
    if (!prefixes?.length) {
      return 0;
    }

    const { data: boards } = await supabase.from("boards").select("id");
    const known = new Set((boards ?? []).map((board) => board.id));

    let removed = 0;
    for (const prefix of prefixes) {
      // storage folders have a null id
      if (prefix.id || known.has(prefix.name)) {
        continue;
      }
      const paths = await listBoardStoragePaths(prefix.name);
      if (paths.length) {
        await supabase.storage.from(bucket).remove(paths);
        removed += paths.length;
      }
    }
    return removed;
  } catch (error) {
    console.warn("orphan storage reap failed", error);
    return 0;
  }
};

export const getScene = async (
  boardId: string,
): Promise<SceneRecord | null> => {
  const { data, error } = await getSupabase()
    .from("scenes")
    .select("board_id, elements, app_state, version, updated_at")
    .eq("board_id", boardId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
};
