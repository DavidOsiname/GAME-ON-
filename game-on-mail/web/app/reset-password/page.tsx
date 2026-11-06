"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    const queryToken = new URLSearchParams(window.location.search).get("token");
    setToken(queryToken ?? "");
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setMessage("This reset link is missing its token. Request a new link.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      });

      if (result.error) {
        setMessage(result.error.message ?? "This reset link could not be used.");
        return;
      }

      setComplete(true);
      setMessage("Your password has been changed. Sign in using the new password.");
    } catch {
      setMessage("Password reset failed. The link may have expired; request another one.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="auth-brand" href="/">
          <span className="brand-mark">GO</span>
          <span><strong>GAME ON</strong><small>MAIL</small></span>
        </Link>
        <p className="eyebrow">SECURE YOUR ACCOUNT</p>
        <h1>Choose a new password</h1>
        {!token ? (
          <div className="auth-notice">No reset token was found. Open the complete reset link or request a new one.</div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              New password
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 12 characters"
              />
            </label>
            {message && <p className="auth-message" role="status">{message}</p>}
            <button className="auth-submit" type="submit" disabled={busy || complete}>
              {busy ? "Updating…" : complete ? "Password updated" : "Update password"}
            </button>
          </form>
        )}
        {complete && <div className="auth-notice" role="status">{message}</div>}
        <div className="auth-links"><Link href="/sign-in">Go to sign in</Link></div>
        <p className="auth-footnote">Changing your password revokes existing sessions.</p>
      </section>
    </main>
  );
}
