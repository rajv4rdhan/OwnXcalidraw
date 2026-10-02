import { useId, useState } from "react";

import { login } from "../api/auth";
import { ApiError } from "../api/client";

import "./LoginScreen.scss";

const isDarkTheme = () => document.documentElement.classList.contains("dark");

const LockIcon = () => (
  <svg
    className="private-login__icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <circle cx="12" cy="16" r="1" />
    <path d="M8 11v-4a4 4 0 0 1 8 0v4" />
  </svg>
);

export const LoginScreen = ({ onSuccess }: { onSuccess: () => void }) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const errorId = useId();

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
      console.error("Login failed", err);
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
    <div
      className={`excalidraw private-login${
        isDarkTheme() ? " theme--dark" : ""
      }`}
    >
      <form className="private-login__card" onSubmit={handleSubmit}>
        <div className="private-login__badge">
          <LockIcon />
        </div>
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
          aria-label="Password"
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            if (error) {
              setError("");
            }
          }}
        />
        {error && (
          <div className="private-login__error" id={errorId} role="alert">
            {error}
          </div>
        )}
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
