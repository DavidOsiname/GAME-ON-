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
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AnalyticsFilter>("all");

  const loadAnalytics = useCallback(async () => {
    if (!supabase) {
      setRows([]);
      setLoading(false);
      setMessage("Connect Supabase to view live studio analytics.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const { data, error } = await supabase.rpc("get_creator_game_analytics");
      if (error) {
        setRows([]);
        setMessage(error.message.includes("function") ? "Apply database migration 0008 to enable creator analytics." : error.message);
      } else {
        setRows((data || []) as AnalyticsRow[]);
      }
    } catch (caught) {
      setRows([]);
      setMessage(caught instanceof Error ? caught.message : "Analytics could not be loaded. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAnalytics(); }, [loadAnalytics]);

  const totalLinkIssues = useMemo(() => rows.reduce((sum, row) => sum + Number(row.download_link_issues || 0), 0), [rows]);
  const totalBuilds = useMemo(() => rows.reduce((sum, row) => sum + Number(row.approved_builds || 0), 0), [rows]);
  const publishedGames = useMemo(() => rows.filter((row) => row.game_status === "published").length, [rows]);
  const gamesWithLinkActivity = useMemo(() => rows.filter((row) => Number(row.download_link_issues || 0) > 0).length, [rows]);

  const counts = useMemo(() => ({
    all: rows.length,
    published: rows.filter((row) => row.game_status === "published").length,
    review: rows.filter((row) => ["submitted", "in_review"].includes(row.game_status)).length,
    draft: rows.filter((row) => row.game_status === "draft").length,
    rejected: rows.filter((row) => row.game_status === "rejected").length,
  }), [rows]);

  const visibleRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesFilter = filter === "all"
        || (filter === "published" && row.game_status === "published")
        || (filter === "review" && ["submitted", "in_review"].includes(row.game_status))
        || (filter === "draft" && row.game_status === "draft")
        || (filter === "rejected" && row.game_status === "rejected");
      const searchable = [row.game_title, row.game_status, row.latest_approved_version || ""].join(" ").toLowerCase();
      return matchesFilter && (!term || searchable.includes(term));
    }).sort((a, b) => Number(b.download_link_issues || 0) - Number(a.download_link_issues || 0) || a.game_title.localeCompare(b.game_title));
  }, [rows, filter, query]);

  const maxIssues = Math.max(1, ...rows.map((row) => Number(row.download_link_issues || 0)));
  const filters = [
    { id: "all" as const, label: "All games", count: counts.all },
    { id: "published" as const, label: "Published", count: counts.published },
    { id: "review" as const, label: "In review", count: counts.review },
    { id: "draft" as const, label: "Drafts", count: counts.draft },
    { id: "rejected" as const, label: "Changes requested", count: counts.rejected },
  ];

  return <div className="creator-analytics-workspace">
    <div className="page-intro analytics-page-intro">
      <div>
        <p className="eyebrow">UNDERSTAND YOUR REACH</p>
        <h1>Analytics.</h1>
        <p>See secure download-link requests and approved builds recorded for your studio. This report shows only metrics the current data service can verify.</p>
      </div>
      <button className="creator-outline" type="button" onClick={() => void loadAnalytics()} disabled={loading}>↻ {loading ? "Refreshing…" : "Refresh analytics"}</button>
    </div>

    {message && <p className="insight-message" role="status">{message}</p>}

    <section className="analytics-summary-grid" aria-label="Studio analytics summary">
      <article className="analytics-summary-card">
        <div className="analytics-summary-label"><span className="analytics-summary-icon cyan">↧</span><small>SECURE LINKS ISSUED</small></div>
        <strong>{loading ? "—" : totalLinkIssues.toLocaleString()}</strong>
        <p>Secure download links issued</p>
        <small>Issuance events, not completed transfers</small>
      </article>
      <article className="analytics-summary-card">
        <div className="analytics-summary-label"><span className="analytics-summary-icon green">✓</span><small>APPROVED BUILDS</small></div>
        <strong>{loading ? "—" : totalBuilds.toLocaleString()}</strong>
        <p>Clean and release-approved builds</p>
        <small>Across your game listings</small>
      </article>
      <article className="analytics-summary-card">
        <div className="analytics-summary-label"><span className="analytics-summary-icon violet">▣</span><small>TRACKED GAMES</small></div>
        <strong>{loading ? "—" : rows.length.toLocaleString()}</strong>
        <p>Games in your studio report</p>
        <small>All listing statuses</small>
      </article>
      <article className="analytics-summary-card">
        <div className="analytics-summary-label"><span className="analytics-summary-icon amber">✦</span><small>GAMES WITH LINK ACTIVITY</small></div>
        <strong>{loading ? "—" : gamesWithLinkActivity.toLocaleString()}</strong>
        <p>Games with a recorded link issue</p>
        <small>{loading ? "—" : publishedGames.toLocaleString()} published games</small>
      </article>
    </section>

    <section className="analytics-measurement-note" aria-label="Analytics coverage">
      <div className="analytics-measurement-icon" aria-hidden="true">i</div>
      <div>
        <b>What this report measures</b>
        <p>The current report counts each secure download-link issuance event (including repeat issuances), shows the latest recorded issuance time, and counts builds only when they are uploaded, malware-scan clean, and release-approved. It does not yet report listing impressions, wishlists, player ratings, completed file transfers, confirmed installs or sales.</p>
      </div>
    </section>

    <section className="analytics-performance-section" aria-labelledby="analytics-performance-title">
      <div className="analytics-performance-heading">
        <div><p className="eyebrow">PER-GAME BREAKDOWN</p><h2 id="analytics-performance-title">Game performance</h2><p>Games are ranked by secure download-link issuance events.</p></div>
        <span className="analytics-row-total">{loading ? "—" : visibleRows.length.toLocaleString()} shown</span>
      </div>
      <section className="surface-card analytics-workspace-card">
        <div className="analytics-toolbar">
          <label className="analytics-search"><span>SEARCH YOUR GAMES</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by game title or status…" aria-label="Search analytics by game"/></label>
          <div className="analytics-result-count" aria-live="polite"><b>{loading ? "—" : visibleRows.length.toLocaleString()}</b><span>games shown</span></div>
        </div>
        <div className="analytics-filter-row" aria-label="Filter analytics by listing status">
          {filters.map((item) => <button key={item.id} type="button" className={filter === item.id ? "active" : ""} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}<strong>{item.count}</strong></button>)}
        </div>

        {loading && <p className="build-muted">Loading studio analytics…</p>}
        {!loading && rows.length === 0 && <div className="analytics-empty"><span aria-hidden="true">⌁</span><b>No analytics yet</b><p>Once players request secure links for your published games, activity will be shown here. A link issue is not proof of an installation.</p></div>}
        {!loading && rows.length > 0 && visibleRows.length === 0 && <div className="analytics-empty"><span aria-hidden="true">⌕</span><b>No games match this view</b><p>Try a different listing-status filter or search term.</p><button className="creator-outline" type="button" onClick={() => { setFilter("all"); setQuery(""); }}>Clear filters</button></div>}

        {!loading && visibleRows.map((row) => {
          const status = analyticsStatus(row.game_status);
          const linkIssues = Number(row.download_link_issues || 0);
          const approvedBuilds = Number(row.approved_builds || 0);
          const barWidth = Math.min(100, Math.max(0, linkIssues / maxIssues * 100));
          return <article className="analytics-game-row" key={row.game_id}>
            <div className="analytics-game-heading">
              <div><b>{row.game_title}</b><small>{status.label}</small></div>
              <span className={"status-pill " + status.tone}>{status.label}</span>
            </div>
            <div className="analytics-game-metrics">
              <div className="analytics-issues-block">
                <strong>{linkIssues.toLocaleString()}</strong>
                <span>secure download-link issues</span>
              </div>
              <div className="analytics-game-builds">
                <strong>{approvedBuilds.toLocaleString()}</strong>
                <span>approved builds</span>
                <small>{row.latest_approved_version ? "Latest approved version: v" + row.latest_approved_version : "No approved build recorded yet"}</small>
              </div>
            </div>
            <div className="analytics-bar" role="img" aria-label={linkIssues.toLocaleString() + " secure download-link issues for " + row.game_title}>
              <span style={{ width: barWidth + "%" }}/>
            </div>
            <small className="analytics-last">{row.latest_download_link_at ? "Last secure link issued " + new Date(row.latest_download_link_at).toLocaleString() : "No secure download link has been issued yet"}</small>
          </article>;
        })}
      </section>
    </section>

    <p className="analytics-disclaimer">Each recorded event represents a secure download link issued by Game ON. Re-issued links are counted as separate events. This does not prove a file transfer finished, that a game was installed, or that a sale occurred. Sales reporting belongs to the separate order and payment ledger.</p>
  </div>;
}
