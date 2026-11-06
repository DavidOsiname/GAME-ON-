"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const result = await authClient.requestPasswordReset({
        email: email.trim().toLowerCase(),
        redirectTo: "/reset-password",
      });

      if (result.error) {
        setMessage(result.error.message ?? "Unable to request password recovery.");
        return;
      }

      setMessage(
        "If this account exists, a reset request has been recorded. In local development, check the server terminal for the short-lived reset link. Real email delivery is not connected yet.",
      );
    } catch {
      setMessage("Password recovery is unavailable. Check the server and database setup.");
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
        <p className="eyebrow">ACCOUNT RECOVERY</p>
        <h1>Reset your password</h1>
        <p className="auth-muted">Enter the contact email attached to your account.</p>
        {process.env.NEXT_PUBLIC_MAIL_DELIVERY_ENABLED !== "true" ? (
          <div className="auth-notice">
            Password recovery email delivery is not connected yet. It will be enabled after the GAME ON mail server is operational. Do not use this screen for a production account yet.
          </div>
        ) : (
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email address
            <input
              type="email"
              autoComplete="email"
              required
              maxLength={320}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>
          {message && <p className="auth-message" role="status">{message}</p>}
          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? "Requesting…" : "Request reset link"}
          </button>
        </form>
        )}
        <div className="auth-links"><Link href="/sign-in">Back to sign in</Link></div>
        <p className="auth-footnote">Recovery links are short-lived. In production, this flow will remain unavailable until GAME ON MAIL can securely deliver them.</p>
      </section>
    </main>
  );
}
