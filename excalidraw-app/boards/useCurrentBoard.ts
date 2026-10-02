import { isTestEnv } from "@excalidraw/common";
import { useCallback, useEffect, useState } from "react";

import { createBoard, listBoards } from "../api/boards";
import {
  getBoardIdFromUrl,
  setBoardIdInUrl,
  setCurrentBoardId,
} from "../data/remoteStore";

import type { Board } from "../api/boards";

/**
 * Resolves the board to open from `?board=`, creating a default board when
 * none exists yet. Keeps the URL in sync.
 */
export const useCurrentBoard = () => {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);

  const openBoard = useCallback((next: Board) => {
    setBoardIdInUrl(next.id);
    setCurrentBoardId(next.id);
    setBoard(next);
  }, []);

  useEffect(() => {
    // Tests render the app without a server; skip board resolution there.
    if (isTestEnv()) {
      setLoading(false);
      return;
    }

    const resolve = async () => {
      const urlId = getBoardIdFromUrl();

      if (urlId) {
        const boards = await listBoards();
        const match = boards.find((b) => b.id === urlId);
        if (match) {
          setCurrentBoardId(match.id);
          setBoard(match);
          return;
        }
      }

      const boards = await listBoards();
      const next = boards[0] ?? (await createBoard());
      openBoard(next);
    };

    resolve().finally(() => setLoading(false));
  }, [openBoard]);

  return { board, loading, openBoard };
};
