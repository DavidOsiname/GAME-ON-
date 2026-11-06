"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setBusy(true);

    try {
      const result = await authClient.signIn.email({
        email: email.trim().toLowerCase(),
        password,
        callbackURL: "/account",
      });

      if (result.error) {
        setMessage(result.error.message ?? "Unable to sign in. Check your details.");
        return;
      }

      window.location.assign("/account");
    } catch {
      setMessage("The sign-in service is unavailable. Check the server and database.");
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
        <p className="eyebrow">WELCOME BACK</p>
        <h1>Sign in to your account</h1>
        <p className="auth-muted">Use your GAME ON MAIL account credentials.</p>

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
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
            />
          </label>
          {message && <p className="auth-message" role="alert">{message}</p>}
          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="auth-links">
          <Link href="/forgot-password">Forgot password?</Link>
          {process.env.NEXT_PUBLIC_ALLOW_PUBLIC_SIGNUP === "true" && (
            <span>New here? <Link href="/sign-up">Create an account</Link></span>
          )}
        </div>
        <p className="auth-footnote">Your account is protected by secure, server-managed sessions.</p>
      </section>
    </main>
  );
}
