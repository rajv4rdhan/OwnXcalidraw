/**
 * Bridges the editor with Supabase-backed storage.
 *
 * - the current board id is tracked in the URL (`?board=<uuid>`)
 * - scene JSON is saved to the server (debounced) on every change
 * - local storage / IndexedDB remain a cache for offline + first paint
 *
 * The heavy lifting (serialization, image encoding) reuses the existing
 * `LocalData` machinery; this module only adds the remote hop.
 */

import { debounce } from "@excalidraw/common";
import { getNonDeletedElements } from "@excalidraw/element";
import { serializeAsJSON } from "@excalidraw/excalidraw/data/json";

import type { ExcalidrawElement, FileId } from "@excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

import { getScene, saveScene } from "../api/boards";
import { SAVE_TO_REMOTE_TIMEOUT } from "../app_constants";

const BOARD_QUERY_KEY = "board";

/** Board id from the URL, or null when unset/invalid. */
export const getBoardIdFromUrl = (): string | null => {
  const id = new URLSearchParams(window.location.search).get(BOARD_QUERY_KEY);
  return id || null;
};

/** Pushes the board id into the URL without a navigation. */
export const setBoardIdInUrl = (id: string) => {
  const url = new URL(window.location.href);
  url.searchParams.set(BOARD_QUERY_KEY, id);
  url.hash = "";
  window.history.replaceState({}, "", url.toString());
};

type RemoteScene = {
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
};

/** Loads a board's scene, or null when the board is empty/missing. */
export const loadRemoteScene = async (
  boardId: string,
): Promise<RemoteScene | null> => {
  const scene = await getScene(boardId);
  if (!scene) {
    return null;
  }
  return {
    elements: (scene.elements ?? []) as ExcalidrawElement[],
    appState: (scene.app_state ?? {}) as Partial<AppState>,
  };
};

let currentBoardId: string | null = null;

export const setCurrentBoardId = (boardId: string | null) => {
  currentBoardId = boardId;
};

export const getCurrentBoardId = () => currentBoardId;

const pushScene = async (
  boardId: string | null,
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles,
) => {
  if (!boardId) {
    return;
  }
  try {
    const payload = serializeAsJSON(
      getNonDeletedElements(elements),
      appState,
      files,
      "database",
    );
    await saveScene(boardId, {
      elements: JSON.parse(payload).elements ?? [],
      appState: JSON.parse(payload).appState ?? {},
      version: Date.now(),
    });
  } catch (error) {
    // Never let a stale/background save surface as an unhandled rejection.
    console.warn("remote scene save failed", boardId, error);
  }
};

const debouncedPush = debounce(pushScene, SAVE_TO_REMOTE_TIMEOUT);

/**
 * Schedules a debounced remote save. The board id is captured now (not read
 * when the debounce fires) so a pending save can never land on a different
 * board after switching.
 */
export const scheduleRemoteSave = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles,
) => {
  debouncedPush(getCurrentBoardId(), elements, appState, files);
};

export const flushRemoteSave = () => debouncedPush.flush();

/** Discards any pending debounced save (e.g. while switching boards). */
export const cancelRemoteSave = () => debouncedPush.cancel();

/** Awaits an immediate remote save of the given board. */
export const saveSceneNow = async (
  boardId: string | null,
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles,
) => {
  await pushScene(boardId, elements, appState, files);
};

export type { FileId };
