import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SAVE_TO_REMOTE_TIMEOUT } from "../app_constants";

const saveScene = vi.fn(async (..._args: unknown[]) => ({ scene: null }));

vi.mock("../api/boards", () => ({
  saveScene: (...args: unknown[]) => saveScene(...args),
  getScene: vi.fn(async () => null),
}));

import {
  cancelRemoteSave,
  scheduleRemoteSave,
  setCurrentBoardId,
} from "../data/remoteStore";

const element = { id: "el" } as any;
const appState = {} as any;
const files = {} as any;

describe("remoteStore board capture", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    saveScene.mockClear();
  });

  afterEach(() => {
    cancelRemoteSave();
    vi.useRealTimers();
  });

  it("saves to the board current at schedule time even if it changes before flush", async () => {
    setCurrentBoardId("board-A");
    scheduleRemoteSave([element], appState, files);
    // Simulate switching boards before the debounce fires.
    setCurrentBoardId("board-B");

    await vi.advanceTimersByTimeAsync(SAVE_TO_REMOTE_TIMEOUT + 10);

    expect(saveScene).toHaveBeenCalledTimes(1);
    expect(saveScene.mock.calls[0][0]).toBe("board-A");
  });

  it("does not save when there is no current board", async () => {
    setCurrentBoardId(null);
    scheduleRemoteSave([element], appState, files);

    await vi.advanceTimersByTimeAsync(SAVE_TO_REMOTE_TIMEOUT + 10);

    expect(saveScene).not.toHaveBeenCalled();
  });
});
