import { useState } from "react";

import { login } from "../api/auth";
import { ApiError } from "../api/client";

import "./LoginScreen.scss";

export const LoginScreen = ({ onSuccess }: { onSuccess: () => void }) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password || submitting) {
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await login(password);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.code === "too_many_attempts") {
        setError("Too many attempts. Try again in a minute.");
      } else {
        setError("Incorrect password.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="private-login">
      <form className="private-login__card" onSubmit={handleSubmit}>
        <h1 className="private-login__title">Private board</h1>
        <p className="private-login__subtitle">
          Enter the password to open your drawings.
        </p>
        <input
          className="private-login__input"
          type="password"
          autoFocus
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error && <div className="private-login__error">{error}</div>}
        <button
          className="private-login__submit"
          type="submit"
          disabled={submitting || !password}
        >
          {submitting ? "Unlocking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
};
