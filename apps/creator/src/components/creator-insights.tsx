"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type NotificationRow = { id: string; title: string; message: string; notification_type: string; read_at: string | null; created_at: string };
type AnalyticsRow = { game_id: string; game_title: string; game_status: string; download_link_issues: number; latest_download_link_at: string | null; approved_builds: number; latest_approved_version: string | null };

export function CreatorInbox({ userId }: { userId: string }) {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!supabase || !userId || userId.startsWith("demo-")) { setItems([]); setLoading(false); setMessage("Connect a real Game ON Creator account to receive publishing notifications."); return; }
    let active = true;
    supabase.from("notifications").select("id,title,message,notification_type,read_at,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(50)
      .then(({ data, error }) => { if (!active) return; setLoading(false); if (error) setMessage(error.message); else setItems((data || []) as NotificationRow[]); });
    return () => { active = false; };
  }, [userId]);

  async function markRead(id: string) {
    if (!supabase) return;
    const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId);
    if (error) setMessage(error.message);
    else setItems((old) => old.map((item) => item.id === id ? { ...item, read_at: new Date().toISOString() } : item));
  }
  async function markAllRead() {
    if (!supabase) return;
    const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
    if (error) setMessage(error.message);
    else { const now = new Date().toISOString(); setItems((old) => old.map((item) => item.read_at ? item : { ...item, read_at: now })); setMessage("All notifications marked as read."); }
  }
  return <>
    <div className="page-intro"><div><p className="eyebrow">STUDIO ACTIVITY</p><h1>Notifications.</h1><p>Publishing decisions and important Game ON account updates.</p></div><button className="creator-outline" onClick={markAllRead} disabled={!items.some((item) => !item.read_at)}>Mark all read</button></div>
    {message && <p className="insight-message" role="status">{message}</p>}
    <section className="surface-card insight-list">
      {loading && <p className="build-muted">Loading your notifications…</p>}
      {!loading && items.length === 0 && <div className="table-empty"><span>✦</span><b>No notifications yet</b><p>Studio verification and game publishing updates will appear here.</p></div>}
      {items.map((item) => <article className={`insight-notification ${item.read_at ? "read" : "unread"}`} key={item.id}><span className="insight-icon">{item.notification_type === "game_published" ? "✓" : item.notification_type === "build_update" ? "↻" : "✦"}</span><div><b>{item.title}</b><p>{item.message}</p><small>{new Date(item.created_at).toLocaleString()}</small></div>{!item.read_at && <button className="row-menu" onClick={() => markRead(item.id)}>Mark read</button>}</article>)}
    </section>
  </>;
}

type AnalyticsFilter = "all" | "published" | "review" | "draft" | "rejected";

function analyticsStatus(status: string) {
  const labels: Record<string, { label: string; tone: string }> = {
    draft: { label: "Draft", tone: "draft" },
    submitted: { label: "Submitted", tone: "review" },
    in_review: { label: "In review", tone: "review" },
    rejected: { label: "Changes requested", tone: "rejected" },
    published: { label: "Published", tone: "published" },
  };
  return labels[status] || { label: status.replaceAll("_", " "), tone: "draft" };
}

