"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import BuildManager from "@/components/build-manager";
import { CreatorAnalytics, CreatorInbox } from "@/components/creator-insights";
import CreatorSales from "@/components/creator-sales";

type Section = "overview" | "games" | "submit" | "edit" | "builds" | "analytics" | "sales" | "notifications" | "settings";
type GameRow = { id: string; title: string; slug: string; genre: string; status: string; created_at?: string; short_description?: string; monetization_type?: string; supported_platforms?: string[]; offline_support?: boolean; contains_ads?: boolean; has_in_app_purchases?: boolean; price_minor?: number | null; currency?: string | null };
type Studio = { id: string; studio_name: string; slug: string; description?: string; verification_status?: string; demo?: boolean };
type CreatorUser = { id: string; email?: string; demo?: boolean };

const demoRows: GameRow[] = [
  { id: "demo-001", title: "Neon Drift", slug: "neon-drift", genre: "Racing", status: "published", short_description: "High-speed racing through a neon city.", monetization_type: "free" },
  { id: "demo-002", title: "Emberfall", slug: "emberfall", genre: "Adventure", status: "in_review", short_description: "Explore ancient ruins in a story-rich world.", monetization_type: "demo" },
  { id: "demo-003", title: "Orbit Keepers", slug: "orbit-keepers", genre: "Strategy", status: "draft", short_description: "Build and defend a frontier space outpost.", monetization_type: "free" },
];

