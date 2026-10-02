import { useEffect, useState } from "react";

import { getSession } from "../api/auth";

import { LoginScreen } from "./LoginScreen";

type Status = "loading" | "authed" | "unauthed";

/**
 * Wraps the app and only renders `children` once the session is authenticated.
 * Shows the password screen otherwise.
 */
export const AuthGate = ({ children }: { children: React.ReactNode }) => {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    getSession()
      .then(({ authed }) => setStatus(authed ? "authed" : "unauthed"))
      .catch(() => setStatus("unauthed"));
  }, []);

  if (status === "loading") {
    return null;
  }

  if (status === "unauthed") {
    return <LoginScreen onSuccess={() => setStatus("authed")} />;
  }

  return <>{children}</>;
};
