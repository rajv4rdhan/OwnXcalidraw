import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { useEffect, useState } from "react";

import {
  createBoard,
  deleteBoard,
  listBoards,
  renameBoard,
} from "../api/boards";
import { getScopedStorageKeys } from "../data/localStorage";

import type { Board } from "../api/boards";

import "./BoardPicker.scss";

export const BoardPicker = ({
  currentBoardId,
  onSelect,
  onClose,
}: {
  currentBoardId: string | null;
  onSelect: (board: Board) => void;
  onClose: () => void;
}) => {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setBoards(await listBoards());
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    setBusy(true);
    try {
      const board = await createBoard();
      setBoards((prev) => [board, ...prev]);
      onSelect(board);
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (board: Board) => {
    const name = window.prompt("Board name", board.name);
    if (name === null || name === board.name) {
      return;
    }
    const updated = await renameBoard(board.id, name);
    setBoards((prev) => prev.map((b) => (b.id === board.id ? updated : b)));
  };

  const handleDelete = async (board: Board) => {
    if (!window.confirm(`Delete "${board.name}"? This cannot be undone.`)) {
      return;
    }
    setBusy(true);
    try {
      await deleteBoard(board.id);
      // Drop the per-board local cache too.
      const { elements, appState } = getScopedStorageKeys(board.id);
      localStorage.removeItem(elements);
      localStorage.removeItem(appState);
      setBoards((prev) => prev.filter((b) => b.id !== board.id));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="Your boards"
      onCloseRequest={onClose}
      size="small"
      className="board-picker"
    >
      <div className="board-picker__list">
        {loading && <div className="board-picker__empty">Loading…</div>}
        {!loading && boards.length === 0 && (
          <div className="board-picker__empty">No boards yet.</div>
        )}
        {boards.map((board) => (
          <div
            key={board.id}
            className={`board-picker__item${
              board.id === currentBoardId ? " is-active" : ""
            }`}
          >
            <button
              className="board-picker__open"
              onClick={() => onSelect(board)}
            >
              {board.name}
            </button>
            <div className="board-picker__actions">
              <button onClick={() => handleRename(board)} disabled={busy}>
                Rename
              </button>
              <button onClick={() => handleDelete(board)} disabled={busy}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        className="board-picker__create"
        onClick={handleCreate}
        disabled={busy}
      >
        + New board
      </button>
    </Dialog>
  );
};
