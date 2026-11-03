"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type SalesRow = { game_id: string; game_title: string; paid_orders: number; gross_sales_minor: number; platform_fees_minor: number; developer_net_minor: number; latest_sale_at: string | null };
const money = (minor: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 }).format(Number(minor || 0) / 100);

export default function CreatorSales() {
  const [rows, setRows] = useState<SalesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!supabase) { setLoading(false); setMessage("Connect Game ON Creator to Supabase to view verified sales."); return; }
    let active = true;
    supabase.rpc("get_creator_sales_summary").then(({ data, error }) => {
      if (!active) return;
      setLoading(false);
      if (error) setMessage(error.message.includes("function") ? "Apply database migration 0009 to enable the sales ledger." : error.message);
      else setRows((data || []) as SalesRow[]);
    });
    return () => { active = false; };
  }, []);
  const totals = useMemo(() => rows.reduce((sum, row) => ({ orders: sum.orders + Number(row.paid_orders || 0), gross: sum.gross + Number(row.gross_sales_minor || 0), fees: sum.fees + Number(row.platform_fees_minor || 0), net: sum.net + Number(row.developer_net_minor || 0) }), { orders: 0, gross: 0, fees: 0, net: 0 }), [rows]);
  return <>
    <div className="page-intro"><div><p className="eyebrow">YOUR STUDIO REVENUE</p><h1>Sales & earnings.</h1><p>View verified paid orders and your estimated developer share.</p></div><button className="creator-outline" onClick={() => window.location.reload()}>Refresh ↻</button></div>
    {message && <p className="insight-message" role="status">{message}</p>}
    <div className="stat-grid">
      <div className="stat-card"><span className="stat-icon cyan">₦</span><small>GROSS SALES</small><b>{loading ? "—" : money(totals.gross)}</b><em>Successful purchases, before deductions</em></div>
      <div className="stat-card"><span className="stat-icon amber">%</span><small>PLATFORM FEE</small><b>{loading ? "—" : money(totals.fees)}</b><em>Based on each order's fee snapshot</em></div>
      <div className="stat-card"><span className="stat-icon green">↗</span><small>ESTIMATED DEVELOPER NET</small><b>{loading ? "—" : money(totals.net)}</b><em>Before processor fees, taxes and payouts</em></div>
      <div className="stat-card"><span className="stat-icon violet">▣</span><small>PAID ORDERS</small><b>{loading ? "—" : totals.orders.toLocaleString()}</b><em>Verified successful payments</em></div>
    </div>
    <section className="surface-card analytics-card"><div className="surface-heading"><div><h2>Sales by game</h2><p>Only server-verified paid orders are included.</p></div></div>
      {loading && <p className="build-muted">Loading sales…</p>}
      {!loading && rows.length === 0 && <div className="table-empty"><span>₦</span><b>No paid orders yet</b><p>When players purchase your published games, verified sales will appear here.</p></div>}
      {rows.map((row) => <article className="analytics-row" key={row.game_id}><div className="analytics-row-head"><div><b>{row.game_title}</b><small>{Number(row.paid_orders).toLocaleString()} successful order(s)</small></div><strong>{money(Number(row.developer_net_minor))}</strong></div><div className="sales-breakdown"><span>Gross {money(Number(row.gross_sales_minor))}</span><span>Platform fee {money(Number(row.platform_fees_minor))}</span></div><small className="analytics-last">{row.latest_sale_at ? `Latest sale ${new Date(row.latest_sale_at).toLocaleString()}` : "No sales recorded"}</small></article>)}
      <p className="analytics-disclaimer">These figures are marketplace ledger estimates, not a payout statement. The proposed platform commission is stored on each order. Payment-provider charges, taxes, chargebacks, refunds and actual payout timing are handled separately. Game ON does not automatically transfer developer earnings in this release.</p>
    </section>
  </>;
}
