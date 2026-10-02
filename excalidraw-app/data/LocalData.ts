/**
 * This file deals with saving data state (appState, elements, images, ...)
 * locally to the browser.
 *
 * Notes:
 *
 * - DataState refers to full state of the app: appState, elements, images,
 *   though some state is saved separately (collab username, library) for one
 *   reason or another. We also save different data to different storage
 *   (localStorage, indexedDB).
 */

import { clearAppStateForLocalStorage } from "@excalidraw/excalidraw/appState";
import {
  CANVAS_SEARCH_TAB,
  DEFAULT_SIDEBAR,
  MIME_TYPES,
  debounce,
} from "@excalidraw/common";

import { uploadFile, fileDownloadUrl } from "../api/files";
import { getCurrentBoardId } from "./remoteStore";
import {
  createStore,
  entries,
  del,
  getMany,
  set,
  setMany,
  get,
} from "idb-keyval";

import { getNonDeletedElements } from "@excalidraw/element";

import type { LibraryPersistedData } from "@excalidraw/excalidraw/data/library";
import type { ImportedDataState } from "@excalidraw/excalidraw/data/types";
import type { ExcalidrawElement, FileId } from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFileData,
  BinaryFiles,
} from "@excalidraw/excalidraw/types";
import type { MaybePromise } from "@excalidraw/common/utility-types";

import { appJotaiStore, atom } from "../app-jotai";
import { SAVE_TO_LOCAL_STORAGE_TIMEOUT, STORAGE_KEYS } from "../app_constants";

import { FileManager } from "./FileManager";
import { FileStatusStore } from "./fileStatusStore";
import { getScopedStorageKeys } from "./localStorage";
import { Locker } from "./Locker";
import { updateBrowserStateVersion } from "./tabSync";

const filesStore = createStore("files-db", "files-store");

/** Decodes a `data:` URL into raw bytes. */
const dataURLToBytes = (dataURL: string): Uint8Array => {
  const base64 = dataURL.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const blobToDataURL = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

/** Fetches a single file from the board's remote storage. */
const fetchRemoteFile = async (
  boardId: string,
  id: FileId,
): Promise<BinaryFileData | null> => {
  try {
    const response = await fetch(fileDownloadUrl(boardId, id), {
      credentials: "same-origin",
    });
    if (!response.ok) {
      return null;
    }
    const blob = await response.blob();
    const dataURL = await blobToDataURL(blob);
    return {
      id,
      dataURL: dataURL as BinaryFileData["dataURL"],
      mimeType: (blob.type || MIME_TYPES.binary) as BinaryFileData["mimeType"],
      created: Date.now(),
      lastRetrieved: Date.now(),
    };
  } catch (error) {
    console.warn("failed to fetch remote file", id, error);
    return null;
  }
};

export const localStorageQuotaExceededAtom = atom(false);

class LocalFileManager extends FileManager {
  clearObsoleteFiles = async (opts: { currentFileIds: FileId[] }) => {
    await entries(filesStore).then((entries) => {
      for (const [id, imageData] of entries as [FileId, BinaryFileData][]) {
        // if image is unused (not on canvas) & is older than 1 day, delete it
        // from storage. We check `lastRetrieved` we care about the last time
        // the image was used (loaded on canvas), not when it was initially
        // created.
        if (
          (!imageData.lastRetrieved ||
            Date.now() - imageData.lastRetrieved > 24 * 3600 * 1000) &&
          !opts.currentFileIds.includes(id as FileId)
        ) {
          del(id, filesStore);
        }
      }
    });
  };
}

const saveDataStateToLocalStorage = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
  const localStorageQuotaExceeded = appJotaiStore.get(
    localStorageQuotaExceededAtom,
  );
  try {
    const _appState = clearAppStateForLocalStorage(appState);

    if (
      _appState.openSidebar?.name === DEFAULT_SIDEBAR.name &&
      _appState.openSidebar.tab === CANVAS_SEARCH_TAB
    ) {
      _appState.openSidebar = null;
    }

    const { elements: elementsKey, appState: appStateKey } =
      getScopedStorageKeys(getCurrentBoardId());

    localStorage.setItem(
      elementsKey,
      JSON.stringify(getNonDeletedElements(elements)),
    );
    localStorage.setItem(appStateKey, JSON.stringify(_appState));
    updateBrowserStateVersion(STORAGE_KEYS.VERSION_DATA_STATE);
    if (localStorageQuotaExceeded) {
      appJotaiStore.set(localStorageQuotaExceededAtom, false);
    }
  } catch (error: any) {
    // Unable to access window.localStorage
    console.error(error);
    if (isQuotaExceededError(error) && !localStorageQuotaExceeded) {
      appJotaiStore.set(localStorageQuotaExceededAtom, true);
    }
  }
};

const isQuotaExceededError = (error: any) => {
  return error instanceof DOMException && error.name === "QuotaExceededError";
};

type SavingLockTypes = "collaboration";

export class LocalData {
  private static _save = debounce(
    async (
      elements: readonly ExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
      onFilesSaved: () => void,
    ) => {
      saveDataStateToLocalStorage(elements, appState);

      await this.fileStorage.saveFiles({
        elements,
        files,
      });
      onFilesSaved();
    },
    SAVE_TO_LOCAL_STORAGE_TIMEOUT,
  );