function makeSlug(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

export default function CreatorApp() {
  const [section, setSection] = useState<Section>("overview");
  const [user, setUser] = useState<CreatorUser | null>(null);
  const [studio, setStudio] = useState<Studio | null>(null);
  const [games, setGames] = useState<GameRow[]>([]);
  const [editingGame, setEditingGame] = useState<GameRow | null>(null);
  const [authMode, setAuthMode] = useState<"signup" | "signin">("signup");
  const [authMessage, setAuthMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [studioLoading, setStudioLoading] = useState(false);

  useEffect(() => {
    if (!supabase) {
      try {
        const savedUser = localStorage.getItem("goc-demo-user");
        const savedStudio = localStorage.getItem("goc-demo-studio");
        const savedGames = localStorage.getItem("goc-demo-games");
        if (savedUser) setUser(JSON.parse(savedUser));
        if (savedStudio) setStudio(JSON.parse(savedStudio));
        if (savedGames) setGames(JSON.parse(savedGames)); else setGames(demoRows);
      } catch { setGames(demoRows); }
      return;
    }
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ? { id: data.session.user.id, email: data.session.user.email } : null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ? { id: session.user.id, email: session.user.email } : null));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) { setStudio(null); return; }
    if (user.demo || !supabase) return;
    let active = true; setStudioLoading(true);
    supabase.from("developer_studios").select("id,studio_name,slug,description,verification_status").eq("owner_user_id", user.id).maybeSingle().then(({ data, error }) => {
      if (!active) return;
      if (error) setNotice(error.message);
      setStudio(data as Studio | null); setStudioLoading(false);
    });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!studio) return;
    if (studio.demo || !supabase) { if (!games.length) setGames(demoRows); return; }
    let active = true;
    supabase.from("games").select("id,title,slug,genre,status,created_at,short_description,monetization_type,price_minor,currency,supported_platforms,offline_support,contains_ads,has_in_app_purchases").eq("studio_id", studio.id).order("created_at", { ascending: false }).then(({ data, error }) => {
      if (!active) return;
      if (error) setNotice(error.message); else setGames((data || []) as GameRow[]);
    });
    return () => { active = false; };
  }, [studio]);

  useEffect(() => { if (!supabase && games.length) localStorage.setItem("goc-demo-games", JSON.stringify(games)); }, [games]);

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setAuthMessage("");
    const form = new FormData(event.currentTarget); const email = String(form.get("email") || "").trim(); const password = String(form.get("password") || "");
    if (!supabase) {
      const demoUser = { id: `demo-user-${Date.now()}`, email, demo: true };
      setUser(demoUser); localStorage.setItem("goc-demo-user", JSON.stringify(demoUser)); setBusy(false); return;
    }
    const result = authMode === "signup" ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (result.error) setAuthMessage(result.error.message);
    else if (authMode === "signup" && !result.data.session) setAuthMessage("Check your email to confirm your account, then sign in.");
    else setUser(result.data.user ? { id: result.data.user.id, email: result.data.user.email } : null);
  }

  async function createStudio(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!user) return; setBusy(true); setNotice("");
    const form = new FormData(event.currentTarget); const name = String(form.get("studioName") || "").trim(); const description = String(form.get("description") || "").trim(); const website = String(form.get("website") || "").trim();
    const slug = makeSlug(name);
    if (user.demo || !supabase) {
      const next: Studio = { id: `demo-studio-${Date.now()}`, studio_name: name, slug, description, verification_status: "pending", demo: true };
      setStudio(next); localStorage.setItem("goc-demo-studio", JSON.stringify(next)); setBusy(false); setNotice("Demo studio created on this device."); return;
    }
    const { data, error } = await supabase.from("developer_studios").insert({ owner_user_id: user.id, studio_name: name, slug, description, website_url: website || null }).select("id,studio_name,slug,description,verification_status").single();
    setBusy(false); if (error) setNotice(error.message); else { setStudio(data as Studio); setNotice("Studio created. Verification status: pending."); }
  }

  async function submitGame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!studio) return; setBusy(true); setNotice("");
    const form = new FormData(event.currentTarget); const title = String(form.get("title") || "").trim(); const genre = String(form.get("genre") || ""); const description = String(form.get("description") || "").trim(); const monetization = String(form.get("monetization") || "free"); const platform = String(form.get("platform") || "android"); const offline = form.get("offline") === "on"; const ads = form.get("ads") === "on"; const iap = form.get("iap") === "on";
    const priceInput = String(form.get("priceNaira") || "").trim();
    const priceNaira = priceInput ? Number(priceInput) : 0;
    if (monetization === "paid" && (!Number.isFinite(priceNaira) || priceNaira <= 0 || !Number.isSafeInteger(Math.round(priceNaira * 100)))) { setBusy(false); setNotice("Enter a valid NGN price greater than zero for a paid game."); return; }
    const priceMinor = monetization === "paid" ? Math.round(priceNaira * 100) : null;
    const slug = `${makeSlug(title)}-${Math.random().toString(36).slice(2, 6)}`;
    if (studio.demo || !supabase) {
      const row: GameRow = { id: `demo-${Date.now()}`, title, slug, genre, status: "submitted", short_description: description, monetization_type: monetization };
      setGames((old) => [row, ...old]); setNotice("Demo submission saved locally. Connect the shared backend for real review and publishing."); setSection("games"); setBusy(false); return;
    }
    const { data, error } = await supabase.from("games").insert({ studio_id: studio.id, title, slug, short_description: description, description, genre, supported_platforms: [platform], monetization_type: monetization, price_minor: priceMinor, currency: monetization === "paid" ? "NGN" : null, offline_support: offline, contains_ads: ads, has_in_app_purchases: iap, status: "submitted" }).select("id,title,slug,genre,status,short_description,monetization_type,price_minor,currency,created_at,supported_platforms,offline_support,contains_ads,has_in_app_purchases").single();
    setBusy(false); if (error) setNotice(error.message); else { setGames((old) => [data as GameRow, ...old]); setSection("games"); setNotice("Your game listing was submitted for review."); }
  }

  async function saveGameEdits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!studio || !editingGame) return;
    setBusy(true); setNotice("");
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    const genre = String(form.get("genre") || "");
    const description = String(form.get("description") || "").trim();
    const platform = String(form.get("platform") || "android");
    const monetization = String(form.get("monetization") || "free");
    const offline = form.get("offline") === "on";
    const ads = form.get("ads") === "on";
    const iap = form.get("iap") === "on";
    const priceInput = String(form.get("priceNaira") || "").trim();
    const priceNaira = priceInput ? Number(priceInput) : 0;
    if (monetization === "paid" && (!Number.isFinite(priceNaira) || priceNaira <= 0 || !Number.isSafeInteger(Math.round(priceNaira * 100)))) { setBusy(false); setNotice("Enter a valid NGN price greater than zero for a paid game."); return; }
    const priceMinor = monetization === "paid" ? Math.round(priceNaira * 100) : null;
    if (studio.demo || !supabase) {
      setGames((old) => old.map((game) => game.id === editingGame.id ? { ...game, title, slug: makeSlug(title), genre, short_description: description } : game));
      setNotice("Demo listing updated on this device."); setEditingGame(null); setSection("games"); setBusy(false); return;
    }
    const { error } = await supabase.from("games").update({ title, genre, short_description: description, description, supported_platforms: [platform], monetization_type: monetization, price_minor: priceMinor, currency: monetization === "paid" ? "NGN" : null, offline_support: offline, contains_ads: ads, has_in_app_purchases: iap, updated_at: new Date().toISOString() }).eq("id", editingGame.id).eq("studio_id", studio.id);
    if (error) { setBusy(false); setNotice(error.message); return; }
    if (editingGame.status === "rejected") {
      const resubmit = await supabase.rpc("resubmit_game", { p_game_id: editingGame.id });
      if (resubmit.error) { setBusy(false); setNotice(`Changes saved, but resubmission failed: ${resubmit.error.message}`); return; }
    }
    const { data, error: refreshError } = await supabase.from("games").select("id,title,slug,genre,status,created_at,short_description,monetization_type,price_minor,currency,supported_platforms,offline_support,contains_ads,has_in_app_purchases").eq("studio_id", studio.id).order("created_at", { ascending: false });
    if (!refreshError && data) setGames(data as GameRow[]);
    setBusy(false); setEditingGame(null); setSection("games"); setNotice(editingGame.status === "rejected" ? "Changes saved and listing resubmitted for review." : "Game listing updated.");
  }

  function beginEdit(game: GameRow) {
    if (game.status === "published") { setNotice("Published listings are locked for editing in this early release. Contact Game ON support for a listing change."); return; }
    setEditingGame(game); setSection("edit"); setNotice("");
  }

  async function signOut() {
    if (supabase && user && !user.demo) await supabase.auth.signOut();
    if (!supabase) { localStorage.removeItem("goc-demo-user"); localStorage.removeItem("goc-demo-studio"); }
    setUser(null); setStudio(null); setNotice("Signed out.");
  }

  const published = games.filter((g) => g.status === "published").length;
  const inReview = games.filter((g) => g.status === "submitted" || g.status === "in_review").length;
  const draft = games.filter((g) => g.status === "draft").length;
  const nav: { id: Section; label: string; icon: string }[] = [{ id: "overview", label: "Overview", icon: "▦" }, { id: "games", label: "My games", icon: "▣" }, { id: "submit", label: "Submit a game", icon: "+" }, { id: "builds", label: "Game builds", icon: "⇧" }, { id: "analytics", label: "Analytics", icon: "⌁" }, { id: "sales", label: "Sales & earnings", icon: "₦" }, { id: "notifications", label: "Notifications", icon: "♢" }, { id: "settings", label: "Studio settings", icon: "⚙" }];

  if (!user) return <main className="creator-auth-screen"><div className="auth-visual"><div className="visual-glow"/><img src="/game-on-logo.jpg" alt="Game ON company logo"/><p className="eyebrow">BUILT FOR THE PEOPLE WHO BUILD GAMES</p><h1>Your game.<br/><em>Your audience.</em></h1><p className="auth-tagline">Publish with clarity. Understand your players. Grow on Game ON.</p><div className="auth-footnote">GAME ON CREATOR · DEVELOPER PORTAL</div></div><section className="auth-panel"><div className="auth-form-wrap"><div className="small-brand"><span className="brand-square">G</span><span>GAME ON <b>CREATOR</b></span></div><p className="eyebrow">DEVELOPER ACCESS</p><h2>{authMode === "signup" ? "Create your account" : "Welcome back"}</h2><p className="auth-help">Access your publishing workspace and manage your game listings.</p><form onSubmit={handleAuth}><label>Email address<input name="email" type="email" placeholder="you@studio.com" required autoComplete="email"/></label><label>Password<input name="password" type="password" placeholder="At least 8 characters" required minLength={8} autoComplete={authMode === "signup" ? "new-password" : "current-password"}/></label>{authMessage && <p className="error-message">{authMessage}</p>}<button className="creator-primary" disabled={busy}>{busy ? "Please wait…" : authMode === "signup" ? "Create developer account" : "Sign in to Creator"}</button></form>{authMode === "signin" && <a className="forgot-password-link" href="/forgot-password">Forgot your password?</a>}<p className="auth-switch">{authMode === "signup" ? "Already registered?" : "New to Game ON Creator?"} <button onClick={() => { setAuthMode(authMode === "signup" ? "signin" : "signup"); setAuthMessage(""); }}>{authMode === "signup" ? "Sign in" : "Create account"}</button></p>{!isSupabaseConfigured && <p className="demo-banner">DEMO MODE · No password is saved. Connect Supabase to create real developer accounts.</p>}<a className="back-store" href={process.env.NEXT_PUBLIC_STORE_URL || "http://localhost:3000"}>← Back to Game ON Store</a></div></section></main>;

  if (!studio && !studioLoading) return <main className="studio-onboarding"><header className="onboarding-top"><div className="small-brand"><span className="brand-square">G</span><span>GAME ON <b>CREATOR</b></span></div><button className="quiet-button" onClick={signOut}>Sign out</button></header><section className="onboarding-card"><div className="onboarding-symbol">✦</div><p className="eyebrow">ONE QUICK STEP</p><h1>Set up your studio.</h1><p className="auth-help">Your studio is the home for the games you publish on Game ON. You can update these details later.</p><form onSubmit={createStudio}><label>Studio name<input name="studioName" placeholder="e.g. Blue Lantern Games" required maxLength={80}/></label><label>Short description<textarea name="description" placeholder="Tell players and the Game ON team about your studio." rows={3}/></label><label>Website (optional)<input name="website" type="url" placeholder="https://yourstudio.com"/></label><button className="creator-primary" disabled={busy}>{busy ? "Creating studio…" : "Create my studio"}</button></form>{notice && <p className="notice-message">{notice}</p>}<small>New studios begin with pending verification. Publishing access may be limited until verification is complete.</small></section></main>;

  return <main className="creator-app"><aside className="creator-sidebar"><div className="sidebar-brand"><img src="/game-on-logo.jpg" alt="Game ON"/><div><b>GAME ON</b><span>CREATOR</span></div></div><div className="studio-switch"><span className="studio-avatar">{studio.studio_name.slice(0, 1).toUpperCase()}</span><div><b>{studio.studio_name}</b><small>{studio.verification_status === "verified" ? "Verified studio" : "Verification pending"}</small></div><span className="switch-chevron">⌄</span></div><p className="side-label">WORKSPACE</p><nav className="side-nav">{nav.map((item) => <button key={item.id} className={section === item.id ? "selected" : ""} onClick={() => setSection(item.id)}><span className="nav-icon">{item.icon}</span>{item.label}{item.id === "submit" && <span className="nav-new">NEW</span>}</button>)}</nav><div className="sidebar-bottom"><div className="help-card"><b>Need a hand?</b><p>Get help with your game submission or studio account.</p><button onClick={() => setNotice("Support centre will be available in a future release.")}>Visit support ↗</button></div><div className="sidebar-user"><span className="user-avatar">{(user.email || "D").slice(0, 1).toUpperCase()}</span><div><b>{user.email?.split("@")[0] || "Developer"}</b><small>{user.email || "Demo account"}</small></div><button onClick={signOut} aria-label="Sign out">↗</button></div></div></aside>
    <section className="creator-main"><header className="creator-topbar"><div><span className="breadcrumb">CREATOR PORTAL</span><span className="crumb-divider">/</span><b>{nav.find((n) => n.id === section)?.label.toUpperCase()}</b></div><div className="topbar-right"><span className="secure-label"><i/> {isSupabaseConfigured ? "CONNECTED ENVIRONMENT" : "DEMO ENVIRONMENT"}</span><a className="admin-shortcut" href="/admin">Admin review ↗</a><button className="top-avatar" onClick={signOut}>{(user.email || "D").slice(0, 1).toUpperCase()}</button></div></header>
      <div className="creator-page">
        {notice && <button className="notice-banner" onClick={() => setNotice("")}>{notice}<span>×</span></button>}
        {section === "overview" && <><div className="page-intro"><div><p className="eyebrow">YOUR STUDIO AT A GLANCE</p><h1>Good to see you.</h1><p>Here is what's happening with {studio.studio_name}.</p></div><button className="creator-primary compact" onClick={() => setSection("submit")}>＋ Submit a game</button></div><div className="stat-grid"><div className="stat-card"><span className="stat-icon cyan">▣</span><small>TOTAL LISTINGS</small><b>{games.length}</b><em>Across your studio</em></div><div className="stat-card"><span className="stat-icon green">↗</span><small>PUBLISHED GAMES</small><b>{published}</b><em>Visible in the store</em></div><div className="stat-card"><span className="stat-icon amber">◷</span><small>IN REVIEW</small><b>{inReview}</b><em>Waiting for review</em></div><div className="stat-card"><span className="stat-icon violet">✎</span><small>DRAFTS</small><b>{draft}</b><em>Not yet submitted</em></div></div><div className="dashboard-grid"><section className="surface-card recent-card"><div className="surface-heading"><div><h2>Recent games</h2><p>Your latest listings and their status.</p></div><button className="plain-link" onClick={() => setSection("games")}>View all →</button></div><GameTable games={games.slice(0, 4)} onEdit={beginEdit}/></section><section className="surface-card getting-started"><p className="eyebrow">CREATOR CHECKLIST</p><h2>Build your presence.</h2><p>Complete these steps to prepare your studio for publishing.</p><div className="check-step done"><span>✓</span><div><b>Create your studio</b><small>Studio workspace created</small></div></div><div className="check-step"><span>2</span><div><b>Submit your first game</b><small>Add your store listing details</small></div></div><div className="check-step"><span>3</span><div><b>Complete studio verification</b><small>Confirm your studio identity</small></div></div><div className="check-step"><span>4</span><div><b>Prepare a secure game build</b><small>Upload through the private quarantine workflow</small></div></div><button className="creator-outline" onClick={() => setSection("builds")}>Manage game builds →</button></section></div></>}
        {section === "games" && <><div className="page-intro"><div><p className="eyebrow">YOUR CATALOGUE</p><h1>My games</h1><p>Manage your studio's game listings and review status.</p></div><button className="creator-primary compact" onClick={() => setSection("submit")}>＋ Submit a game</button></div><section className="surface-card full-card"><div className="surface-heading"><div><h2>All listings</h2><p>{games.length} game listings in your studio</p></div></div><GameTable games={games} onEdit={beginEdit}/></section></>}
        {section === "submit" && <><div className="page-intro"><div><p className="eyebrow">PUBLISH ON GAME ON</p><h1>Submit a game.</h1><p>Create the store listing. Game builds and downloads are handled separately after security review is ready.</p></div></div><form className="surface-card submit-form" onSubmit={submitGame}><div className="form-section-heading"><b>GAME INFORMATION</b><span>STEP 1 OF 2</span></div><div className="form-two"><label>Game title<input name="title" placeholder="Enter your game title" required maxLength={80}/></label><label>Genre<select name="genre" required defaultValue=""><option value="" disabled>Select a genre</option>{["Action","Adventure","Arcade","Casual","Educational","Puzzle","Racing","Role-playing","Simulation","Sports","Strategy"].map((g) => <option key={g}>{g}</option>)}</select></label></div><label>Short description<textarea name="description" rows={4} maxLength={180} required placeholder="Describe your game in 180 characters or fewer."/></label><div className="form-section-heading separated"><b>PLATFORM & MONETIZATION</b><span>STORE DISCLOSURES</span></div><div className="form-two"><label>First supported platform<select name="platform" defaultValue="android"><option value="android">Android</option><option value="windows">Windows PC</option><option value="web">Web</option></select></label><label>Monetization<select name="monetization" defaultValue="free"><option value="free">Free</option><option value="paid">Paid</option><option value="free_with_ads">Free with ads</option><option value="free_with_iap">Free with in-app purchases</option><option value="demo">Free demo</option></select></label><label>Price in NGN<input name="priceNaira" type="number" min="0.01" max="1000000" step="0.01" placeholder="e.g. 2500.00"/><small>Required only when monetization is set to Paid. Enter the full NGN amount, not kobo.</small></label></div><div className="checkbox-grid"><label><input type="checkbox" name="offline"/> Supports offline play</label><label><input type="checkbox" name="ads"/> Contains advertising</label><label><input type="checkbox" name="iap"/> Contains in-app purchases</label></div><div className="submission-note"><b>Before you submit</b><p>This creates a listing record for review; it does not upload an APK, EXE or other game build. File upload will only be enabled with private quarantine storage, file inspection and approval controls.</p></div><div className="form-actions"><button type="button" className="creator-outline" onClick={() => setSection("games")}>Cancel</button><button className="creator-primary" disabled={busy}>{busy ? "Submitting…" : "Submit listing for review →"}</button></div></form></>}
        {section === "edit" && editingGame && <><div className="page-intro"><div><p className="eyebrow">UPDATE YOUR LISTING</p><h1>Edit game.</h1><p>Make changes to your listing. Rejected listings can be sent back for review after you save.</p></div></div><form className="surface-card submit-form" onSubmit={saveGameEdits}><div className="form-section-heading"><b>GAME INFORMATION</b><span>{editingGame.status.replace("_", " ").toUpperCase()}</span></div><div className="form-two"><label>Game title<input name="title" defaultValue={editingGame.title} required maxLength={100}/></label><label>Genre<select name="genre" defaultValue={editingGame.genre} required>{["Action","Adventure","Arcade","Casual","Educational","Puzzle","Racing","Role-playing","Simulation","Sports","Strategy"].map((g) => <option key={g}>{g}</option>)}</select></label></div><label>Short description<textarea name="description" rows={4} maxLength={180} required defaultValue={editingGame.short_description || ""}/></label><div className="form-two"><label>Platform<select name="platform" defaultValue={editingGame.supported_platforms?.[0] || "android"}><option value="android">Android</option><option value="windows">Windows PC</option><option value="web">Web</option></select></label><label>Monetization<select name="monetization" defaultValue={editingGame.monetization_type || "free"}><option value="free">Free</option><option value="paid">Paid</option><option value="free_with_ads">Free with ads</option><option value="free_with_iap">Free with in-app purchases</option><option value="demo">Free demo</option></select></label><label>Price in NGN<input name="priceNaira" type="number" min="0.01" max="1000000" step="0.01" defaultValue={editingGame.price_minor ? (editingGame.price_minor / 100).toFixed(2) : ""} placeholder="e.g. 2500.00"/><small>Required only when monetization is set to Paid. Enter the full NGN amount, not kobo.</small></label></div><div className="checkbox-grid"><label><input type="checkbox" name="offline" defaultChecked={editingGame.offline_support ?? false}/> Supports offline play</label><label><input type="checkbox" name="ads" defaultChecked={editingGame.contains_ads ?? false}/> Contains advertising</label><label><input type="checkbox" name="iap" defaultChecked={editingGame.has_in_app_purchases ?? false}/> Contains in-app purchases</label></div><div className="submission-note"><b>Review status protection</b><p>Saving changes will not publish your game. If the listing was rejected, the app will call the secure resubmission function to return it to the review queue.</p></div><div className="form-actions"><button type="button" className="creator-outline" onClick={() => { setEditingGame(null); setSection("games"); }}>Cancel</button><button className="creator-primary" disabled={busy}>{busy ? "Saving…" : editingGame.status === "rejected" ? "Save and resubmit →" : "Save changes →"}</button></div></form></>}
        {section === "builds" && <BuildManager games={games.map((game) => ({ id: game.id, title: game.title, status: game.status, supported_platforms: game.supported_platforms }))}/>}
        {section === "analytics" && <CreatorAnalytics/>}
        {section === "sales" && <CreatorSales/>}
        {section === "notifications" && <CreatorInbox userId={user.id}/>}
        {section === "settings" && <><div className="page-intro"><div><p className="eyebrow">STUDIO PROFILE</p><h1>Studio settings</h1><p>Manage your developer identity and publishing status.</p></div></div><section className="surface-card settings-card"><div className="settings-avatar">{studio.studio_name.slice(0, 1).toUpperCase()}</div><div><h2>{studio.studio_name}</h2><p className="slug-text">gameon.dev/studios/{studio.slug}</p><span className={`status-pill ${studio.verification_status === "verified" ? "published" : "review"}`}>{studio.verification_status || "pending"} verification</span></div><div className="settings-row"><span>Account email</span><b>{user.email}</b></div><div className="settings-row"><span>Studio description</span><b>{studio.description || "Not provided"}</b></div><div className="settings-row"><span>Environment</span><b>{user.demo ? "Local demo" : "Connected Supabase"}</b></div></section></>}
      </div>
    </section></main>;
}

function GameTable({ games, onEdit }: { games: GameRow[]; onEdit: (game: GameRow) => void }) {
  if (!games.length) return <div className="table-empty"><span>▣</span><b>No game listings yet</b><p>Your submitted games will appear here.</p></div>;
  return <div className="table-wrap"><table className="games-table"><thead><tr><th>GAME</th><th>GENRE</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{games.map((game) => <tr key={game.id}><td><div className="table-game"><span className="mini-game-icon">🎮</span><div><b>{game.title}</b><small>{game.slug}</small></div></div></td><td>{game.genre}</td><td><span className={`status-pill ${game.status === "published" ? "published" : game.status === "draft" ? "draft" : game.status === "rejected" ? "rejected" : "review"}`}>{game.status.replace("_", " ")}</span></td><td><button className="row-menu" onClick={() => onEdit(game)} disabled={game.status === "published"} aria-label={`Edit ${game.title}`}>{game.status === "published" ? "Locked" : "Edit →"}</button></td></tr>)}</tbody></table></div>;
}
