"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { demoGames, Game, mapGame } from "@/lib/catalog";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

type Tab = "discover" | "library" | "wishlist" | "purchases" | "notifications" | "profile";
type AuthMode = "signin" | "signup";
type PlayerReview = { id: string; rating: number; review_text: string | null; created_at: string };
type PlayerNotification = { id: string; title: string; message: string; notification_type: string; read_at: string | null; created_at: string };
type PurchaseOrder = { id: string; reference: string; game_title_snapshot: string; amount_minor: number; currency: string; status: string; created_at: string; paid_at: string | null; refund_requests?: { id: string; status: string; reason: string; requested_at: string }[] | { id: string; status: string; reason: string; requested_at: string } | null };
const formatMoney = (minor: number, currency: string) => new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(minor || 0) / 100);

export default function StoreApp() {
  const [tab, setTab] = useState<Tab>("discover");
  const [games, setGames] = useState<Game[]>(demoGames);
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("All games");
  const [platformFilter, setPlatformFilter] = useState("All platforms");
  const [priceFilter, setPriceFilter] = useState("Any price");
  const [offlineOnly, setOfflineOnly] = useState(false);
  const [sortMode, setSortMode] = useState<"newest" | "title" | "free-first" | "price-low">("newest");
  const [fitOpen, setFitOpen] = useState(false);
  const [fitPlatform, setFitPlatform] = useState("Any device");
  const [fitBudgetAmount, setFitBudgetAmount] = useState("");
  const [fitBudgetCurrency, setFitBudgetCurrency] = useState("NGN");
  const [fitConnection, setFitConnection] = useState("Any connection");
  const [fitGenre, setFitGenre] = useState("Any genre");
  const [selected, setSelected] = useState<Game | null>(null);
  const [library, setLibrary] = useState<string[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [notice, setNotice] = useState(isSupabaseConfigured ? "Connecting to the Game ON catalogue…" : "Demo catalogue · fictional sample games");
  const [busy, setBusy] = useState(false);
  const [reviews, setReviews] = useState<PlayerReview[]>([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState("misleading_listing");
  const [reportDetails, setReportDetails] = useState("");
  const [reportMessage, setReportMessage] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState("");
  const [notifications, setNotifications] = useState<PlayerNotification[]>([]);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [purchaseMessage, setPurchaseMessage] = useState("");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [refundReasons, setRefundReasons] = useState<Record<string, string>>({});
  const [refundBusy, setRefundBusy] = useState<string | null>(null);

  useEffect(() => {
    try {
      setLibrary(JSON.parse(localStorage.getItem("gos-library") || "[]"));
      setWishlist(JSON.parse(localStorage.getItem("gos-wishlist") || "[]"));
    } catch { /* start with an empty local library */ }
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ? { id: data.session.user.id, email: data.session.user.email } : null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ? { id: session.user.id, email: session.user.email } : null));
    let active = true;
    supabase.from("games").select("id,title,slug,genre,short_description,description,supported_platforms,monetization_type,price_minor,currency,offline_support,contains_ads,has_in_app_purchases,developer_studios(studio_name)").eq("status", "published").order("created_at", { ascending: false }).then(({ data, error }) => {
      if (!active) return;
      if (error) { setGames([]); setNotice("We couldn't load the live catalogue. Please refresh or try again later."); }
      else { setGames((data || []).map((row) => mapGame(row as unknown as Record<string, unknown>))); setNotice(data?.length ? "Live Game ON catalogue" : "Your live catalogue is connected. Approved games will appear here."); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!supabase || !user || user.id.startsWith("demo-")) return;
    let active = true;
    Promise.all([
      supabase.from("user_library").select("game_id").eq("user_id", user.id),
      supabase.from("wishlists").select("game_id").eq("user_id", user.id),
    ]).then(([libraryResult, wishlistResult]) => {
      if (!active) return;
      if (!libraryResult.error && libraryResult.data) setLibrary(libraryResult.data.map((row) => String(row.game_id)));
      if (!wishlistResult.error && wishlistResult.data) setWishlist(wishlistResult.data.map((row) => String(row.game_id)));
    });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!supabase || !user || user.id.startsWith("demo-")) { setNotifications([]); return; }
    let active = true;
    Promise.all([
      supabase.from("notifications").select("id,title,message,notification_type,read_at,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("profiles").select("display_name,username").eq("id", user.id).maybeSingle(),
    ]).then(([notificationResult, profileResult]) => {
      if (!active) return;
      if (!notificationResult.error) setNotifications((notificationResult.data || []) as PlayerNotification[]);
      if (!profileResult.error && profileResult.data) {
        setProfileName(profileResult.data.display_name || "");
        setProfileUsername(profileResult.data.username || "");
      }
    });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!selected) { setReviews([]); setReviewMessage(""); setReportOpen(false); setReportMessage(""); return; }
    if (!supabase || selected.id.startsWith("demo-")) { setReviews([]); return; }
    let active = true;
    setReviews([]); setReviewMessage("");
    supabase.from("reviews").select("id,rating,review_text,created_at").eq("game_id", selected.id).eq("moderation_status", "approved").order("created_at", { ascending: false }).limit(20)
      .then(({ data, error }) => { if (!active) return; if (!error) setReviews((data || []) as PlayerReview[]); });
    return () => { active = false; };
  }, [selected]);

  useEffect(() => {
    const client = supabase;
    if (!user || user.id.startsWith("demo-") || !client) { setPurchases([]); return; }
    let active = true;
    setPurchasesLoading(true);
    client.auth.getSession().then(async ({ data }) => {
      const token = data.session?.access_token;
      if (!token) { if (active) setPurchasesLoading(false); return; }
      const response = await fetch("/api/orders", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!active) return;
      if (response.ok) setPurchases((payload.orders || []) as PurchaseOrder[]);
      else setPurchaseMessage(payload.error || "Unable to load purchases.");
      setPurchasesLoading(false);
    });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") !== "return" || !params.get("reference")) return;
    const reference = params.get("reference") || "";
    const client = supabase;
    if (!user || user.id.startsWith("demo-") || !client) {
      setPurchaseMessage("Sign in to the same Game ON account used at checkout to verify your purchase.");
      setTab("purchases");
      return;
    }
    let active = true;
    client.auth.getSession().then(async ({ data }) => {
      const token = data.session?.access_token;
      if (!token) return;
      const response = await fetch("/api/checkout/verify", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ reference }), cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!active) return;
      setPurchaseMessage(response.ok ? "Payment verified. Your game is now in your library." : (payload.error || "Payment is not confirmed yet. Refresh your purchase history shortly."));
      setTab("purchases");
      window.history.replaceState({}, "", window.location.pathname);
      const ordersResponse = await fetch("/api/orders", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const ordersPayload = await ordersResponse.json().catch(() => ({}));
      if (ordersResponse.ok) setPurchases((ordersPayload.orders || []) as PurchaseOrder[]);
      const libraryResponse = await client.from("user_library").select("game_id").eq("user_id", user.id);
      if (!libraryResponse.error) setLibrary(libraryResponse.data.map((row) => String(row.game_id)));
    });
    return () => { active = false; };
  }, [user]);

  useEffect(() => { localStorage.setItem("gos-library", JSON.stringify(library)); }, [library]);
  useEffect(() => { localStorage.setItem("gos-wishlist", JSON.stringify(wishlist)); }, [wishlist]);

  const genres = useMemo(() => ["All games", ...Array.from(new Set(games.map((game) => game.genre)))], [games]);
  const filtered = useMemo(() => {
    const matches = games.filter((game) => {
      const searchText = `${game.title} ${game.genre} ${game.studio} ${game.description}`.toLowerCase();
      const isPaid = game.monetization.toLowerCase().startsWith("paid");
      const matchesGenre = genre === "All games" || game.genre === genre;
      const matchesSearch = searchText.includes(query.toLowerCase().trim());
      const matchesPlatform = platformFilter === "All platforms" || game.platforms.some((item) => {
        const value = item.toLowerCase();
        return platformFilter === "PC" ? value === "pc" || value.includes("windows") : value === platformFilter.toLowerCase();
      });
      const matchesPrice = priceFilter === "Any price" || (priceFilter === "Paid" ? isPaid : !isPaid);
      return matchesGenre && matchesSearch && matchesPlatform && matchesPrice && (!offlineOnly || game.offline);
    });

    if (sortMode === "title") {
      matches.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortMode === "free-first") {
      matches.sort((a, b) => Number(a.monetization.toLowerCase().startsWith("paid")) - Number(b.monetization.toLowerCase().startsWith("paid")) || a.title.localeCompare(b.title));
    } else if (sortMode === "price-low") {
      const price = (game: Game) => game.monetization.toLowerCase().startsWith("paid") ? (game.priceMinor ?? Number.MAX_SAFE_INTEGER) : 0;
      matches.sort((a, b) => price(a) - price(b) || a.title.localeCompare(b.title));
    }
    return matches;
  }, [games, genre, query, platformFilter, priceFilter, offlineOnly, sortMode]);
  const fitCurrencies = useMemo(() => { const intl = Intl as typeof Intl & { supportedValuesOf?: (key: "currency") => string[] }; const isoCurrencies = intl.supportedValuesOf?.("currency") || []; return Array.from(new Set([...isoCurrencies, ...games.map((game) => game.currency)])).sort(); }, [games]);
  const fitMatches = useMemo(() => games.filter((game) => {
    const matchesPlatform = fitPlatform === "Any device" || game.platforms.some((platform) => {
      const value = platform.toLowerCase();
      if (fitPlatform === "PC") return value === "pc" || value.includes("windows");
      return value === fitPlatform.toLowerCase();
    });
    const isPaid = game.monetization.toLowerCase().startsWith("paid");
    const budget = fitBudgetAmount.trim() === "" ? null : Number(fitBudgetAmount);
    const matchesBudget = budget === null || !isPaid || (Number.isFinite(budget) && budget >= 0 && game.currency === fitBudgetCurrency && game.priceMinor !== null && game.priceMinor <= Math.round(budget * 100));
    const matchesConnection = fitConnection !== "Offline required" || game.offline;
    const matchesGenre = fitGenre === "Any genre" || game.genre === fitGenre;
    return matchesPlatform && matchesBudget && matchesConnection && matchesGenre;
  }), [games, fitPlatform, fitBudgetAmount, fitBudgetCurrency, fitConnection, fitGenre]);
  const visible = tab === "library" ? games.filter((game) => library.includes(game.id)) : tab === "wishlist" ? games.filter((game) => wishlist.includes(game.id)) : filtered;

  function flash(message: string) { setNotice(message); window.setTimeout(() => setNotice(isSupabaseConfigured ? "Live Game ON catalogue" : "Demo catalogue · fictional sample games"), 3600); }
  async function toggleWishlist(game: Game) {
    const alreadySaved = wishlist.includes(game.id);
    if (supabase && user && !user.id.startsWith("demo-") && !game.id.startsWith("demo-")) {
      const result = alreadySaved
        ? await supabase.from("wishlists").delete().eq("user_id", user.id).eq("game_id", game.id)
        : await supabase.from("wishlists").upsert({ user_id: user.id, game_id: game.id }, { onConflict: "user_id,game_id", ignoreDuplicates: true });
      if (result.error) { flash(`Wishlist update failed: ${result.error.message}`); return; }
    }
    setWishlist((old) => alreadySaved ? old.filter((id) => id !== game.id) : [...old, game.id]);
    flash(alreadySaved ? "Removed from wishlist" : "Added to your wishlist");
  }
  async function startCheckout(game: Game) {
    setPurchaseMessage("");
    if (!supabase || !user || user.id.startsWith("demo-")) {
      setAuthMode("signin"); setAuthOpen(true); setDownloadMessage("Sign in with a real Game ON account before purchasing."); return;
    }
    if (game.id.startsWith("demo-")) { setDownloadMessage("Sample games cannot be purchased."); return; }
    setCheckoutBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");
      const response = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ gameId: game.id }), cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.authorizationUrl) throw new Error(payload.error || "Checkout could not be started.");
      window.location.assign(payload.authorizationUrl);
    } catch (error) {
      setDownloadMessage(error instanceof Error ? error.message : "Checkout failed. Please try again.");
    } finally { setCheckoutBusy(false); }
  }

  async function submitRefund(orderId: string) {
    if (!supabase || !user || user.id.startsWith("demo-")) { setPurchaseMessage("Sign in to request a refund."); return; }
    const reason = (refundReasons[orderId] || "").trim();
    if (reason.length < 10) { setPurchaseMessage("Please explain the refund reason in at least 10 characters."); return; }
    setRefundBusy(orderId); setPurchaseMessage("");
    try {
      const { data } = await supabase.auth.getSession(); const token = data.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");
      const response = await fetch("/api/refunds", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ orderId, reason }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Refund request could not be submitted.");
      setRefundReasons((old) => ({ ...old, [orderId]: "" }));
      setPurchaseMessage("Refund request submitted. Game ON support will review it.");
      const responseOrders = await fetch("/api/orders", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const orderPayload = await responseOrders.json().catch(() => ({}));
      if (responseOrders.ok) setPurchases((orderPayload.orders || []) as PurchaseOrder[]);
    } catch (error) { setPurchaseMessage(error instanceof Error ? error.message : "Refund request failed."); }
    finally { setRefundBusy(null); }
  }

  async function addToLibrary(game: Game) {
    if (supabase && !user && !game.id.startsWith("demo-")) {
      setAuthMode("signin"); setAuthOpen(true); flash("Sign in to save a live game to your library."); return;
    }
    if (game.monetization.startsWith("Paid")) { void startCheckout(game); return; }
    if (supabase && user && !game.id.startsWith("demo-")) {
      const { error } = await supabase.from("user_library").upsert({ user_id: user.id, game_id: game.id }, { onConflict: "user_id,game_id", ignoreDuplicates: true });
      if (error) { flash(error.message); return; }
    }
    setLibrary((old) => old.includes(game.id) ? old : [...old, game.id]);
    flash("Added to your library. Download release integration is the next step.");
  }
  async function downloadGame(game: Game) {
    setDownloadMessage("");
    if (!supabase || !user || user.id.startsWith("demo-")) {
      setDownloadMessage("Sign in with a real Game ON player account to download published games.");
      setAuthMode("signin"); setAuthOpen(true); return;
    }
    if (!library.includes(game.id)) {
      setDownloadMessage("Add this game to your library before downloading it."); return;
    }
    const platform = game.platforms.map((value) => value.toLowerCase()).map((value) => value.includes("android") ? "android" : value === "pc" || value.includes("windows") ? "windows" : value.includes("web") ? "web" : "").find(Boolean);
    if (!platform) { setDownloadMessage("No supported download platform is listed for this game."); return; }
    setDownloadBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your player session expired. Sign in again.");
      const response = await fetch(`/api/downloads/${encodeURIComponent(game.id)}`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ platform }), cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to prepare the download.");
      setDownloadMessage(`Preparing ${game.title} version ${payload.version}…`);
      window.location.assign(payload.url);
    } catch (error) {
      setDownloadMessage(error instanceof Error ? error.message : "Download could not be prepared. Please try again.");
    } finally { setDownloadBusy(false); }
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    if (!user || user.id.startsWith("demo-")) { setReviewMessage("Sign in with a real Game ON player account to submit a review."); setAuthMode("signin"); setAuthOpen(true); return; }
    if (!supabase || selected.id.startsWith("demo-")) { setReviewMessage("Reviews are available for approved live games only."); return; }
    if (!library.includes(selected.id)) { setReviewMessage("Add this game to your library before reviewing it."); return; }
    setReviewBusy(true); setReviewMessage("");
    const { error } = await supabase.from("reviews").insert({ user_id: user.id, game_id: selected.id, rating: reviewRating, review_text: reviewText.trim() || null });
    setReviewBusy(false);
    if (error) setReviewMessage(error.code === "23505" ? "You've already submitted a review for this game." : error.message);
    else { setReviewText(""); setReviewMessage("Thanks! Your review has been submitted for moderation and will appear after approval."); }
  }

  async function submitGameReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || selected.id.startsWith("demo-")) return;
    if (!user || user.id.startsWith("demo-")) {
      setReportMessage("Sign in with a real Game ON player account to report a listing.");
      setAuthMode("signin"); setAuthOpen(true); return;
    }
    if (!supabase) { setReportMessage("Reporting is available when the live Game ON service is connected."); return; }
    const details = reportDetails.trim();
    if (details.length < 10 || details.length > 2000) { setReportMessage("Please provide between 10 and 2,000 characters describing the issue."); return; }
    setReportBusy(true); setReportMessage("");
    const { error } = await supabase.from("game_reports").insert({ reporter_user_id: user.id, game_id: selected.id, category: reportCategory, details });
    setReportBusy(false);
    if (error) {
      setReportMessage(error.code === "23505" ? "You have already submitted this type of report for this game." : "Your report could not be submitted. Please try again later.");
    } else {
      setReportDetails(""); setReportMessage("Thank you. Your report has been sent privately to Game ON Trust & Safety.");
    }
  }

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setAuthMessage("");
    const form = new FormData(event.currentTarget); const email = String(form.get("email") || "").trim(); const password = String(form.get("password") || "");
    if (!supabase) { setUser({ id: `demo-${Date.now()}`, email }); setAuthOpen(false); setBusy(false); flash("Demo sign-in ready on this device. No password has been stored."); return; }
    try {
      const result = authMode === "signup" ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) setAuthMessage(result.error.message);
      else if (authMode === "signup" && !result.data.session) setAuthMessage("Check your email to confirm your account, then sign in.");
      else { setUser({ id: result.data.user?.id || "", email }); setAuthOpen(false); flash("Welcome to Game ON."); }
    } catch (caught) {
      setAuthMessage(caught instanceof Error ? caught.message : "Could not contact the account service. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  async function markNotificationRead(notificationId: string) {
    if (!supabase || !user || user.id.startsWith("demo-")) return;
    const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", notificationId).eq("user_id", user.id);
    if (error) { setNotificationMessage(error.message); return; }
    setNotifications((items) => items.map((item) => item.id === notificationId ? { ...item, read_at: new Date().toISOString() } : item));
  }
  async function markAllNotificationsRead() {
    if (!supabase || !user || user.id.startsWith("demo-")) return;
    const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
    if (error) { setNotificationMessage(error.message); return; }
    const now = new Date().toISOString();
    setNotifications((items) => items.map((item) => item.read_at ? item : { ...item, read_at: now }));
    setNotificationMessage("All notifications marked as read.");
  }
  async function savePlayerProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user || user.id.startsWith("demo-")) { setProfileMessage("Connect a real Game ON account to save profile changes."); return; }
    const cleanName = profileName.trim();
    const cleanUsername = profileUsername.trim().toLowerCase();
    if (cleanName.length < 2 || cleanUsername.length < 3 || !/^[a-z0-9_]+$/.test(cleanUsername)) { setProfileMessage("Use a display name of at least 2 characters and a username of 3–24 letters, numbers or underscores."); return; }
    setProfileBusy(true); setProfileMessage("");
    const { error } = await supabase.from("profiles").update({ display_name: cleanName, username: cleanUsername, updated_at: new Date().toISOString() }).eq("id", user.id);
    setProfileBusy(false);
    setProfileMessage(error ? error.message : "Profile saved successfully.");
  }
  async function signOut() { if (supabase && user && !user.id.startsWith("demo-")) await supabase.auth.signOut(); setUser(null); flash("Signed out"); }

  return <main className="store-shell">
    <header className="store-header">
      <a className="brand" href="#top" onClick={() => { setTab("discover"); setSelected(null); }}><img src="/game-on-logo.jpg" alt="Game ON logo"/><span><b>GAME ON</b><small>STORE</small></span></a>
      <nav className="top-nav" aria-label="Main navigation">
        <button className={tab === "discover" ? "active" : ""} onClick={() => { setTab("discover"); setSelected(null); }}>Discover</button>
        <button className={tab === "library" ? "active" : ""} onClick={() => { setTab("library"); setSelected(null); }}>My Library</button>
        <button className={tab === "wishlist" ? "active" : ""} onClick={() => { setTab("wishlist"); setSelected(null); }}>Wishlist</button>
        <button className={tab === "purchases" ? "active" : ""} onClick={() => { setTab("purchases"); setSelected(null); }}>Purchases</button>
        <button className={tab === "notifications" ? "active" : ""} onClick={() => { setTab("notifications"); setSelected(null); }}>Notifications{notifications.some((item) => !item.read_at) ? <i className="unread-dot"/> : null}</button>
        <button className={tab === "profile" ? "active" : ""} onClick={() => { setTab("profile"); setSelected(null); }}>Profile</button>
      </nav>
      <div className="header-actions"><span className="online-dot"/><span className="header-status">PLAYER STORE</span>{user ? <button className="profile-pill" onClick={() => { setTab("profile"); setSelected(null); }}>{user.email?.split("@")[0] || "Player"}</button> : <button className="outline-button" onClick={() => { setAuthOpen(true); setAuthMode("signin"); }}>Sign in</button>}</div>
    </header>

    <section className="store-content" id="top">
      <div className="welcome-row"><div><p className="eyebrow">{tab === "notifications" ? "STAY IN THE LOOP" : tab === "profile" ? "YOUR GAME ON IDENTITY" : tab === "purchases" ? "YOUR GAME ON ORDERS" : "YOUR NEXT ADVENTURE STARTS HERE"}</p><h1>{tab === "discover" ? <>Find your next<br/><em>favourite game.</em></> : tab === "library" ? <>Your games.<br/><em>Your world.</em></> : tab === "wishlist" ? <>Saved for<br/><em>later.</em></> : tab === "notifications" ? <>Your updates.<br/><em>All in one place.</em></> : tab === "purchases" ? <>Your purchases.<br/><em>All together.</em></> : <>Your player<br/><em>profile.</em></>}</h1><p className="intro-copy">{tab === "notifications" ? "Game updates and important messages from Game ON." : tab === "profile" ? "Manage your player identity and account preferences." : tab === "purchases" ? "View your orders, payment status and refund requests." : "A game marketplace built around discovery, clear information and a fair chance for creators."}</p></div><div className="player-badge"><span className="badge-icon">⌁</span><div><b>PLAYER FIRST</b><small>Know what you're downloading.</small></div></div></div>

      {tab === "discover" && <>
        <div className="feature-card"><div className="feature-copy"><span className="feature-tag">FEATURED DEMO · SAMPLE LISTING</span><h2>Play beyond<br/>the ordinary.</h2><p>Discover fresh worlds from emerging studios. See the facts before you play.</p><button className="primary-button" onClick={() => setSelected(games.find((g) => g.featured) || games[0] || null)}>Explore featured game <span>↗</span></button><button type="button" className="game-fit-launch" onClick={() => setFitOpen((open) => !open)}>{fitOpen ? "Close GAME FIT" : "Find games for me"} <span>✦</span></button></div><div className="feature-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="feature-planet">✦</div><span className="art-caption">NEW WORLDS<br/>WAITING</span></div></div>

        {fitOpen && <section className="game-fit-panel" aria-label="GAME FIT recommendations">
          <div className="game-fit-heading">
            <div><p className="eyebrow">YOUR PERSONAL GAME FINDER</p><h2>Let's find your fit.</h2><p>Tell us what works for you. GAME FIT will match your choices against published game details.</p></div>
            <span className="game-fit-mark">FIT<span>+</span></span>
          </div>
          <div className="game-fit-fields">
            <label><span>What do you play on?</span><select value={fitPlatform} onChange={(event) => setFitPlatform(event.target.value)}><option>Any device</option><option>Android</option><option>PC</option><option>Web</option></select></label>
            <label><span>Maximum budget</span><input type="number" min="0" step="0.01" value={fitBudgetAmount} onChange={(event) => setFitBudgetAmount(event.target.value)} placeholder="No limit"/></label>
            <label><span>Budget currency</span><select value={fitBudgetCurrency} onChange={(event) => setFitBudgetCurrency(event.target.value)}>{fitCurrencies.map((currency) => <option key={currency} value={currency}>{currency} — {new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 2 }).format(1)}</option>)}</select></label>
            <label><span>How's your internet?</span><select value={fitConnection} onChange={(event) => setFitConnection(event.target.value)}><option>Any connection</option><option>Offline required</option></select></label>
            <label><span>Which genre do you enjoy?</span><select value={fitGenre} onChange={(event) => setFitGenre(event.target.value)}><option>Any genre</option>{genres.filter((item) => item !== "All games").map((item) => <option key={item}>{item}</option>)}</select></label>
          </div>
          <div className="game-fit-results-heading"><div><p className="eyebrow">YOUR MATCHES</p><h3>{fitMatches.length} {fitMatches.length === 1 ? "game" : "games"} match your choices</h3></div><button type="button" className="game-fit-reset" onClick={() => { setFitPlatform("Any device"); setFitBudgetAmount(""); setFitBudgetCurrency(fitCurrencies.includes("NGN") ? "NGN" : fitCurrencies[0] || "USD"); setFitConnection("Any connection"); setFitGenre("Any genre"); }}>Reset choices</button></div>
          {fitMatches.length > 0 ? <div className="game-fit-results">{fitMatches.slice(0, 6).map((game) => <article className="game-fit-result" key={game.id}>
            <span className={`game-fit-result-icon cover-${game.accent}`}>{game.icon}</span>
            <div className="game-fit-result-copy"><b>{game.title}</b><span>{game.genre} · {game.studio}</span><small>{game.platforms.join(", ")} · {game.offline ? "Offline play" : "Internet required"} · {game.monetization}</small></div>
            <button type="button" className="game-fit-view" onClick={() => setSelected(game)}>View game</button>
          </article>)}</div> : <div className="game-fit-empty"><b>No exact matches yet.</b><p>Try choosing any device, a wider budget or any genre to see more games.</p></div>}
          <p className="game-fit-disclaimer">Budget limits compare prices in the currency shown on each listing. Choose the matching currency; automatic exchange-rate conversion is not enabled yet. Matches use publisher-supplied details and do not guarantee device performance.</p>
        </section>}
        <div className="filter-row"><label className="search-box"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search games, genres or studios…" aria-label="Search games"/><kbd>⌘ K</kbd></label><div className="genre-pills">{genres.map((item) => <button key={item} className={genre === item ? "chosen" : ""} onClick={() => setGenre(item)}>{item}</button>)}</div></div><div className="discovery-filter-row" aria-label="More game filters">
          <label className="discovery-filter-select"><span>Platform</span><select value={platformFilter} onChange={(event) => setPlatformFilter(event.target.value)} aria-label="Filter by platform"><option>All platforms</option><option>Android</option><option>PC</option><option>Web</option></select></label>
          <label className="discovery-filter-select"><span>Price</span><select value={priceFilter} onChange={(event) => setPriceFilter(event.target.value)} aria-label="Filter by price"><option>Any price</option><option>Free</option><option>Paid</option></select></label>
          <label className="discovery-filter-select"><span>Sort by</span><select value={sortMode} onChange={(event) => setSortMode(event.target.value as "newest" | "title" | "free-first" | "price-low")} aria-label="Sort games"><option value="newest">Newest first</option><option value="title">Name A–Z</option><option value="free-first">Free first</option><option value="price-low">Lowest price</option></select></label>
          <label className="discovery-offline"><input type="checkbox" checked={offlineOnly} onChange={(event) => setOfflineOnly(event.target.checked)}/><span>Offline play</span></label>
          <button type="button" className="discovery-clear" onClick={() => { setPlatformFilter("All platforms"); setPriceFilter("Any price"); setOfflineOnly(false); setSortMode("newest"); setGenre("All games"); setQuery(""); }}>Clear filters</button>
        </div>
      </>}

      {tab === "discover" && <div className="section-heading"><div><p className="eyebrow">THE COLLECTION</p><h2>Explore games</h2></div><span className="listing-count">{visible.length} {visible.length === 1 ? "GAME" : "GAMES"}</span></div>}
      {tab === "library" && <div className="section-heading"><div><p className="eyebrow">READY WHEN YOU ARE</p><h2>My library</h2></div><span className="listing-count">{visible.length} GAMES</span></div>}
      {tab === "wishlist" && <div className="section-heading"><div><p className="eyebrow">YOUR SHORTLIST</p><h2>My wishlist</h2></div><span className="listing-count">{visible.length} GAMES</span></div>}
      {tab === "purchases" && <div className="section-heading"><div><p className="eyebrow">ORDER HISTORY</p><h2>My purchases</h2></div><span className="listing-count">{purchases.length} ORDERS</span></div>}
      {notice && <div className="notice-line"><span className="notice-dot"/> {notice}</div>}
      {!["notifications", "profile", "purchases"].includes(tab) && <><div className="game-grid">{visible.map((game) => <article className="game-card" key={game.id}><button className={`game-cover cover-${game.accent}`} onClick={() => setSelected(game)} aria-label={`View ${game.title}`}><span className="cover-top"><span>{game.genre.toUpperCase()}</span><span>GAME ON</span></span><span className="cover-symbol">{game.icon}</span><span className="cover-title">{game.title}</span><span className="cover-glow"/></button><div className="game-card-info"><div className="game-title-row"><div><h3>{game.title}</h3><p>{game.studio}</p></div><button className={`heart-button ${wishlist.includes(game.id) ? "saved" : ""}`} onClick={() => toggleWishlist(game)} aria-label="Toggle wishlist">{wishlist.includes(game.id) ? "♥" : "♡"}</button></div><div className="game-meta"><span>{game.genre}</span><span>{game.offline ? "Offline" : "Online"}</span><span>{game.monetization.startsWith("Paid") && game.priceMinor ? formatMoney(game.priceMinor, game.currency) : game.monetization.replace("Free with ", "Free · ")}</span></div><button className="text-link" onClick={() => setSelected(game)}>View game details <span>→</span></button></div></article>)}</div>{visible.length === 0 && <div className="empty-state"><span>◌</span><h3>Nothing here yet</h3><p>{tab === "discover" ? "Try another search or explore the full collection." : "Games you save will appear here."}</p><button className="outline-button" onClick={() => { setTab("discover"); setQuery(""); setGenre("All games"); setPlatformFilter("All platforms"); setPriceFilter("Any price"); setOfflineOnly(false); setSortMode("newest"); }}>Back to discovery</button></div>}</>}
      {tab === "purchases" && <section className="account-panel"><div className="account-panel-heading"><div><p className="eyebrow">YOUR ORDERS</p><h2>Purchase history</h2><p>Only provider-verified payments are marked as paid.</p></div><button className="outline-button" onClick={async () => { if (!supabase) return; const { data } = await supabase.auth.getSession(); const token = data.session?.access_token; if (!token) return; setPurchasesLoading(true); const response = await fetch("/api/orders", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }); const payload = await response.json().catch(() => ({})); if (response.ok) setPurchases(payload.orders || []); else setPurchaseMessage(payload.error || "Unable to refresh orders."); setPurchasesLoading(false); }}>Refresh orders</button></div>{purchaseMessage && <p className="account-message" role="status">{purchaseMessage}</p>}{!user && <div className="account-empty"><h3>Sign in to view purchases</h3><p>Your orders and refunds are connected to your player account.</p><button className="primary-button" onClick={() => { setAuthMode("signin"); setAuthOpen(true); }}>Sign in</button></div>}{user && purchasesLoading && <p className="build-muted">Loading your purchases…</p>}{user && !purchasesLoading && purchases.length === 0 && <div className="account-empty"><h3>No purchases yet</h3><p>Paid games you buy through Game ON will appear here.</p></div>}{purchases.map((order) => { const refund = Array.isArray(order.refund_requests) ? order.refund_requests[0] : order.refund_requests; return <article className="purchase-row" key={order.id}><div className="purchase-row-head"><div><b>{order.game_title_snapshot}</b><small>{new Date(order.created_at).toLocaleString()} · Ref {order.reference}</small></div><strong>{formatMoney(order.amount_minor, order.currency)}</strong></div><div className="purchase-row-status"><span className={`purchase-status ${order.status}`}>{order.status.replace("_", " ")}</span>{refund && <span className="purchase-status refund">Refund: {refund.status.replace("_", " ")}</span>}</div>{order.status === "paid" && !refund && <div className="refund-request-form"><label htmlFor={`refund-${order.id}`}>Request a refund review</label><textarea id={`refund-${order.id}`} rows={2} maxLength={2000} value={refundReasons[order.id] || ""} onChange={(event) => setRefundReasons((old) => ({ ...old, [order.id]: event.target.value }))} placeholder="Explain why you are requesting a refund (at least 10 characters)."/><button className="outline-button" disabled={refundBusy === order.id} onClick={() => void submitRefund(order.id)}>{refundBusy === order.id ? "Submitting…" : "Submit refund request"}</button></div>}</article>; })}</section>}
      {tab === "notifications" && <section className="account-panel"><div className="account-panel-heading"><div><p className="eyebrow">YOUR INBOX</p><h2>Notifications</h2><p>Updates for games in your library and your Game ON account.</p></div><button className="outline-button" onClick={markAllNotificationsRead} disabled={!notifications.some((item) => !item.read_at)}>Mark all as read</button></div>{notificationMessage && <p className="account-message" role="status">{notificationMessage}</p>}{!user && <div className="account-empty"><h3>Sign in to see your updates</h3><p>Your notifications are connected to your Game ON player account.</p><button className="primary-button" onClick={() => { setAuthMode("signin"); setAuthOpen(true); }}>Sign in</button></div>}{user && notifications.length === 0 && <div className="account-empty"><h3>You're all caught up.</h3><p>New game releases and important account updates will appear here.</p></div>}{notifications.map((item) => <article className={`notification-card ${item.read_at ? "read" : "unread"}`} key={item.id}><span className="notification-mark">{item.notification_type === "build_update" ? "↻" : item.notification_type === "game_published" ? "✓" : "✦"}</span><div><b>{item.title}</b><p>{item.message}</p><small>{new Date(item.created_at).toLocaleString()}</small></div>{!item.read_at && <button className="notification-read" onClick={() => markNotificationRead(item.id)}>Mark read</button>}</article>)}</section>}
      {tab === "profile" && <section className="account-panel"><div className="account-panel-heading"><div><p className="eyebrow">PLAYER SETTINGS</p><h2>Your profile</h2><p>Your display name and public player handle.</p></div><span className="profile-avatar-large">{(profileName || user?.email || "P").slice(0, 1).toUpperCase()}</span></div>{!user && <div className="account-empty"><h3>Sign in to manage your profile</h3><p>Create your player account to save your games across devices.</p><button className="primary-button" onClick={() => { setAuthMode("signin"); setAuthOpen(true); }}>Sign in</button></div>}{user && <form className="profile-form" onSubmit={savePlayerProfile}><label>Display name<input value={profileName} onChange={(event) => setProfileName(event.target.value)} minLength={2} maxLength={60} required/></label><label>Username<input value={profileUsername} onChange={(event) => setProfileUsername(event.target.value)} minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]+" required/><small>3–24 letters, numbers or underscores.</small></label><label>Email<input value={user.email || ""} readOnly/></label><button className="primary-button" disabled={profileBusy}>{profileBusy ? "Saving…" : "Save profile"}</button>{profileMessage && <p className="account-message" role="status">{profileMessage}</p>}<button type="button" className="outline-button" onClick={signOut}>Sign out</button></form>}</section>}
      <footer className="store-footer"><div className="footer-brand">GAME ON <span>STORE</span></div><p>Every game deserves a chance. Every player deserves a fair deal.</p><small>Game ON Store · Early development build · Sample games are fictional.</small></footer>
    </section>

    {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><section className="game-modal" onClick={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setSelected(null)} aria-label="Close">×</button><div className={`modal-art cover-${selected.accent}`}><span>{selected.icon}</span><b>{selected.title}</b></div><div className="modal-body"><p className="eyebrow">{selected.genre.toUpperCase()} · {selected.studio.toUpperCase()}</p><h2>{selected.title}</h2><p className="modal-description">{selected.description}</p><div className="truth-grid"><div><small>MONETIZATION</small><b>{selected.monetization}</b></div><div><small>OFFLINE PLAY</small><b>{selected.offline ? "Supported" : "Internet required"}</b></div><div><small>ADVERTISING</small><b>{selected.ads ? "Contains ads" : "No ads declared"}</b></div><div><small>IN-APP PURCHASES</small><b>{selected.iap ? "Available" : "None declared"}</b></div><div><small>PLATFORMS</small><b>{selected.platforms.join(", ")}</b></div><div><small>LISTING STATUS</small><b>{selected.id.startsWith("demo-") ? "Sample listing" : "Published"}</b></div></div><ReleaseHistory gameId={selected.id}/><div className="modal-actions">{!library.includes(selected.id) && selected.monetization.startsWith("Paid") && <button className="primary-button" onClick={() => void startCheckout(selected)} disabled={checkoutBusy}>{checkoutBusy ? "Starting secure checkout…" : `Buy now · ${selected.priceMinor ? formatMoney(selected.priceMinor, selected.currency) : "Price unavailable"} →`}</button>}{!library.includes(selected.id) && !selected.monetization.startsWith("Paid") && <button className="primary-button" onClick={() => addToLibrary(selected)}>Add to my library <span>→</span></button>}{library.includes(selected.id) && !selected.id.startsWith("demo-") && <button className="primary-button" onClick={() => void downloadGame(selected)} disabled={downloadBusy}>{downloadBusy ? "Preparing download…" : "Download latest build →"}</button>}<button className="outline-button" onClick={() => toggleWishlist(selected)}>{wishlist.includes(selected.id) ? "♥ Saved" : "♡ Wishlist"}</button>{!selected.id.startsWith("demo-") && <button className="report-trigger" onClick={() => { setReportOpen((open) => !open); setReportMessage(""); }}>Report this listing</button>}</div>{downloadMessage && <p className="download-message" role="status">{downloadMessage}</p>}{reportOpen && !selected.id.startsWith("demo-") && <form className="report-form" onSubmit={submitGameReport}><b>Report a game listing</b><label>What is the problem?<select value={reportCategory} onChange={(event) => setReportCategory(event.target.value)}><option value="misleading_listing">Misleading or inaccurate information</option><option value="suspicious_or_unsafe">Suspicious or potentially unsafe</option><option value="inappropriate_content">Inappropriate content</option><option value="copyright_or_ip">Copyright or intellectual-property concern</option><option value="harassment_or_abuse">Harassment or abuse</option><option value="other">Other concern</option></select></label><label>Tell us what happened<textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} rows={3} minLength={10} maxLength={2000} placeholder="Please describe the issue clearly (10–2,000 characters)." required/></label><button className="outline-button" disabled={reportBusy}>{reportBusy ? "Sending report…" : user ? "Submit private report" : "Sign in to report"}</button>{!user && <small>Sign in is required to send a report.</small>}{reportMessage && <p className="report-message" role="status">{reportMessage}</p>}</form>}<section className="player-reviews"><div className="reviews-heading"><div><p className="eyebrow">PLAYER FEEDBACK</p><h3>Reviews</h3></div><span>{reviews.length} approved</span></div>{reviews.length ? <div className="review-list">{reviews.map((review) => <article className="review-item" key={review.id}><div className="review-stars">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</div><p>{review.review_text || "Player left a rating without a written comment."}</p><small>{new Date(review.created_at).toLocaleDateString()}</small></article>)}</div> : <p className="review-empty">No approved player reviews yet. Be among the first to share useful feedback.</p>}{!selected.id.startsWith("demo-") && <form className="review-form" onSubmit={submitReview}><label>Your rating<select value={reviewRating} onChange={(event) => setReviewRating(Number(event.target.value))}><option value={5}>5 — Loved it</option><option value={4}>4 — Really good</option><option value={3}>3 — It's okay</option><option value={2}>2 — Disappointing</option><option value={1}>1 — Poor</option></select></label><label>Your review<textarea value={reviewText} onChange={(event) => setReviewText(event.target.value)} rows={3} maxLength={3000} placeholder="Share helpful, respectful feedback…"/></label><button className="outline-button" disabled={reviewBusy || !user || !library.includes(selected.id)}>{reviewBusy ? "Submitting…" : "Submit review"}</button>{!user && <small>Sign in and add the game to your library to write a review.</small>}{user && !library.includes(selected.id) && <small>Add the game to your library first.</small>}{reviewMessage && <p className="review-message" role="status">{reviewMessage}</p>}</form>}</section><p className="fine-print">Downloads are provided through short-lived private links only for games in your library with clean, Game ON-approved builds. Paid checkout requires a configured Paystack test or live integration.</p></div></section></div>}

    {authOpen && <div className="modal-backdrop" onClick={() => setAuthOpen(false)}><section className="auth-modal" onClick={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setAuthOpen(false)}>×</button><div className="auth-logo"><img src="/game-on-logo.jpg" alt="Game ON"/></div><p className="eyebrow">PLAYER ACCOUNT</p><h2>{authMode === "signup" ? "Join the game." : "Welcome back."}</h2><form onSubmit={handleAuth}><label>Email address<input type="email" name="email" required autoComplete="email" placeholder="you@example.com"/></label><label>Password<input type="password" name="password" minLength={8} required autoComplete={authMode === "signup" ? "new-password" : "current-password"} placeholder="At least 8 characters"/></label>{authMessage && <p className="form-message">{authMessage}</p>}<button className="primary-button full-button" disabled={busy}>{busy ? "Please wait…" : authMode === "signup" ? "Create account" : "Sign in"}</button></form><a className="forgot-password-link" href="/forgot-password">Forgot your password?</a><p className="switch-auth">{authMode === "signup" ? "Already have an account?" : "New to Game ON?"} <button onClick={() => { setAuthMode(authMode === "signup" ? "signin" : "signup"); setAuthMessage(""); }}>{authMode === "signup" ? "Sign in" : "Create an account"}</button></p>{!supabase && <small className="demo-note">Demo mode is active. Connect Supabase to enable real accounts.</small>}</section></div>}
  </main>;
}


function ReleaseHistory({ gameId }: { gameId: string }) {
  const [rows, setRows] = useState<Array<{ version_label: string; platform: string; file_size_bytes: number; sha256_hex: string; released_at: string }>>([]);
  const [message, setMessage] = useState("Loading approved releases…");
  useEffect(() => {
    if (!supabase || gameId.startsWith("demo-")) { setRows([]); setMessage("Release history will appear when this sample listing has approved builds."); return; }
    let active = true;
    supabase.rpc("get_game_release_history", { p_game_id: gameId }).then(({ data, error }) => {
      if (!active) return;
      if (error) setMessage("Release history is temporarily unavailable.");
      else { const result = (data || []) as Array<{ version_label: string; platform: string; file_size_bytes: number; sha256_hex: string; released_at: string }>; setRows(result); setMessage(result.length ? "" : "No approved releases yet."); }
    });
    return () => { active = false; };
  }, [gameId]);
  return <section className="release-history"><div className="reviews-heading"><div><p className="eyebrow">GAME ON VERIFIED BUILDS</p><h3>Release history</h3></div><span>{rows.length} releases</span></div>{message && <p className="review-empty">{message}</p>}{rows.map((row) => <article className="release-row" key={`${row.version_label}-${row.platform}-${row.released_at}`}><div><b>Version {row.version_label}</b><small>{row.platform.toUpperCase()} · {(row.file_size_bytes / (1024 * 1024)).toFixed(1)} MB · {new Date(row.released_at).toLocaleDateString()}</small><small className="release-hash">SHA-256: {row.sha256_hex}</small></div><span className="release-approved">APPROVED</span></article>)}</section>;
}