export function CreatorAnalytics() {
  const [rows, setRows] = useState<AnalyticsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [gameQuery, setGameQuery] = useState("");
  const [gameFilter, setGameFilter] = useState<"all" | "published" | "not_published">("all");
  const totalLinkIssues = useMemo(() => rows.reduce((sum, row) => sum + Number(row.download_link_issues || 0), 0), [rows]);
  const totalBuilds = useMemo(() => rows.reduce((sum, row) => sum + Number(row.approved_builds || 0), 0), [rows]);
  const publishedGames = useMemo(() => rows.filter((row) => row.game_status === "published").length, [rows]);
  const visibleRows = useMemo(() => {
    const term = gameQuery.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesFilter = gameFilter === "all"
        || (gameFilter === "published" && row.game_status === "published")
        || (gameFilter === "not_published" && row.game_status !== "published");
      return matchesFilter && (!term || [row.game_title, row.game_status, row.latest_approved_version || ""].join(" ").toLowerCase().includes(term));
    }).sort((a, b) => Number(b.download_link_issues || 0) - Number(a.download_link_issues || 0) || a.game_title.localeCompare(b.game_title));
  }, [rows, gameQuery, gameFilter]);

  const loadAnalytics = useCallback(async () => {
    if (!supabase) {
      setRows([]);
      setLoading(false);
      setLoadError(false);
      setMessage("Connect a real Game ON Creator account to view live studio analytics.");
      return;
    }
    setLoading(true);
    setLoadError(false);
    setMessage("");
    try {
      const { data, error } = await supabase.rpc("get_creator_game_analytics");
      if (error) {
        setLoadError(true);
        setMessage(error.message.includes("function")
          ? "Creator analytics are not available in this database yet. Apply migration 0008 to enable this report."
          : "We could not load your analytics. Refresh the report or try again later.");
        setRows([]);
      } else {
        setRows((data || []) as AnalyticsRow[]);
      }
    } catch {
      setLoadError(true);
      setMessage("We could not load your analytics. Check your connection and try again.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAnalytics(); }, [loadAnalytics]);

  const maxIssues = Math.max(0, ...rows.map((row) => Number(row.download_link_issues || 0)));
  const filterOptions = [
    { id: "all" as const, label: "All games", count: rows.length },
    { id: "published" as const, label: "Published", count: publishedGames },
    { id: "not_published" as const, label: "Not published", count: rows.length - publishedGames },
  ];

  return <div className="creator-analytics">
    <div className="page-intro analytics-page-intro">
      <div>
        <p className="eyebrow">UNDERSTAND YOUR REACH</p>
        <h1>Analytics.</h1>
        <p>See secure download-link requests and approved releases recorded for your studio.</p>
      </div>
      <button className="creator-outline" type="button" onClick={() => void loadAnalytics()} disabled={loading}>↻ {loading ? "Refreshing…" : "Refresh analytics"}</button>
    </div>

    {message && <p className={loadError ? "analytics-load-error" : "insight-message"} role="status">{message}</p>}

    <section className="analytics-metric-grid analytics-summary-grid" aria-label="Studio analytics summary">
      <article className="analytics-metric-card">
        <span className="analytics-metric-icon cyan" aria-hidden="true">↧</span>
        <div><small>DOWNLOAD LINKS ISSUED</small><strong>{loading ? "—" : totalLinkIssues.toLocaleString()}</strong><p>Secure link requests recorded by Game ON</p></div>
      </article>
      <article className="analytics-metric-card">
        <span className="analytics-metric-icon green" aria-hidden="true">✓</span>
        <div><small>APPROVED BUILDS</small><strong>{loading ? "—" : totalBuilds.toLocaleString()}</strong><p>Uploaded, scan-clean and release-approved builds</p></div>
      </article>
      <article className="analytics-metric-card">
        <span className="analytics-metric-icon violet" aria-hidden="true">▣</span>
        <div><small>TRACKED GAMES</small><strong>{loading ? "—" : rows.length.toLocaleString()}</strong><p>Games in your studio analytics report</p></div>
      </article>
      <article className="analytics-metric-card">
        <span className="analytics-metric-icon amber" aria-hidden="true">↗</span>
        <div><small>PUBLISHED GAMES</small><strong>{loading ? "—" : publishedGames.toLocaleString()}</strong><p>Listings currently marked published</p></div>
      </article>
    </section>

    <section className="analytics-meaning-panel analytics-measurement-note" aria-label="What these numbers mean">
      <div>
        <p className="eyebrow">READ YOUR METRICS CORRECTLY</p>
        <h2>What these numbers tell you</h2>
        <p>Secure download links issued are requests recorded when a link is created for an eligible published game and approved build.</p>
      </div>
      <div className="analytics-meaning-columns">
        <article><b>Included in this report</b><span>The current report includes secure download-link issues, their latest recorded issue time, approved build totals and current published listing status.</span></article>
        <article><b>Not measured here</b><span>This report does not include listing impressions, wishlists, player ratings, completed file transfers, confirmed installs, play time or sales.</span></article>
      </div>
    </section>

    <section className="surface-card analytics-card analytics-performance-card analytics-performance-section">
      <div className="analytics-performance-heading">
        <div><p className="eyebrow">GAME-BY-GAME BREAKDOWN</p><h2>Download-link activity</h2><p>Compare the number of secure download links issued for each game.</p></div>
        <span className="analytics-results-total">{loading ? "…" : visibleRows.length.toLocaleString()} shown</span>
      </div>
      <div className="analytics-controls">
        <label className="analytics-search"><span>SEARCH YOUR GAMES</span><input type="search" value={gameQuery} onChange={(event) => setGameQuery(event.target.value)} placeholder="Search game title or status…" aria-label="Search analytics by game"/></label>
        <div className="analytics-filter-row" aria-label="Filter analytics by listing status">
          {filterOptions.map((option) => <button type="button" key={option.id} className={gameFilter === option.id ? "active" : ""} aria-pressed={gameFilter === option.id} onClick={() => setGameFilter(option.id)}>{option.label}<strong>{option.count}</strong></button>)}
        </div>
      </div>

      {loading && <div className="analytics-empty-state"><span aria-hidden="true">◌</span><b>Loading studio analytics</b><p>Fetching the latest authorised studio report.</p></div>}
      {!loading && loadError && <div className="analytics-empty-state"><span aria-hidden="true">!</span><b>Analytics could not be loaded</b><p>Your game data has not been changed. Refresh to try the report again.</p><button className="creator-outline" type="button" onClick={() => void loadAnalytics()}>Try again</button></div>}
      {!loading && !loadError && rows.length === 0 && <div className="analytics-empty-state"><span aria-hidden="true">⌁</span><b>No games to report yet</b><p>Once your studio has game listings, their real download-link and approved-build activity will appear here.</p></div>}
      {!loading && !loadError && rows.length > 0 && visibleRows.length === 0 && <div className="analytics-empty-state"><span aria-hidden="true">⌕</span><b>No games match this view</b><p>Try another search term or publication filter.</p><button className="creator-outline" type="button" onClick={() => { setGameQuery(""); setGameFilter("all"); }}>Clear filters</button></div>}

      {!loading && !loadError && visibleRows.map((row) => {
        const issues = Number(row.download_link_issues || 0);
        const barWidth = maxIssues > 0 ? Math.min(100, (issues / maxIssues) * 100) : 0;
        return <article className="analytics-game-row" key={row.game_id}>
          <div className="analytics-game-heading">
            <div className="analytics-game-identity">
              <b>{row.game_title}</b>
              <span className={row.game_status === "published" ? "analytics-game-status published" : "analytics-game-status"}>{row.game_status.replaceAll("_", " ")}</span>
            </div>
            <strong className="analytics-link-count">{issues.toLocaleString()}<small>links issued</small></strong>
          </div>
          <div className="analytics-game-details">
            <span>{Number(row.approved_builds || 0).toLocaleString()} approved {Number(row.approved_builds || 0) === 1 ? "build" : "builds"}{row.latest_approved_version ? " · Latest v" + row.latest_approved_version : ""}</span>
            <span>{row.latest_download_link_at ? "Latest link " + new Date(row.latest_download_link_at).toLocaleString() : "No download link issued yet"}</span>
          </div>
          <div className="analytics-bar" role="img" aria-label={issues + " download links issued, relative to the most active game"}>
            <span style={{ width: barWidth + "%" }}/>
          </div>
          {issues === 0 && <small className="analytics-zero-note">No link activity recorded yet.</small>}
        </article>;
      })}
      <p className="analytics-disclaimer">This report counts secure download links issued by Game ON. A link being issued does not confirm the file transfer finished, the game was installed or played, or that a sale occurred. Sales reporting is separate from these link metrics.</p>
    </section>
  </div>;
}
