import {
  clearAppStateForLocalStorage,
  getDefaultAppState,
} from "@excalidraw/excalidraw/appState";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import { STORAGE_KEYS } from "../app_constants";

/**
 * Scene data is cached per board so switching boards never shows another
 * board's drawing. Without a board, the legacy global keys are used.
 */
// Bump to invalidate previously cached (possibly cross-contaminated) scenes.
const CACHE_VERSION = "v2";

export const getScopedStorageKeys = (boardId?: string | null) => ({
  elements: boardId
    ? `${STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS}:${CACHE_VERSION}:${boardId}`
    : STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
  appState: boardId
    ? `${STORAGE_KEYS.LOCAL_STORAGE_APP_STATE}:${CACHE_VERSION}:${boardId}`
    : STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
});

export const saveUsernameToLocalStorage = (username: string) => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_COLLAB,
      JSON.stringify({ username }),
    );
  } catch (error: any) {
    // Unable to access window.localStorage
    console.error(error);
  }
};

export const importUsernameFromLocalStorage = (): string | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_COLLAB);
    if (data) {
      return JSON.parse(data).username;
    }
  } catch (error: any) {
    // Unable to access localStorage
    console.error(error);
  }

  return null;
};

export const importFromLocalStorage = (boardId?: string | null) => {
  const { elements: elementsKey, appState: appStateKey } =
    getScopedStorageKeys(boardId);

  let savedElements = null;
  let savedState = null;

  try {
    savedElements = localStorage.getItem(elementsKey);
    savedState = localStorage.getItem(appStateKey);
  } catch (error: any) {
    // Unable to access localStorage
    console.error(error);
  }

  let elements: ExcalidrawElement[] = [];
  if (savedElements) {
    try {
      elements = JSON.parse(savedElements);
    } catch (error: any) {
      console.error(error);
      // Do nothing because elements array is already empty
    }
  }

  let appState = null;
  if (savedState) {
    try {
      appState = {
        ...getDefaultAppState(),
        ...clearAppStateForLocalStorage(
          JSON.parse(savedState) as Partial<AppState>,
        ),
      };
    } catch (error: any) {
      console.error(error);
      // Do nothing because appState is already null
    }
  }
  return { elements, appState };
};

export const getElementsStorageSize = (boardId?: string | null) => {
  try {
    const elements = localStorage.getItem(
      getScopedStorageKeys(boardId).elements,
    );
    const elementsSize = elements?.length || 0;
    return elementsSize;
  } catch (error: any) {
    console.error(error);
    return 0;
  }
};

export const getTotalStorageSize = (boardId?: string | null) => {
  try {
    const { appState: appStateKey } = getScopedStorageKeys(boardId);
    const appState = localStorage.getItem(appStateKey);
    const collab = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_COLLAB);

    const appStateSize = appState?.length || 0;
    const collabSize = collab?.length || 0;

    return appStateSize + collabSize + getElementsStorageSize(boardId);
  } catch (error: any) {
    console.error(error);
    return 0;
  }
};
