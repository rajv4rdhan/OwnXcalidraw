import { apiFetch } from "./client";

export type Board = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type Scene = {
  board_id: string;
  elements: unknown[];
  app_state: Record<string, unknown>;
  version: number;
  updated_at: string;
} | null;

export const listBoards = () =>
  apiFetch<{ boards: Board[] }>("/boards").then((r) => r.boards);

export const createBoard = (name?: string) =>
  apiFetch<{ board: Board }>("/boards", { method: "POST", body: { name } }).then(
    (r) => r.board,
  );

export const renameBoard = (id: string, name: string) =>
  apiFetch<{ board: Board }>(`/boards/${id}`, {
    method: "PATCH",
    body: { name },
  }).then((r) => r.board);

export const deleteBoard = (id: string) =>
  apiFetch<{ deleted: boolean }>(`/boards/${id}`, { method: "DELETE" });

export const getScene = (id: string) =>
  apiFetch<{ scene: Scene }>(`/boards/${id}/scene`).then((r) => r.scene);

export const saveScene = (id: string, scene: {
  elements: unknown[];
  appState: Record<string, unknown>;
  version: number;
}) =>
  apiFetch<{ scene: { board_id: string; version: number; updated_at: string } }>(
    `/boards/${id}/scene`,
    { method: "PUT", body: scene },
  );
