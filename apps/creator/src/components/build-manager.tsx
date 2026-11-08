"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type GameOption = { id: string; title: string; status: string; supported_platforms?: string[] };
type BuildRow = { id: string; game_id: string; game_title: string; version_label: string; platform: string; file_size_bytes: number; original_file_name: string | null; upload_status: string; scan_status: string; release_status: string; scan_report: string | null; created_at: string; uploaded_at: string | null };

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const extensions: Record<string, string[]> = { android: ["apk", "aab"], windows: ["exe", "msi", "zip"], web: ["zip"] };

export default function BuildManager({ games, studioVerified, scannerEnabled, onCreateListing }: { games: GameOption[]; studioVerified: boolean; scannerEnabled: boolean; onCreateListing?: () => void }) {
  const eligibleGames = useMemo(() => games.filter((game) => ["draft", "submitted", "rejected"].includes(game.status)), [games]);
  const [builds, setBuilds] = useState<BuildRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [gameId, setGameId] = useState(eligibleGames[0]?.id || "");
  const [platform, setPlatform] = useState(eligibleGames[0]?.supported_platforms?.[0] || "android");
  const [buildQuery, setBuildQuery] = useState("");
  const [buildFilter, setBuildFilter] = useState<"all" | "pending" | "attention" | "approved">("all");

  const selectedGame = eligibleGames.find((game) => game.id === gameId);
  const canUpload = Boolean(supabase && studioVerified && scannerEnabled && eligibleGames.length > 0);
  const buildCounts = useMemo(() => ({
    all: builds.length,
    pending: builds.filter((build) => !["rejected", "failed"].includes(build.scan_status) && build.release_status !== "approved").length,
    attention: builds.filter((build) => ["rejected", "failed"].includes(build.upload_status) || ["rejected", "failed"].includes(build.scan_status) || build.release_status === "rejected").length,
    approved: builds.filter((build) => build.release_status === "approved").length,
  }), [builds]);
  const visibleBuilds = useMemo(() => {
    const term = buildQuery.trim().toLowerCase();
    return builds.filter((build) => {
      const matchesFilter = buildFilter === "all"
        || (buildFilter === "pending" && !["rejected", "failed"].includes(build.scan_status) && build.release_status !== "approved")
        || (buildFilter === "attention" && (["rejected", "failed"].includes(build.upload_status) || ["rejected", "failed"].includes(build.scan_status) || build.release_status === "rejected"))
        || (buildFilter === "approved" && build.release_status === "approved");
      const searchable = [build.game_title, build.version_label, build.original_file_name || "", build.platform, build.upload_status, build.scan_status, build.release_status, build.scan_report || ""].join(" ").toLowerCase();
      return matchesFilter && (!term || searchable.includes(term));
    }).sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0));
  }, [builds, buildFilter, buildQuery]);
  const buildFilters = [
    { id: "all" as const, label: "All builds", count: buildCounts.all },
    { id: "pending" as const, label: "Awaiting scan / decision", count: buildCounts.pending },
    { id: "attention" as const, label: "Needs attention", count: buildCounts.attention },
    { id: "approved" as const, label: "Release approved", count: buildCounts.approved },
  ];
  const allowedExtensions = extensions[platform] || [];
  const platforms = selectedGame?.supported_platforms?.length ? selectedGame.supported_platforms : ["android"];

  const loadBuilds = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) { setError("Sign in again to view your uploaded builds."); setLoading(false); return; }
    const response = await fetch("/api/builds", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) setError(payload.error || "Unable to load build history.");
    else setBuilds(payload.builds || []);
    setLoading(false);
  }, []);

  useEffect(() => { void loadBuilds(); }, [loadBuilds]);
  useEffect(() => { if (!gameId && eligibleGames.length) { setGameId(eligibleGames[0].id); setPlatform(eligibleGames[0].supported_platforms?.[0] || "android"); } }, [eligibleGames, gameId]);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setError("");
    const formElement = event.currentTarget;
    if (!supabase) { setError("Connect Game ON Creator to Supabase before uploading real builds. Demo mode never uploads files."); return; }
    if (!studioVerified) { setError("Your developer studio must be verified before you can upload builds."); return; }
    if (!scannerEnabled) { setError("Secure build scanning is not enabled yet. Uploads will open after the private scanner is deployed and tested."); return; }
    if (!selectedGame) { setError("Choose one of your eligible game listings."); return; }
    const form = new FormData(event.currentTarget);
    const version = String(form.get("version") || "").trim();
    const file = form.get("buildFile");
    if (!(file instanceof File) || file.size < 1) { setError("Choose a game build file."); return; }
    if (file.size > MAX_UPLOAD_BYTES) { setError("The current beta upload limit is 50 MB per file. Larger builds require resumable uploads and a suitable Storage plan."); return; }
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    if (!(extensions[platform] || []).includes(extension)) { setError(`For ${platform}, upload one of: ${(extensions[platform] || []).join(", ")}.`); return; }
    if (!/^[A-Za-z0-9][A-Za-z0-9._+-]{0,39}$/.test(version)) { setError("Enter a version label (1–40 characters; letters, numbers, dot, underscore, plus or hyphen). "); return; }

    setBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");
      const prepareResponse = await fetch("/api/builds/upload-url", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ gameId, version, platform, fileName: file.name, fileSize: file.size }),
      });
      const prepared = await prepareResponse.json().catch(() => ({}));
      if (!prepareResponse.ok) throw new Error(prepared.error || "Unable to prepare the secure upload.");
      const { error: uploadError } = await supabase.storage.from(prepared.bucket).uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: "application/octet-stream", cacheControl: "3600" });
      if (uploadError) throw new Error(`File upload failed: ${uploadError.message}`);
      const finishResponse = await fetch("/api/builds/finalize", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ buildId: prepared.buildId }) });
      const finished = await finishResponse.json().catch(() => ({}));
      if (!finishResponse.ok) throw new Error(finished.error || "The upload arrived but could not be finalized.");
      setMessage("Build uploaded into private quarantine. It is not downloadable and cannot be released until a trusted malware scanner reports it clean and Game ON approves the release.");
      formElement.reset();
      await loadBuilds();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please retry.");
    } finally { setBusy(false); }
  }

  return <div className="build-manager builds-workspace">
    <div className="page-intro builds-page-intro">
      <div>
        <p className="eyebrow">PRIVATE BUILD DELIVERY</p>
        <h1>Game builds.</h1>
        <p>Manage private game files, understand each security checkpoint, and follow build decisions. Uploading a file never publishes it automatically.</p>
      </div>
      <button className="creator-outline" type="button" onClick={() => void loadBuilds()} disabled={loading}>↻ {loading ? "Refreshing…" : "Refresh history"}</button>
    </div>

    {message && <div className="build-notice" role="status">{message}</div>}
    {error && <div className="build-error" role="alert">{error}</div>}

    <section className="builds-gate-panel" aria-labelledby="builds-gate-title">
      <div className="builds-gate-heading">
        <div>
          <p className="eyebrow">UPLOAD REQUIREMENTS</p>
          <h2 id="builds-gate-title">Three checks before a build can be uploaded</h2>
          <p>These safeguards protect creators and players. A listing and a game file are separate parts of publishing.</p>
        </div>
        <span className={canUpload ? "builds-gate-overall ready" : "builds-gate-overall blocked"}>{canUpload ? "Prerequisites met" : "Upload unavailable"}</span>
      </div>
      <div className="builds-gate-steps">
        <article className={studioVerified ? "builds-gate-step ready" : "builds-gate-step blocked"}>
          <span className="builds-gate-step-icon" aria-hidden="true">{studioVerified ? "✓" : "01"}</span>
          <div><b>Studio verification</b><strong>{studioVerified ? "Verified" : "Required"}</strong><p>{studioVerified ? "Your studio has passed the current verification check." : "Game ON must verify your studio before private file uploads open."}</p></div>
        </article>
        <article className={scannerEnabled ? "builds-gate-step ready" : "builds-gate-step blocked"}>
          <span className="builds-gate-step-icon" aria-hidden="true">{scannerEnabled ? "✓" : "02"}</span>
          <div><b>Trusted malware scanner</b><strong>{scannerEnabled ? "Configured" : "Not enabled"}</strong><p>{scannerEnabled ? "Build files remain private until the configured scanner returns a result." : "The private scanner is not enabled. Uploads stay closed; no file is accepted as clean without a real scan."}</p></div>
        </article>
        <article className={eligibleGames.length > 0 ? "builds-gate-step ready" : "builds-gate-step blocked"}>
          <span className="builds-gate-step-icon" aria-hidden="true">{eligibleGames.length > 0 ? "✓" : "03"}</span>
          <div><b>Eligible game listing</b><strong>{eligibleGames.length > 0 ? eligibleGames.length + " available" : "Required"}</strong><p>{eligibleGames.length > 0 ? "Choose a draft, submitted or changes-requested listing for this build." : "Create a draft or submit a listing first. Published and actively reviewed games are locked here."}</p></div>
        </article>
      </div>
      {!supabase && <p className="builds-gate-footnote">Real file uploads require a connected Creator account. Demo mode never uploads files.</p>}
    </section>

    <section className="surface-card builds-upload-card" aria-labelledby="builds-upload-title">
      <div className="builds-section-heading">
        <div><p className="eyebrow">SECURE UPLOAD</p><h2 id="builds-upload-title">Upload a game build</h2><p>Supported formats depend on the selected platform. Current beta limit: 50 MB per file.</p></div>
        <span className="builds-private-label"><span aria-hidden="true">●</span> PRIVATE QUARANTINE</span>
      </div>
      {!supabase ? <div className="builds-blocked-message"><b>Connect your Creator workspace</b><p>Demo mode is active. Connect Supabase to upload real files; this demo intentionally does not accept executable uploads.</p></div>
        : !studioVerified ? <div className="builds-blocked-message"><b>Studio verification required</b><p>Your studio must pass Game ON verification before a build upload can be prepared.</p></div>
        : !scannerEnabled ? <div className="builds-blocked-message"><b>Secure scanning is not enabled yet</b><p>The private malware scanner and ClamAV service must be deployed and tested before any build file can be accepted. This screen is read-only until then.</p></div>
        : !eligibleGames.length ? <div className="builds-blocked-message"><b>No eligible game listing yet</b><p>Create a draft or submit a listing first. Actively reviewed and published listings cannot start a new upload through this screen.</p>{onCreateListing && <button className="creator-outline" type="button" onClick={onCreateListing}>Go to game submission →</button>}</div>
        : <form onSubmit={handleUpload} className="build-upload-form builds-upload-form">
          <div className="form-two">
            <label>Game listing<select value={gameId} onChange={(event) => { setGameId(event.target.value); const next = eligibleGames.find((g) => g.id === event.target.value); setPlatform(next?.supported_platforms?.[0] || "android"); }} required>{eligibleGames.map((game) => <option value={game.id} key={game.id}>{game.title} · {game.status.replaceAll("_", " ")}</option>)}</select><small>Only eligible listings are shown.</small></label>
            <label>Platform<select value={platform} onChange={(event) => setPlatform(event.target.value)} required>{platforms.map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}</select><small>Choose the platform for this exact build file.</small></label>
          </div>
          <div className="form-two">
            <label>Version label<input name="version" required maxLength={40} placeholder="e.g. 1.0.0" pattern="[A-Za-z0-9][A-Za-z0-9._+-]{0,39}"/><small>Use a clear version such as 1.0.0 or 1.0.1-beta.</small></label>
            <label>Game build file<input type="file" name="buildFile" accept={allowedExtensions.map((ext) => "." + ext).join(",")} required/><small>{platform.toUpperCase()}: {allowedExtensions.map((ext) => ext.toUpperCase()).join(" / ") || "No supported file type"} · 50 MB maximum.</small></label>
          </div>
          <div className="builds-upload-checklist">
            <b>Before you upload</b>
            <ul>
              <li>Upload only a build that your studio owns or has distribution rights to.</li>
              <li>Make sure the file matches the selected platform and version.</li>
              <li>Files enter private quarantine and are not available to players during scanning or review.</li>
            </ul>
          </div>
          <div className="form-actions builds-upload-actions"><button className="creator-primary" disabled={busy || !canUpload}>{busy ? "Uploading securely…" : "Upload to private quarantine →"}</button></div>
        </form>}
    </section>

    <section className="builds-history-section" aria-labelledby="builds-history-title">
      <div className="builds-history-heading">
        <div><p className="eyebrow">BUILD RECORDS</p><h2 id="builds-history-title">Build history</h2><p>Follow upload, scan and release decisions separately.</p></div>
        <span className="builds-history-total">{buildCounts.all.toLocaleString()} {buildCounts.all === 1 ? "record" : "records"}</span>
      </div>
      <div className="builds-history-summary">
        <article><strong>{buildCounts.all.toLocaleString()}</strong><span>Total builds</span></article>
        <article><strong>{buildCounts.pending.toLocaleString()}</strong><span>Awaiting scan / decision</span></article>
        <article><strong>{buildCounts.attention.toLocaleString()}</strong><span>Needs attention</span></article>
        <article><strong>{buildCounts.approved.toLocaleString()}</strong><span>Release approved</span></article>
      </div>
      <section className="surface-card builds-history-card">
        <div className="builds-history-toolbar">
          <label className="builds-search"><span>SEARCH BUILD RECORDS</span><input type="search" value={buildQuery} onChange={(event) => setBuildQuery(event.target.value)} placeholder="Search game, version, filename or status…" aria-label="Search build history"/></label>
          <div className="builds-history-count" aria-live="polite"><b>{visibleBuilds.length}</b><span>shown</span></div>
        </div>
        <div className="builds-filter-row" aria-label="Filter build history">
          {buildFilters.map((item) => <button type="button" key={item.id} className={buildFilter === item.id ? "active" : ""} aria-pressed={buildFilter === item.id} onClick={() => setBuildFilter(item.id)}>{item.label}<strong>{item.count}</strong></button>)}
        </div>
        {loading ? <p className="build-muted">Loading build history…</p> : builds.length === 0 ? <div className="builds-empty"><span aria-hidden="true">⇧</span><b>No build records yet</b><p>When an eligible build is securely uploaded, its private upload and review states will appear here.</p></div> : visibleBuilds.length === 0 ? <div className="builds-empty"><span aria-hidden="true">⌕</span><b>No build records match this view</b><p>Try a different status filter or search term.</p><button className="creator-outline" type="button" onClick={() => { setBuildFilter("all"); setBuildQuery(""); }}>Clear filters</button></div> : <div className="build-list builds-history-list">{visibleBuilds.map((build) => {
          const uploadNeedsAttention = ["rejected", "failed"].includes(build.upload_status);
          const scanNeedsAttention = ["rejected", "failed"].includes(build.scan_status);
          const releaseNeedsAttention = build.release_status === "rejected";
          const releaseApproved = build.release_status === "approved";
          const buildSummary = releaseNeedsAttention
            ? "Game ON did not approve this build for release. Review the decision and contact support if you need clarification."
            : uploadNeedsAttention
              ? "The file upload did not complete successfully. Check the upload state and try again when uploads are available."
              : scanNeedsAttention
              ? "This build was not cleared by the scanner. Review the report and contact Game ON support if you need help."
              : releaseApproved
                ? "Game ON has approved this build's release status."
                : build.scan_status === "clean"
                  ? "The scanner reported a clean result, but release approval is still separate."
                  : "This file remains private while it waits for a trusted scan and release decision.";
          return <article className="build-row builds-history-row" key={build.id}>
            <div className="builds-history-main">
              <div className="builds-history-titleline"><b>{build.game_title}</b><span>v{build.version_label}</span></div>
              <small>{build.original_file_name || "Game build"} · {build.platform.toUpperCase()} · {(Number(build.file_size_bytes) / 1024 / 1024).toFixed(1)} MB</small>
              <small>Created {new Date(build.created_at).toLocaleString()}</small>
            </div>
            <div className="build-statuses builds-history-statuses">
              <span className={"status-pill " + (build.upload_status === "uploaded" ? "published" : "review")}>Upload: {build.upload_status.replaceAll("_", " ")}</span>
              <span className={"status-pill " + (build.scan_status === "clean" ? "published" : scanNeedsAttention ? "rejected" : "review")}>Scan: {build.scan_status.replaceAll("_", " ")}</span>
              <span className={"status-pill " + (releaseApproved ? "published" : build.release_status === "rejected" ? "rejected" : "review")}>Release: {build.release_status.replaceAll("_", " ")}</span>
            </div>
            <p className="builds-history-summaryline">{buildSummary}</p>
            {build.scan_report && <p className="build-muted build-report">{build.scan_report}</p>}
          </article>;
        })}</div>}
      </section>
      <p className="builds-history-disclaimer">A successful upload is not a clean scan, and a clean scan is not release approval. Build files stay private unless the separate release process approves them.</p>
    </section>
  </div>;
}
