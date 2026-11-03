"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ModerationBuild = { id: string; game_id: string; version_label: string; platform: string; file_size_bytes: number; original_file_name: string | null; upload_status: string; scan_status: string; release_status: string; scan_report: string | null; created_at: string; game: { title: string; slug: string; status: string } | null; studio: { studio_name: string; verification_status: string } | null };

type ModerationStudio = { id: string; studio_name: string; slug: string; verification_status: "pending" | "rejected"; description?: string | null; website_url?: string | null; created_at: string; verification_note?: string | null };

type ModerationReport = { id: string; game_id: string; category: string; details: string; status: "pending" | "in_review"; created_at: string; game: { title: string; slug: string } | null; player: { username?: string | null; display_name?: string | null } | null };

type ModerationReview = { id: string; user_id: string; game_id: string; rating: number; review_text?: string | null; created_at: string; game: { title: string; slug: string } | null; player: { username?: string | null; display_name?: string | null } | null };

type ModerationGame = {
  id: string;
  title: string;
  slug: string;
  genre: string;
  short_description: string;
  description?: string | null;
  supported_platforms: string[];
  monetization_type: string;
  offline_support: boolean;
  contains_ads: boolean;
  has_in_app_purchases: boolean;
  status: "submitted" | "in_review" | "rejected";
  rejection_reason?: string | null;
  created_at: string;
  studio: { studio_name: string; slug: string; verification_status: string } | null;
};

