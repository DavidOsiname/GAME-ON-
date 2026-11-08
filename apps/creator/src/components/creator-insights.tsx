"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type NotificationRow = { id: string; title: string; message: string; notification_type: string; read_at: string | null; created_at: string };
type AnalyticsRow = { game_id: string; game_title: string; game_status: string; download_link_issues: number; latest_download_link_at: string | null; approved_builds: number; latest_approved_version: string | null };

type NotificationFilter = "all" | "unread" | "read";

function notificationPresentation(type: string) {
  const labels: Record<string, { label: string; icon: string }> = {
    game_published: { label: "Game published", icon: "✓" },
    build_update: { label: "Build update", icon: "↻" },
    game_rejected: { label: "Review feedback", icon: "!" },
    studio_verified: { label: "Studio verification", icon: "◆" },
  };
  return labels[type] || { label: "Studio update", icon: "✦" };
}

export function CreatorInbox({ userId }: { userId: string }) {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadNotifications() {
      setLoading(true);
      setMessage("");
      if (!supabase || !userId || userId.startsWith("demo-")) {
        setItems([]);
        setLoading(false);
        setMessage("Connect a real Game ON Creator account to receive publishing notifications.");
        return;
      }
      try {
        const { data, error } = await supabase
          .from("notifications")
          .select("id,title,message,notification_type,read_at,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50);
        if (!active) return;
        if (error) {
          setMessage("Notifications could not be loaded: " + error.message);
        } else {
          setItems((data || []) as NotificationRow[]);
        }
      } catch (caught) {
        if (active) setMessage(caught instanceof Error ? caught.message : "Notifications could not be loaded. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadNotifications();
    return () => { active = false; };
  }, [userId, refreshKey]);

  const unreadCount = useMemo(() => items.filter((item) => !item.read_at).length, [items]);
  const readCount = items.length - unreadCount;
  const visibleItems = useMemo(() => {
    const term = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesFilter = filter === "all" || (filter === "unread" && !item.read_at) || (filter === "read" && Boolean(item.read_at));
      const searchable = [item.title, item.message, item.notification_type].join(" ").toLowerCase();
      return matchesFilter && (!term || searchable.includes(term));
    });
  }, [items, filter, query]);

  async function markRead(id: string) {
    if (!supabase || pendingIds.has(id) || markingAll) return;
    const now = new Date().toISOString();
    setPendingIds((old) => new Set(old).add(id));
    setMessage("");
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: now })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) setMessage("This notification could not be marked as read: " + error.message);
      else setItems((old) => old.map((item) => item.id === id ? { ...item, read_at: now } : item));
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "This notification could not be updated.");
    } finally {
      setPendingIds((old) => {
        const next = new Set(old);
        next.delete(id);
        return next;
      });
    }
  }

  async function markAllRead() {
    if (!supabase || unreadCount === 0 || markingAll || pendingIds.size > 0) return;
    const now = new Date().toISOString();
    setMarkingAll(true);
    setMessage("");
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: now })
        .eq("user_id", userId)
        .is("read_at", null);
      if (error) setMessage("Notifications could not be marked as read: " + error.message);
      else {
        setItems((old) => old.map((item) => item.read_at ? item : { ...item, read_at: now }));
        setMessage("All notifications marked as read.");
      }
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Notifications could not be updated.");
    } finally {
      setMarkingAll(false);
    }
  }

  const filters = [
    { id: "all" as const, label: "All", count: items.length },
    { id: "unread" as const, label: "Unread", count: unreadCount },
    { id: "read" as const, label: "Read", count: readCount },
  ];

  return <div className="creator-inbox-workspace">
    <div className="page-intro inbox-page-intro">
      <div>
        <p className="eyebrow">STUDIO ACTIVITY</p>
        <h1>Notifications.</h1>
        <p>Publishing decisions and important Game ON account updates.</p>
      </div>
      <div className="inbox-header-actions">
        <button className="creator-outline" type="button" onClick={() => setRefreshKey((key) => key + 1)} disabled={loading}>↻ {loading ? "Refreshing…" : "Refresh"}</button>
        <button className="creator-primary compact" type="button" onClick={markAllRead} disabled={loading || markingAll || unreadCount === 0 || pendingIds.size > 0}>{markingAll ? "Updating…" : "Mark all read"}</button>
      </div>
    </div>

    <section className="inbox-summary-grid" aria-label="Notification summary">
      <article><span>UNREAD</span><strong>{loading ? "—" : unreadCount.toLocaleString()}</strong><small>Needs your attention</small></article>
      <article><span>READ</span><strong>{loading ? "—" : readCount.toLocaleString()}</strong><small>Already seen</small></article>
      <article><span>TOTAL</span><strong>{loading ? "—" : items.length.toLocaleString()}</strong><small>Latest 50 notifications</small></article>
    </section>

    {message && <p className="insight-message" role="status">{message}</p>}

    <section className="surface-card inbox-list-card" aria-label="Studio notifications">
      <div className="inbox-toolbar">
        <label className="inbox-search">
          <span>SEARCH NOTIFICATIONS</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles, messages or update type…" aria-label="Search notifications"/>
        </label>
        <div className="inbox-result-count" aria-live="polite"><b>{loading ? "—" : visibleItems.length.toLocaleString()}</b><span>shown</span></div>
      </div>

      <div className="inbox-filter-row" aria-label="Filter notifications">
        {filters.map((item) => <button type="button" key={item.id} className={filter === item.id ? "active" : ""} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}<strong>{item.count}</strong></button>)}
      </div>

      {loading && <div className="inbox-empty-state"><span aria-hidden="true">↻</span><b>Loading notifications</b><p>Checking the latest publishing and studio updates.</p></div>}
      {!loading && items.length === 0 && <div className="inbox-empty-state"><span aria-hidden="true">✦</span><b>No notifications yet</b><p>Studio verification and game publishing updates will appear here.</p></div>}
      {!loading && items.length > 0 && visibleItems.length === 0 && <div className="inbox-empty-state"><span aria-hidden="true">⌕</span><b>No notifications match this view</b><p>Try another filter or search term.</p><button className="creator-outline" type="button" onClick={() => { setFilter("all"); setQuery(""); }}>Clear filters</button></div>}

      {!loading && visibleItems.map((item) => {
        const presentation = notificationPresentation(item.notification_type);
        const isPending = pendingIds.has(item.id) || markingAll;
        return <article className={"inbox-notification " + (item.read_at ? "read" : "unread")} key={item.id}>
          <span className={"inbox-notification-icon " + (item.read_at ? "read" : "unread")} aria-hidden="true">{presentation.icon}</span>
          <div className="inbox-notification-copy">
            <div className="inbox-notification-heading"><b>{item.title}</b><span>{presentation.label}</span></div>
            <p>{item.message}</p>
            <small>{new Date(item.created_at).toLocaleString()}</small>
          </div>
          <div className="inbox-notification-action">
            {item.read_at ? <span className="inbox-read-label">Read</span> : <button className="row-menu" type="button" onClick={() => void markRead(item.id)} disabled={isPending}>{pendingIds.has(item.id) ? "Updating…" : "Mark read"}</button>}
          </div>
        </article>;
      })}
    </section>
    <p className="inbox-footnote">Only notifications returned for your signed-in Creator account are shown here.</p>
  </div>;
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
        <div className="analytics-summary-label"><span className="analytics-summary-icon cyan">↧</span><small>SECURE LINK ISSUES</small></div>
        <strong>{loading ? "—" : totalLinkIssues.toLocaleString()}</strong>
        <p>Secure download links issued</p>
        <small>Not confirmed completed downloads</small>
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
        <p>The current report includes secure download-link issues, their latest recorded time, and clean, release-approved build records. It does not yet report listing impressions, wishlists, player ratings, completed file transfers, confirmed installs or sales.</p>
      </div>
    </section>

    <section className="analytics-performance-section" aria-labelledby="analytics-performance-title">
      <div className="analytics-performance-heading">
        <div><p className="eyebrow">PER-GAME BREAKDOWN</p><h2 id="analytics-performance-title">Game performance</h2><p>Games are ranked by recorded secure download-link issues.</p></div>
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

    <p className="analytics-disclaimer">This report counts secure download links issued by Game ON. It does not prove that a file transfer finished, that a game was installed, or that a sale occurred. Sales reporting belongs to the separate order and payment ledger.</p>
  </div>;
}