  /** Saves DataState, including files. Bails if saving is paused */
  static save = (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
    onFilesSaved: () => void,
  ) => {
    // we need to make the `isSavePaused` check synchronously (undebounced)
    if (!this.isSavePaused()) {
      this._save(elements, appState, files, onFilesSaved);
    }
  };

  static flushSave = () => {
    this._save.flush();
  };

  private static locker = new Locker<SavingLockTypes>();

  static pauseSave = (lockType: SavingLockTypes) => {
    this.locker.lock(lockType);
  };

  static resumeSave = (lockType: SavingLockTypes) => {
    this.locker.unlock(lockType);
  };

  static isSavePaused = () => {
    return document.hidden || this.locker.isLocked();
  };

  // ---------------------------------------------------------------------------

  static fileStorage = new LocalFileManager({
    onFileStatusChange: FileStatusStore.updateStatuses.bind(FileStatusStore),
    async getFiles(ids) {
      const filesData = await getMany(ids, filesStore);
      const loadedFiles: BinaryFileData[] = [];
      const erroredFiles = new Map<FileId, true>();
      const filesToSave: [FileId, BinaryFileData][] = [];
      const missing: FileId[] = [];

      const localFiles: BinaryFileData[] = [];

      filesData.forEach((data, index) => {
        const id = ids[index];
        if (data) {
          const _data: BinaryFileData = { ...data, lastRetrieved: Date.now() };
          filesToSave.push([id, _data]);
          loadedFiles.push(_data);
          localFiles.push(_data);
        } else {
          missing.push(id);
        }
      });

      // Fall back to remote storage for files not cached locally (e.g. opened
      // on a different device).
      const boardId = getCurrentBoardId();
      if (boardId && missing.length) {
        const remote = await Promise.all(
          missing.map((id) => fetchRemoteFile(boardId, id)),
        );
        for (const file of remote) {
          if (file) {
            loadedFiles.push(file);
            filesToSave.push([file.id, file]);
          }
        }
      }

      // Mirror locally-cached files that predate remote sync (best-effort,
      // fire-and-forget so image rendering isn't blocked).
      if (boardId) {
        for (const file of localFiles) {
          void uploadFile(
            boardId,
            file.id,
            dataURLToBytes(file.dataURL),
            file.mimeType,
          ).catch((error) =>
            console.warn("failed to mirror file to remote storage", file.id, error),
          );
        }
      }

      try {
        // save loaded files back to storage with updated `lastRetrieved`
        await setMany(filesToSave, filesStore);
      } catch (error) {
        console.warn(error);
      }

      for (const id of ids) {
        if (!loadedFiles.some((file) => file.id === id)) {
          erroredFiles.set(id, true);
        }
      }

      return { loadedFiles, erroredFiles };
    },
    async saveFiles({ addedFiles }) {
      const savedFiles = new Map<FileId, BinaryFileData>();
      const erroredFiles = new Map<FileId, BinaryFileData>();

      // before we use `storage` event synchronization, let's update the flag
      // optimistically. Hopefully nothing fails, and an IDB read executed
      // before an IDB write finishes will read the latest value.
      updateBrowserStateVersion(STORAGE_KEYS.VERSION_FILES);

      const boardId = getCurrentBoardId();

      await Promise.all(
        [...addedFiles].map(async ([id, fileData]) => {
          try {
            await set(id, fileData, filesStore);
            savedFiles.set(id, fileData);
          } catch (error: any) {
            console.error(error);
            erroredFiles.set(id, fileData);
            return;
          }

          // Mirror to remote storage so images are available across devices.
          if (boardId) {
            try {
              await uploadFile(
                boardId,
                id,
                dataURLToBytes(fileData.dataURL),
                fileData.mimeType,
              );
            } catch (error) {
              console.warn("failed to upload file to remote storage", id, error);
            }
          }
        }),
      );

      return { savedFiles, erroredFiles };
    },
  });
}
export class LibraryIndexedDBAdapter {
  /** IndexedDB database and store name */
  private static idb_name = STORAGE_KEYS.IDB_LIBRARY;
  /** library data store key */
  private static key = "libraryData";

  private static store = createStore(
    `${LibraryIndexedDBAdapter.idb_name}-db`,
    `${LibraryIndexedDBAdapter.idb_name}-store`,
  );

  static async load() {
    const IDBData = await get<LibraryPersistedData>(
      LibraryIndexedDBAdapter.key,
      LibraryIndexedDBAdapter.store,
    );

    return IDBData || null;
  }

  static save(data: LibraryPersistedData): MaybePromise<void> {
    return set(
      LibraryIndexedDBAdapter.key,
      data,
      LibraryIndexedDBAdapter.store,
    );
  }
}

/** LS Adapter used only for migrating LS library data
 * to indexedDB */
export class LibraryLocalStorageMigrationAdapter {
  static load() {
    const LSData = localStorage.getItem(
      STORAGE_KEYS.__LEGACY_LOCAL_STORAGE_LIBRARY,
    );
    if (LSData != null) {
      const libraryItems: ImportedDataState["libraryItems"] =
        JSON.parse(LSData);
      if (libraryItems) {
        return { libraryItems };
      }
    }
    return null;
  }
  static clear() {
    localStorage.removeItem(STORAGE_KEYS.__LEGACY_LOCAL_STORAGE_LIBRARY);
  }
}
