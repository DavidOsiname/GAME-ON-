"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

const signUpEnabled =
  process.env.NEXT_PUBLIC_ALLOW_PUBLIC_SIGNUP === "true" &&
  process.env.NODE_ENV !== "production";

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setBusy(true);

    try {
      const result = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        callbackURL: "/account",
      });

      if (result.error) {
        setMessage(result.error.message ?? "Unable to create this account.");
        return;
      }

      setSubmitted(true);
      setMessage(
        "Your account has been created. In local development, open the server terminal and use the short-lived verification link printed there. Real email delivery is not connected yet.",
      );
    } catch {
      setMessage("Registration is unavailable. Check the server and database setup.");
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
        <p className="eyebrow">CREATE YOUR ACCOUNT</p>
        <h1>Join GAME ON MAIL</h1>
        <p className="auth-muted">Create your secure platform account.</p>

        {!signUpEnabled ? (
          <div className="auth-notice" role="status">
            Account registration is currently closed. Public sign-up will open after the mail service, verification delivery and abuse protections are ready.
          </div>
        ) : submitted ? (
          <div className="auth-notice" role="status">{message}</div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              Your name
              <input
                type="text"
                autoComplete="name"
                required
                minLength={1}
                maxLength={100}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
              />
            </label>
            <label>
              Contact email
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
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 12 characters"
              />
            </label>
            <p className="password-hint">Use at least 12 characters. Never reuse a password from another account.</p>
            {message && <p className="auth-message" role="alert">{message}</p>}
            <button className="auth-submit" type="submit" disabled={busy}>
              {busy ? "Creating account…" : "Create account"}
            </button>
          </form>
        )}

        <div className="auth-links">
          <span>Already have an account? <Link href="/sign-in">Sign in</Link></span>
        </div>
        <p className="auth-footnote">This creates a GAME ON platform account, not a public email mailbox yet. Mailboxes will be provisioned after our domain and mail server are ready.</p>
      </section>
    </main>
  );
}