export default function AdminReviewApp() {
  const [games, setGames] = useState<ModerationGame[]>([]);
  const [studios, setStudios] = useState<ModerationStudio[]>([]);
  const [reviews, setReviews] = useState<ModerationReview[]>([]);
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [builds, setBuilds] = useState<ModerationBuild[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("Sign in with an account authorised by the Game ON operator.");
  const [error, setError] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [adminEmail, setAdminEmail] = useState("");

  const loadQueue = useCallback(async () => {
    if (!supabase) { setError("Connect this Creator deployment to Supabase before using admin moderation."); setLoading(false); return; }
    setLoading(true); setError("");
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (sessionError || !session) { setError("You are not signed in. Sign in through Game ON Creator, then reopen this page."); setLoading(false); return; }
    setAdminEmail(session.user.email || session.user.id);
    const response = await fetch("/api/admin/moderation", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) setError(payload.error || "Unable to load the review queue.");
    else {
      setGames(payload.games || []); setStudios(payload.studios || []); setReviews(payload.reviews || []); setReports(payload.reports || []);
      const buildResponse = await fetch("/api/admin/builds", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
      const buildPayload = await buildResponse.json().catch(() => ({}));
      if (!buildResponse.ok) setError(buildPayload.error || "Unable to load the game-build queue.");
      else setBuilds(buildPayload.builds || []);
      setMessage("Moderation queue loaded. Review studio identity, uploaded builds, game listings, player reports and feedback before publication.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { void loadQueue(); }, [loadQueue]);

  async function act(entityType: "game" | "studio" | "review" | "report", entityId: string, action: "start_review" | "approve" | "reject" | "verify" | "resolve" | "dismiss") {
    if (!supabase) return;
    const reason = reasons[entityId] || "";
    if ((action === "reject" || action === "dismiss") && reason.trim().length < 10) { setError("Please provide a clear reason (at least 10 characters)."); return; }
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) { setError("Your session expired. Sign in again."); return; }
    setBusyId(entityId); setError("");
    const response = await fetch("/api/admin/moderation", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ entityType, entityId, action, reason }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok && response.status !== 207) setError(payload.error || "The moderation action failed.");
    else {
      const changed = payload.game || payload.studio || payload.review || payload.report;
      setMessage(payload.warning || `${changed?.title || changed?.studio_name || "Record"} updated: ${changed?.status || changed?.verification_status || action}.`);
      await loadQueue();
    }
    setBusyId(null);
  }

  async function actBuild(buildId: string, action: "approve" | "reject" | "retry_scan", reason: string) {
    if (!supabase) return;
    if (action === "reject" && reason.trim().length < 10) { setError("Please provide a clear build rejection reason (at least 10 characters)."); return; }
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) { setError("Your session expired. Sign in again."); return; }
    setBusyId(buildId); setError("");
    const response = await fetch("/api/admin/builds", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ buildId, action, reason }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok && response.status !== 207) setError(payload.error || "The build release decision failed.");
    else { setMessage(payload.warning || (action === "retry_scan" ? "Build requeued for malware scanning." : `Build release decision saved: ${payload.build?.release_status || action}.`)); await loadQueue(); }
    setBusyId(null);
  }

  return <main className="admin-shell">
    <header className="admin-header">
      <a className="admin-brand" href="/"><img src="/game-on-logo.jpg" alt="Game ON logo"/><span><b>GAME ON</b><small>ADMIN REVIEW</small></span></a>
      <div><a className="admin-refresh" href="/admin/refunds">Refund requests ↗</a> <span className="admin-live-dot"/> PLATFORM MODERATION</div>
    </header>
    <section className="admin-content">
      <div className="admin-intro"><div><p className="admin-eyebrow">TRUST & SAFETY</p><h1>Review the games.</h1><p>Only authorised Game ON administrators can verify studios, review listings, moderate player feedback and resolve safety reports.</p></div><button className="admin-refresh" onClick={() => void loadQueue()} disabled={loading}>↻ Refresh queue</button></div>
      <div className="admin-security-note"><b>Protected admin area</b><span>Access is verified on the server against GAMEON_ADMIN_USER_IDS. Hiding this page is not the security control.</span></div>
      {adminEmail && <p className="admin-session">Signed in as {adminEmail}</p>}
      {message && <div className="admin-message">{message}</div>}
      {error && <div className="admin-error" role="alert">{error}</div>}
      <div className="admin-queue-heading"><div><h2>Game build security & release queue</h2><p>{builds.length} build records · clean scan required before release approval</p></div><span>{builds.filter((build) => build.upload_status === "uploaded" && build.scan_status === "quarantined").length} QUARANTINED</span></div>
      {!loading && builds.length === 0 && <div className="admin-empty">No game builds have been submitted yet.</div>}
      {!loading && builds.length > 0 && <div className="admin-list">{builds.map((build) => <article className="admin-game-card" key={build.id}>
        <div className="admin-game-top"><div><span className={`admin-status ${build.scan_status === "clean" ? "submitted" : build.scan_status === "rejected" || build.upload_status === "failed" ? "rejected" : "in_review"}`}>{build.scan_status} · {build.release_status}</span><h3>{build.game?.title || "Game unavailable"} · v{build.version_label}</h3><p>{build.studio?.studio_name || "Studio unavailable"} · {build.platform.toUpperCase()} · {(Number(build.file_size_bytes) / 1024 / 1024).toFixed(1)} MB</p></div><small>{new Date(build.created_at).toLocaleDateString()}</small></div>
        <p className="admin-game-description">{build.original_file_name || "Build file"} · upload: {build.upload_status}</p>
        {build.scan_report && <div className="admin-previous-reason"><b>Scanner report</b><p>{build.scan_report}</p></div>}
        <label className="admin-reason-label">Rejection reason (required to reject)<textarea rows={2} value={reasons[build.id] || ""} onChange={(event) => setReasons((old) => ({ ...old, [build.id]: event.target.value }))} placeholder="Explain why this build must not be released…" maxLength={1000}/></label>
        <div className="admin-actions">{build.scan_status === "failed" && build.upload_status === "uploaded" && build.release_status === "pending" && <button className="admin-secondary" onClick={() => void actBuild(build.id, "retry_scan", "")} disabled={busyId === build.id}>Retry malware scan</button>}<button className="admin-reject" onClick={() => void actBuild(build.id, "reject", reasons[build.id] || "")} disabled={busyId === build.id || build.release_status !== "pending"}>Reject build</button><button className="admin-approve" onClick={() => void actBuild(build.id, "approve", "")} disabled={busyId === build.id || build.scan_status !== "clean" || build.upload_status !== "uploaded" || build.release_status !== "pending"}>Approve for release →</button></div>
      </article>)}</div>}
      <div className="admin-queue-heading"><div><h2>Developer verification</h2><p>{studios.length} studios awaiting verification or requiring follow-up</p></div><span>{studios.filter((studio) => studio.verification_status === "pending").length} PENDING</span></div>
      {!loading && studios.length > 0 && <div className="admin-list">{studios.map((studio) => <article className="admin-game-card" key={studio.id}>
        <div className="admin-game-top"><div><span className={`admin-status ${studio.verification_status === "pending" ? "submitted" : "rejected"}`}>{studio.verification_status} verification</span><h3>{studio.studio_name}</h3><p>Studio slug: {studio.slug}</p></div><small>{new Date(studio.created_at).toLocaleDateString()}</small></div>
        {studio.description && <p className="admin-game-description">{studio.description}</p>}
        {studio.website_url && /^https?:\/\//i.test(studio.website_url) && <p><a href={studio.website_url} target="_blank" rel="noreferrer" className="admin-link">Visit studio website ↗</a></p>}
        {studio.verification_note && <div className="admin-previous-reason"><b>Previous verification note</b><p>{studio.verification_note}</p></div>}
        <label className="admin-reason-label">Reason (required to reject)<textarea rows={2} value={reasons[studio.id] || ""} onChange={(event) => setReasons((old) => ({ ...old, [studio.id]: event.target.value }))} placeholder="Explain what needs to be corrected…" maxLength={1000}/></label>
        <div className="admin-actions"><button className="admin-reject" onClick={() => void act("studio", studio.id, "reject")} disabled={busyId === studio.id}>Reject studio</button><button className="admin-approve" onClick={() => void act("studio", studio.id, "verify")} disabled={busyId === studio.id}>Verify studio →</button></div>
      </article>)}</div>}
      <div className="admin-queue-heading"><div><h2>Player safety reports</h2><p>{reports.length} reports awaiting action</p></div><span>{reports.filter((report) => report.status === "pending").length} NEW</span></div>
      {!loading && reports.length === 0 && <div className="admin-empty">No player reports are waiting for moderation.</div>}
      {!loading && reports.length > 0 && <div className="admin-list">{reports.map((report) => <article className="admin-game-card" key={report.id}>
        <div className="admin-game-top"><div><span className={`admin-status ${report.status === "pending" ? "submitted" : "in_review"}`}>{report.status.replace("_", " ")}</span><h3>{report.game?.title || "Game unavailable"}</h3><p>{report.player?.display_name || report.player?.username || "Game ON player"} · {new Date(report.created_at).toLocaleDateString()}</p></div><small>{report.category.replaceAll("_", " ")}</small></div>
        <p className="admin-game-description">{report.details}</p>
        <label className="admin-reason-label">Moderator note / dismissal reason<textarea rows={2} value={reasons[report.id] || ""} onChange={(event) => setReasons((old) => ({ ...old, [report.id]: event.target.value }))} placeholder="Record the action taken or explain why this report is dismissed…" maxLength={1000}/></label>
        <div className="admin-actions"><button className="admin-secondary" onClick={() => void act("report", report.id, "start_review")} disabled={busyId === report.id || report.status === "in_review"}>Mark in review</button><button className="admin-reject" onClick={() => void act("report", report.id, "dismiss")} disabled={busyId === report.id}>Dismiss</button><button className="admin-approve" onClick={() => void act("report", report.id, "resolve")} disabled={busyId === report.id}>Resolve report →</button></div>
      </article>)}</div>}
      <div className="admin-queue-heading"><div><h2>Player review moderation</h2><p>{reviews.length} player reviews awaiting approval</p></div><span>{reviews.length} PENDING</span></div>
      {!loading && reviews.length > 0 && <div className="admin-list">{reviews.map((review) => <article className="admin-game-card" key={review.id}>
        <div className="admin-game-top"><div><span className="admin-status submitted">pending review</span><h3>{review.game?.title || "Game unavailable"}</h3><p>{review.player?.display_name || review.player?.username || "Game ON player"} · {new Date(review.created_at).toLocaleDateString()}</p></div><strong className="admin-rating">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</strong></div>
        <p className="admin-game-description">{review.review_text || "Rating submitted without written comment."}</p>
        <label className="admin-reason-label">Reason (required to reject)<textarea rows={2} value={reasons[review.id] || ""} onChange={(event) => setReasons((old) => ({ ...old, [review.id]: event.target.value }))} placeholder="Explain why this review is not suitable for publication…" maxLength={1000}/></label>
        <div className="admin-actions"><button className="admin-reject" onClick={() => void act("review", review.id, "reject")} disabled={busyId === review.id}>Reject review</button><button className="admin-approve" onClick={() => void act("review", review.id, "approve")} disabled={busyId === review.id}>Approve review →</button></div>
      </article>)}</div>}
      <div className="admin-queue-heading"><div><h2>Game listing moderation</h2><p>{games.length} listings awaiting attention or recently rejected</p></div><span>{games.filter((g) => g.status === "submitted").length} NEW</span></div>
      {loading ? <div className="admin-empty">Loading review queue…</div> : games.length === 0 ? <div className="admin-empty"><b>No listings in the queue.</b><p>New developer submissions will appear here.</p></div> : <div className="admin-list">{games.map((game) => <article className="admin-game-card" key={game.id}>
        <div className="admin-game-top"><div><span className={`admin-status ${game.status}`}>{game.status.replace("_", " ")}</span><h3>{game.title}</h3><p>{game.studio?.studio_name || "Studio unavailable"} · {game.genre} · {game.supported_platforms?.join(", ")}</p></div><small>{new Date(game.created_at).toLocaleDateString()}</small></div>
        <p className="admin-game-description">{game.short_description}</p>
        {game.description && <details><summary>Full game description</summary><p>{game.description}</p></details>}
        <div className="admin-disclosures"><span>{game.monetization_type.replaceAll("_", " ")}</span><span>{game.offline_support ? "Offline play" : "Online required"}</span><span>{game.contains_ads ? "Contains ads" : "No ads declared"}</span><span>{game.has_in_app_purchases ? "Has in-app purchases" : "No IAP declared"}</span><span>Studio: {game.studio?.verification_status || "unknown"}</span></div>
        {game.rejection_reason && <div className="admin-previous-reason"><b>Previous rejection</b><p>{game.rejection_reason}</p></div>}
        <label className="admin-reason-label">Rejection reason (required to reject)<textarea rows={2} value={reasons[game.id] || ""} onChange={(event) => setReasons((old) => ({ ...old, [game.id]: event.target.value }))} placeholder="Explain what needs to be corrected…" maxLength={1000}/></label>
        <div className="admin-actions"><button className="admin-secondary" onClick={() => void act("game", game.id, "start_review")} disabled={busyId === game.id || game.status === "in_review"}>{busyId === game.id ? "Saving…" : "Mark in review"}</button><button className="admin-reject" onClick={() => void act("game", game.id, "reject")} disabled={busyId === game.id}>Reject listing</button><button className="admin-approve" onClick={() => void act("game", game.id, "approve")} disabled={busyId === game.id}>Approve & publish →</button></div>
      </article>)}</div>}
      <footer className="admin-footer"><a href="/">← Back to Creator Studio</a><span>Game ON · Internal moderation tools</span></footer>
    </section>
  </main>;
}
