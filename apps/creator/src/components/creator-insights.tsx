"use client";

import { useEffect, useMemo, useState } from "react";
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

export function CreatorAnalytics() {
  const [rows, setRows] = useState<AnalyticsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const totalLinkIssues = useMemo(() => rows.reduce((sum, row) => sum + Number(row.download_link_issues || 0), 0), [rows]);
  const totalBuilds = useMemo(() => rows.reduce((sum, row) => sum + Number(row.approved_builds || 0), 0), [rows]);
  useEffect(() => {
    if (!supabase) { setLoading(false); setMessage("Connect Supabase to view live studio analytics."); return; }
    let active = true;
    supabase.rpc("get_creator_game_analytics").then(({ data, error }) => {
      if (!active) return;
      setLoading(false);
      if (error) setMessage(error.message.includes("function") ? "Apply database migration 0008 to enable creator analytics." : error.message);
      else setRows((data || []) as AnalyticsRow[]);
    });
    return () => { active = false; };
  }, []);
  const maxIssues = Math.max(1, ...rows.map((row) => Number(row.download_link_issues || 0)));
  return <>
    <div className="page-intro"><div><p className="eyebrow">UNDERSTAND YOUR REACH</p><h1>Analytics.</h1><p>Track download-link requests and approved releases for your studio.</p></div><button className="creator-outline" onClick={() => window.location.reload()}>Refresh analytics ↻</button></div>
    {message && <p className="insight-message" role="status">{message}</p>}
    <div className="stat-grid"><div className="stat-card"><span className="stat-icon cyan">↧</span><small>DOWNLOAD LINK ISSUES</small><b>{loading ? "—" : totalLinkIssues.toLocaleString()}</b><em>Not confirmed completed downloads</em></div><div className="stat-card"><span className="stat-icon green">✓</span><small>APPROVED BUILDS</small><b>{loading ? "—" : totalBuilds.toLocaleString()}</b><em>Clean and approved releases</em></div><div className="stat-card"><span className="stat-icon violet">▣</span><small>TRACKED GAMES</small><b>{loading ? "—" : rows.length}</b><em>Across your studio</em></div><div className="stat-card"><span className="stat-icon amber">↗</span><small>PUBLISHED GAMES</small><b>{loading ? "—" : rows.filter((row) => row.game_status === "published").length}</b><em>Visible in the Store</em></div></div>
    <section className="surface-card analytics-card"><div className="surface-heading"><div><h2>Game performance</h2><p>Download-link issuance by game.</p></div></div>
      {loading && <p className="build-muted">Loading performance data…</p>}
      {!loading && rows.length === 0 && <div className="table-empty"><span>⌁</span><b>No analytics yet</b><p>Once players request approved game downloads, activity will be shown here.</p></div>}
      {rows.map((row) => <article className="analytics-row" key={row.game_id}><div className="analytics-row-head"><div><b>{row.game_title}</b><small>{row.game_status.replace("_", " ")} · {row.approved_builds} approved build(s){row.latest_approved_version ? ` · v${row.latest_approved_version}` : ""}</small></div><strong>{Number(row.download_link_issues).toLocaleString()}</strong></div><div className="analytics-bar"><span style={{ width: `${Math.max(2, Number(row.download_link_issues || 0) / maxIssues * 100)}%` }}/></div><small className="analytics-last">{row.latest_download_link_at ? `Last link issued ${new Date(row.latest_download_link_at).toLocaleString()}` : "No download link has been issued yet"}</small></article>)}
      <p className="analytics-disclaimer">Important: this report counts secure download links issued by Game ON. It does not prove that the file transfer finished, that the game was installed, or that a sale occurred. Sales analytics will be added with the payment and order ledger.</p>
    </section>
  </>;
}
