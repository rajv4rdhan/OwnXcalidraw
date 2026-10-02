/**
 * Thin fetch wrapper for the serverless API.
 *
 * All board/scene/file data flows through these helpers; the browser never
 * talks to Supabase directly.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
    this.name = "ApiError";
  }
}

export type ApiFetchOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
};

export const apiFetch = async <T>(
  path: string,
  { method = "GET", body }: ApiFetchOptions = {},
): Promise<T> => {
  const response = await fetch(`/api${path}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(response.status, payload?.error ?? "request_failed");
  }
  return payload as T;
};
