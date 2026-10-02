import { createHmac, timingSafeEqual } from "node:crypto";

import { readAuthEnv } from "./env";
import { sendJson } from "./http";

import type { VercelRequest, VercelResponse } from "@vercel/node";

const COOKIE_NAME = "excalidraw_session";
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

/** Constant-time string comparison (equal length enforced internally). */
export const safeEqual = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
};

const sign = (payload: string, secret: string) =>
  createHmac("sha256", secret).update(payload).digest("base64url");

/** Creates a `payload.signature` session token valid until `expiresAt`. */
export const createSessionToken = (): string => {
  const { sessionSecret } = readAuthEnv();
  const expiresAt = Date.now() + SESSION_MAX_AGE_SEC * 1000;
  const payload = Buffer.from(JSON.stringify({ expiresAt })).toString(
    "base64url",
  );
  return `${payload}.${sign(payload, sessionSecret)}`;
};

/** Verifies a session token's signature and expiry. */
export const verifySessionToken = (token: string | undefined): boolean => {
  if (!token) {
    return false;
  }
  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return false;
  }

  const { sessionSecret } = readAuthEnv();
  if (!safeEqual(signature, sign(payload, sessionSecret))) {
    return false;
  }

  try {
    const { expiresAt } = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    return typeof expiresAt === "number" && expiresAt > Date.now();
  } catch {
    return false;
  }
};

const isSecureRequest = (req: VercelRequest) =>
  process.env.VERCEL === "1" ||
  (req.headers["x-forwarded-proto"] ?? "") === "https";

/** Sets the signed session cookie. */
export const setSessionCookie = (req: VercelRequest, res: VercelResponse) => {
  const parts = [
    `${COOKIE_NAME}=${createSessionToken()}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${SESSION_MAX_AGE_SEC}`,
  ];
  if (isSecureRequest(req)) {
    parts.push("Secure");
  }
  res.setHeader("Set-Cookie", parts.join("; "));
};

/** Clears the session cookie. */
export const clearSessionCookie = (req: VercelRequest, res: VercelResponse) => {
  const parts = [
    `${COOKIE_NAME}=`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    "Max-Age=0",
  ];
  if (isSecureRequest(req)) {
    parts.push("Secure");
  }
  res.setHeader("Set-Cookie", parts.join("; "));
};

/** Parses a cookie value from the request. */
export const readCookie = (
  req: VercelRequest,
  name: string,
): string | undefined => {
  const header = req.headers.cookie;
  if (!header) {
    return undefined;
  }
  for (const pair of header.split(";")) {
    const [key, value] = pair.trim().split("=");
    if (key === name) {
      return value;
    }
  }
  return undefined;
};

export const isAuthenticated = (req: VercelRequest): boolean =>
  verifySessionToken(readCookie(req, COOKIE_NAME));

/** Returns true when the request was rejected (unauthenticated). */
export const rejectUnauthenticated = (
  req: VercelRequest,
  res: VercelResponse,
): boolean => {
  if (isAuthenticated(req)) {
    return false;
  }
  sendJson(res, 401, { error: "unauthorized" });
  return true;
};
