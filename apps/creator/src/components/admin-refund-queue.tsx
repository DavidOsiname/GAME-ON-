"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
type RefundRow = { id: string; reason: string; status: string; requested_at: string; marketplace_orders: { reference: string; game_title_snapshot: string; amount_minor: number; currency: string; status: string; provider_transaction_id: string | null } | null };
const money = (minor: number, currency: string) => new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(minor || 0) / 100);
export default function AdminRefundQueue() {
  const [rows, setRows] = useState<RefundRow[]>([]); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState<string | null>(null); const [notes, setNotes] = useState<Record<string,string>>({}); const [message,setMessage] = useState(""); const [error,setError] = useState("");
  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); setError("Connect this Creator deployment to Supabase first."); return; }
    setLoading(true); const { data } = await supabase.auth.getSession(); const token = data.session?.access_token;
    if (!token) { setLoading(false); setError("Sign in with an authorised administrator account."); return; }
    const response = await fetch("/api/admin/refunds", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }); const payload = await response.json().catch(() => ({}));
    if (!response.ok) setError(payload.error || "Unable to load refund requests."); else { setRows(payload.refunds || []); setError(""); }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function act(id: string, action: "reject" | "process") {
    if (!supabase) return; const note = notes[id] || "";
    if (action === "reject" && note.trim().length < 10) { setError("Add a clear reason of at least 10 characters before rejecting."); return; }
    const { data } = await supabase.auth.getSession(); const token = data.session?.access_token; if (!token) { setError("Your admin session expired."); return; }
    setBusy(id); setError(""); const response = await fetch("/api/admin/refunds", { method:"PATCH", headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`}, body:JSON.stringify({refundId:id,action,note}) }); const payload = await response.json().catch(()=>({}));
    if (!response.ok && response.status !== 207) setError(payload.error || "Refund action failed."); else { setMessage(action === "process" ? "Refund submitted to Paystack; wait for provider status confirmation." : "Refund request rejected and recorded."); await load(); }
    setBusy(null);
  }
  return <main className="admin-shell"><header className="admin-header"><a className="admin-brand" href="/admin"><img src="/game-on-logo.jpg" alt="Game ON"/><span><b>GAME ON</b><small>REFUND REVIEW</small></span></a><div><span className="admin-live-dot"/> FINANCE OPERATIONS</div></header><section className="admin-content"><div className="admin-intro"><div><p className="admin-eyebrow">PLAYER PURCHASE SUPPORT</p><h1>Refund requests.</h1><p>Review requests, then reject with a reason or submit an approved full refund to Paystack.</p></div><button className="admin-refresh" onClick={()=>void load()} disabled={loading}>↻ Refresh</button></div><div className="admin-security-note"><b>Protected admin area</b><span>Every action is checked against GAMEON_ADMIN_USER_IDS on the server. Processing a refund sends a real request to the configured Paystack integration.</span></div>{message && <div className="admin-message">{message}</div>}{error && <div className="admin-error" role="alert">{error}</div>}{loading && <div className="admin-empty">Loading refund queue…</div>}{!loading && rows.length===0 && <div className="admin-empty">No refund requests are waiting.</div>}<div className="admin-list">{rows.map((row)=>{const order=row.marketplace_orders; return <article className="admin-game-card" key={row.id}><div className="admin-game-top"><div><span className={`admin-status ${row.status === "processed" ? "submitted" : row.status === "rejected" || row.status === "failed" ? "rejected" : "in_review"}`}>{row.status.replace("_"," ")}</span><h3>{order?.game_title_snapshot || "Game purchase"}</h3><p>{order ? `${money(order.amount_minor,order.currency)} · ${order.reference}` : "Order details unavailable"}</p></div><small>{new Date(row.requested_at).toLocaleString()}</small></div><p className="admin-game-description">{row.reason}</p>{row.status === "requested" && <><label className="admin-reason-label">Admin note<textarea rows={2} maxLength={1000} value={notes[row.id] || ""} onChange={e=>setNotes(old=>({...old,[row.id]:e.target.value}))} placeholder="Explain rejection or add an internal processing note…"/></label><div className="admin-actions"><button className="admin-secondary" disabled={busy===row.id} onClick={()=>void act(row.id,"reject")}>Reject request</button><button className="admin-primary" disabled={busy===row.id} onClick={()=>void act(row.id,"process")}>{busy===row.id?"Processing…":"Approve & submit full refund"}</button></div></>}</article>;})}</div></section></main>;
}
