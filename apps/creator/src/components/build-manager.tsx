"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type GameOption = { id: string; title: string; status: string; supported_platforms?: string[] };
type BuildRow = { id: string; game_id: string; game_title: string; version_label: string; platform: string; file_size_bytes: number; original_file_name: string | null; upload_status: string; scan_status: string; release_status: string; scan_report: string | null; created_at: string; uploaded_at: string | null };

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const extensions: Record<string, string[]> = { android: ["apk", "aab"], windows: ["exe", "msi", "zip"], web: ["zip"] };

export default function BuildManager({ games, studioVerified, scannerEnabled }: { games: GameOption[]; studioVerified: boolean; scannerEnabled: boolean }) {
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
    pending: builds.filter((build) => !["clean", "rejected", "failed"].includes(build.scan_status) && build.release_status !== "approved").length,
    attention: builds.filter((build) => ["rejected", "failed"].includes(build.scan_status) || build.release_status === "rejected").length,
    approved: builds.filter((build) => build.release_status === "approved").length,
  }), [builds]);
  const visibleBuilds = useMemo(() => {
    const term = buildQuery.trim().toLowerCase();
    return builds.filter((build) => {
      const matchesFilter = buildFilter === "all"
        || (buildFilter === "pending" && !["clean", "rejected", "failed"].includes(build.scan_status) && build.release_status !== "approved")
        || (buildFilter === "attention" && (["rejected", "failed"].includes(build.scan_status) || build.release_status === "rejected"))
        || (buildFilter === "approved" && build.release_status === "approved");
      const searchable = [build.game_title, build.version_label, build.original_file_name || "", build.platform, build.upload_status, build.scan_status, build.release_status, build.scan_report || ""].join(" ").toLowerCase();
      return matchesFilter && (!term || searchable.includes(term));
    }).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
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

  return <div className="build-manager">
    <div className="page-intro"><div><p className="eyebrow">PRIVATE BUILD DELIVERY</p><h1>Game builds.</h1><p>Upload a build for your game. Files go to private quarantine and must pass a trusted malware scan plus Game ON release review.</p></div><button className="creator-outline" type="button" onClick={() => void loadBuilds()} disabled={loading}>↻ Refresh</button></div>
    {message && <div className="build-notice" role="status">{message}</div>}{error && <div className="build-error" role="alert">{error}</div>}
    <section className="surface-card submit-form">
      <div className="form-section-heading"><b>UPLOAD A GAME BUILD</b><span>PRIVATE · 50 MB MAX</span></div>
      {!supabase && <div className="build-warning">Demo mode is active. Connect Supabase to upload real files; demo mode intentionally disables file upload.</div>}
      {!studioVerified ? <div className="build-warning">Studio verification is required before uploads are enabled. Your current studio status must be approved by Game ON.</div> : !scannerEnabled ? <div className="build-warning">Uploads are disabled until Game ON’s private malware scanner and ClamAV service have been deployed and tested.</div> : !eligibleGames.length ? <p className="build-muted">You need a draft, submitted or rejected listing before uploading a build. Published and actively reviewed listings are locked.</p> : <form onSubmit={handleUpload} className="build-upload-form">
        <label>Game listing<select value={gameId} onChange={(event) => { setGameId(event.target.value); const next = eligibleGames.find((g) => g.id === event.target.value); setPlatform(next?.supported_platforms?.[0] || "android"); }} required>{eligibleGames.map((game) => <option value={game.id} key={game.id}>{game.title} · {game.status.replaceAll("_", " ")}</option>)}</select></label>
        <div className="form-two"><label>Platform<select value={platform} onChange={(event) => setPlatform(event.target.value)}>{platforms.map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}</select></label><label>Version label<input name="version" required maxLength={40} placeholder="e.g. 1.0.0" pattern="[A-Za-z0-9][A-Za-z0-9._+-]{0,39}"/></label></div>
        <label>Game build file<input type="file" name="buildFile" accept=".apk,.aab,.exe,.msi,.zip" required/><small>Android: APK/AAB · Windows: EXE/MSI/ZIP · Web: ZIP. Current limit: 50 MB.</small></label>
        <div className="submission-note"><b>Important safety notice</b><p>Uploads remain private. This initial pipeline does not itself scan malware; it waits for a separately configured trusted scanner. Never upload third-party games without distribution rights.</p></div>
        <div className="form-actions"><button className="creator-primary" disabled={busy || !supabase || !studioVerified || !scannerEnabled}>{busy ? "Uploading securely…" : "Upload to private quarantine →"}</button></div>
      </form>}
    </section>
    <section className="surface-card full-card"><div className="surface-heading"><div><h2>Build history</h2><p>{builds.length} uploaded or pending build records</p></div></div>
      {loading ? <p className="build-muted">Loading builds…</p> : builds.length === 0 ? <p className="build-muted">No build files uploaded yet.</p> : <div className="build-list">{builds.map((build) => <article className="build-row" key={build.id}><div><b>{build.game_title} · v{build.version_label}</b><small>{build.original_file_name || "Game build"} · {build.platform.toUpperCase()} · {(Number(build.file_size_bytes) / 1024 / 1024).toFixed(1)} MB</small><small>{new Date(build.created_at).toLocaleString()}</small></div><div className="build-statuses"><span className={`status-pill ${build.upload_status === "uploaded" ? "published" : "review"}`}>{build.upload_status.replaceAll("_", " ")}</span><span className={`status-pill ${build.scan_status === "clean" ? "published" : build.scan_status === "rejected" || build.scan_status === "failed" ? "rejected" : "review"}`}>{build.scan_status}</span><span className={`status-pill ${build.release_status === "approved" ? "published" : "review"}`}>{build.release_status}</span></div>{build.scan_report && <p className="build-muted build-report">{build.scan_report}</p>}</article>)}</div>}
    </section>
  </div>;
}
