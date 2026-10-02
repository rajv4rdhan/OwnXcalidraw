import { apiFetch } from "./client";

import type { FileId } from "@excalidraw/element/types";

type SignedUpload = {
  uploadUrl: string;
  token: string;
  path: string;
};

/**
 * Uploads a compressed file buffer to Supabase Storage via a signed URL.
 * The API only mints the URL; the bytes go straight to storage.
 */
export const uploadFile = async (
  boardId: string,
  fileId: FileId,
  buffer: Uint8Array,
  mimeType: string,
): Promise<void> => {
  const signed = await apiFetch<SignedUpload>(`/boards/${boardId}/files/sign`, {
    method: "POST",
    body: { fileId, mimeType },
  });

  const response = await fetch(signed.uploadUrl, {
    method: "PUT",
    headers: mimeType ? { "Content-Type": mimeType } : {},
    body: new Blob([buffer.slice()]),
  });

  if (!response.ok) {
    throw new Error(`file_upload_failed:${response.status}`);
  }
};

/** Same-origin URL the browser can fetch a stored image from. */
export const fileDownloadUrl = (boardId: string, fileId: FileId) =>
  `/api/boards/${boardId}/files/${encodeURIComponent(fileId)}`;
