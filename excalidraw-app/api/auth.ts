import { apiFetch } from "./client";

export const getSession = () => apiFetch<{ authed: boolean }>("/session");

export const login = (password: string) =>
  apiFetch<{ authed: boolean }>("/login", {
    method: "POST",
    body: { password },
  });

export const logout = () =>
  apiFetch<{ authed: boolean }>("/logout", { method: "POST" });
