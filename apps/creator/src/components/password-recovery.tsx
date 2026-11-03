"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function PasswordRecovery({ mode }: { mode: "request" | "update" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(mode === "request");
  const [recoverySession, setRecoverySession] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (mode !== "update" || !supabase) return;
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) setRecoverySession(true);
      setReady(true);
    });
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (data.session) setRecoverySession(true);
      if (sessionError) setError("The password-reset session could not be verified. Request a new reset email.");
      setReady(true);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [mode]);

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) { setError("Password recovery is unavailable in demo mode. Connect the live Supabase project first."); return; }
    setBusy(true); setError(""); setMessage("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    if (resetError) setError(resetError.message);
    else setMessage("If an account exists for that email, a password-reset link has been sent. Check your inbox and spam folder.");
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) { setError("Password recovery is unavailable in demo mode."); return; }
    if (!recoverySession) { setError("This reset link is no longer active. Request a new one."); return; }
    if (password.length < 10) { setError("Use at least 10 characters for your new password."); return; }
    if (password !== confirmPassword) { setError("The passwords do not match."); return; }
    setBusy(true); setError(""); setMessage("");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) setError(updateError.message);
    else { setMessage("Your password has been changed. You can now sign in with your new password."); setPassword(""); setConfirmPassword(""); await supabase.auth.signOut(); }
  }

  return <main className="recovery-shell"><section className="recovery-card">
    <img className="recovery-logo" src="/game-on-logo.jpg" alt="Game ON logo"/>
    <p className="recovery-eyebrow">GAME ON ACCOUNT SECURITY</p>
    <h1>{mode === "request" ? "Reset your password" : "Choose a new password"}</h1>
    <p className="recovery-copy">{mode === "request" ? "Enter the email address connected to your account. We will send a secure reset link." : "Use a new password that you do not use on another website."}</p>
    {mode === "request" ? <form onSubmit={requestReset} className="recovery-form"><label>Email address<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com"/></label><button disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button></form> : !ready ? <p className="recovery-message">Checking reset link…</p> : !recoverySession ? <p className="recovery-error">No active reset session was found. Request a fresh reset link from the sign-in page.</p> : <form onSubmit={updatePassword} className="recovery-form"><label>New password<input type="password" autoComplete="new-password" minLength={10} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 10 characters"/></label><label>Confirm new password<input type="password" autoComplete="new-password" minLength={10} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter it again"/></label><button disabled={busy}>{busy ? "Updating…" : "Change password"}</button></form>}
    {error && <p className="recovery-error" role="alert">{error}</p>}{message && <p className="recovery-message" role="status">{message}</p>}
    <Link href="/" className="recovery-back">← Back to Game ON</Link>
  </section></main>;
}
