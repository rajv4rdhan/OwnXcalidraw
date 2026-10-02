import { getSupabase } from "./supabase.ts";

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

  // Remove stored files first (best-effort), then the board (scene/file rows
  // cascade via foreign keys).
  const { data: files } = await supabase
    .from("board_files")
    .select("storage_path")
    .eq("board_id", id);

  if (files?.length) {
    await supabase.storage
      .from(process.env.SUPABASE_BUCKET!)
      .remove(files.map((file) => file.storage_path));
  }

  const { error } = await supabase.from("boards").delete().eq("id", id);
  if (error) {
    throw error;
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
