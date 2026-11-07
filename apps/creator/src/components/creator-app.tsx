"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import BuildManager from "@/components/build-manager";
import { CreatorAnalytics, CreatorInbox } from "@/components/creator-insights";
import CreatorSales from "@/components/creator-sales";
import { getListingReadiness, type ListingReadiness } from "@/lib/listing-readiness.mjs";
import StudioOnboardingWizard, { type StudioSetupData, type StudioSetupProfile } from "@/components/studio-onboarding-wizard";

type Section = "overview" | "games" | "drafts" | "submit" | "edit" | "builds" | "analytics" | "sales" | "notifications" | "settings";
type PlatformDetail = {
  platform: string;
  official_access_url?: string | null;
  official_access_url_verified_at?: string | null;
  download_size_bytes?: number | null;
  download_size_verified_at?: string | null;
  internet_requirement?: "unknown" | "offline" | "online" | "both";
  internet_requirement_verified_at?: string | null;
  minimum_requirements?: Record<string, unknown>;
  minimum_requirements_verified_at?: string | null;
};
type GameRow = { id: string; title: string; slug: string; genre: string; status: string; reviewed_at?: string | null; rejection_reason?: string | null; created_at?: string; updated_at?: string; short_description?: string; monetization_type?: string; supported_platforms?: string[]; supported_languages?: string[]; age_rating?: string | null; game_platform_details?: PlatformDetail[]; offline_support?: boolean; contains_ads?: boolean; has_in_app_purchases?: boolean; price_minor?: number | null; currency?: string | null };
type Studio = { id: string; studio_name: string; slug: string; description?: string | null; website_url?: string | null; logo_url?: string | null; verification_status?: string; demo?: boolean };
type StudioContactProfile = StudioSetupProfile;
type CreatorUser = { id: string; email?: string; demo?: boolean };

const demoRows: GameRow[] = [
  { id: "demo-001", title: "Neon Drift", slug: "neon-drift", genre: "Racing", status: "published", short_description: "High-speed racing through a neon city.", monetization_type: "free" },
  { id: "demo-002", title: "Emberfall", slug: "emberfall", genre: "Adventure", status: "in_review", short_description: "Explore ancient ruins in a story-rich world.", monetization_type: "demo" },
  { id: "demo-003", title: "Orbit Keepers", slug: "orbit-keepers", genre: "Strategy", status: "draft", short_description: "Build and defend a frontier space outpost.", monetization_type: "free" },
];

function makeSlug(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

type ParsedGameFit = { error: string | null; supportedLanguages: string[]; ageRating: string | null; platformDetail: PlatformDetail | null };
type ParsedGameFits = { error: string | null; supportedLanguages: string[]; ageRating: string | null; platformDetails: PlatformDetail[] };
const GAME_PLATFORMS = [{ value: "android", label: "Android" }, { value: "windows", label: "Windows PC" }, { value: "web", label: "Web" }] as const;
function readGameFitInput(form: FormData, platform: string): ParsedGameFit {
  const field = (name: string) => form.get(`${name}_${platform}`);
  const rawUrl = String(field("officialAccessUrl") || "").trim();
  let officialAccessUrl: string | null = null;
  if (rawUrl) {
    try { const parsed = new URL(rawUrl); if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) throw new Error("Use a public HTTPS game page without embedded credentials."); officialAccessUrl = parsed.toString(); }
    catch (error) { return { error: error instanceof Error ? error.message : "Enter a valid HTTPS game page.", supportedLanguages: [], ageRating: null, platformDetail: null }; }
  }
  const rawSize = String(field("downloadSizeMb") || "").trim(); const sizeMb = rawSize ? Number(rawSize) : null;
  if (sizeMb !== null && (!Number.isFinite(sizeMb) || sizeMb <= 0 || sizeMb > 1048576)) return { error: `Enter a valid download size for ${platform.toUpperCase()} (greater than 0 and no more than 1,048,576 MB).`, supportedLanguages: [], ageRating: null, platformDetail: null };
  const internetRequirement = String(field("internetRequirement") || "unknown") as NonNullable<PlatformDetail["internet_requirement"]>;
  if (!["unknown", "offline", "online", "both"].includes(internetRequirement)) return { error: `Choose a valid internet requirement for ${platform.toUpperCase()}.`, supportedLanguages: [], ageRating: null, platformDetail: null };
  const requirements: Record<string, string> = {};
  const requirementFields: Record<string, string> = { operating_system: "minimumOs", processor: "minimumProcessor", ram: "minimumRam", graphics: "minimumGraphics", storage: "minimumStorage" };
  for (const [key, name] of Object.entries(requirementFields)) { const value = String(field(name) || "").trim(); if (value.length > 200) return { error: `Each ${platform.toUpperCase()} device requirement must be 200 characters or fewer.`, supportedLanguages: [], ageRating: null, platformDetail: null }; if (value) requirements[key] = value; }
  const supportedLanguages = [...new Set(String(form.get("supportedLanguages") || "").split(",").map((item) => item.trim()).filter(Boolean))].slice(0, 20);
  if (supportedLanguages.some((item) => item.length > 40)) return { error: "Each supported language must be 40 characters or fewer.", supportedLanguages: [], ageRating: null, platformDetail: null };
  const rawAgeRating = String(form.get("ageRating") || "").trim();
  if (rawAgeRating.length > 60) return { error: "Age rating must be 60 characters or fewer.", supportedLanguages: [], ageRating: null, platformDetail: null };
  return { error: null, supportedLanguages, ageRating: rawAgeRating || null, platformDetail: { platform, official_access_url: officialAccessUrl, download_size_bytes: sizeMb === null ? null : Math.round(sizeMb * 1024 * 1024), internet_requirement: internetRequirement, minimum_requirements: requirements } };
}
function readGameFitInputs(form: FormData, platforms: string[], requirePlatform = true): ParsedGameFits {
  const allowed = new Set<string>(GAME_PLATFORMS.map((item) => item.value));
  const uniquePlatforms = [...new Set(platforms)].filter((platform) => allowed.has(platform));
  if (!uniquePlatforms.length) {
    if (requirePlatform) return { error: "Select at least one supported platform.", supportedLanguages: [], ageRating: null, platformDetails: [] };
    const supportedLanguages = [...new Set(String(form.get("supportedLanguages") || "").split(",").map((item) => item.trim()).filter(Boolean))].slice(0, 20);
    if (supportedLanguages.some((item) => item.length > 40)) return { error: "Each supported language must be 40 characters or fewer.", supportedLanguages: [], ageRating: null, platformDetails: [] };
    const rawAgeRating = String(form.get("ageRating") || "").trim();
    if (rawAgeRating.length > 60) return { error: "Age rating must be 60 characters or fewer.", supportedLanguages: [], ageRating: null, platformDetails: [] };
    return { error: null, supportedLanguages, ageRating: rawAgeRating || null, platformDetails: [] };
  }
  const parsed = uniquePlatforms.map((platform) => readGameFitInput(form, platform));
  const invalid = parsed.find((item) => item.error || !item.platformDetail);
  const shared = parsed[0];
  if (invalid || !shared) return { error: invalid?.error || "Check the GAME FIT information for each selected platform.", supportedLanguages: shared?.supportedLanguages || [], ageRating: shared?.ageRating || null, platformDetails: [] };
  return { error: null, supportedLanguages: shared.supportedLanguages, ageRating: shared.ageRating, platformDetails: parsed.map((item) => item.platformDetail as PlatformDetail) };
}
function getSubmissionAction(event: FormEvent<HTMLFormElement>) {
  const submitter = (event.nativeEvent as SubmitEvent).submitter;
  return submitter instanceof HTMLButtonElement && submitter.value ? submitter.value : "submit";
}
function PlatformGameFitFields({ platform, detail }: { platform: string; detail?: PlatformDetail | null }) {
  const platformLabel = GAME_PLATFORMS.find((item) => item.value === platform)?.label || platform.toUpperCase();
  const requirements = detail?.minimum_requirements || {};
  const sizeMb = detail?.download_size_bytes ? (detail.download_size_bytes / (1024 * 1024)).toFixed(2) : "";
  return <>
    <div className="form-section-heading separated"><b>{platformLabel.toUpperCase()} GAME FIT</b><span>PLATFORM-SPECIFIC FACTS</span></div>
    <div className="form-two">
      <label>Official {platformLabel} game page (HTTPS)<input name={`officialAccessUrl_${platform}`} type="url" maxLength={2048} defaultValue={detail?.official_access_url || ""} placeholder="https://official-game-page.example"/><small>Developer-provided link. It will not be clickable in Store until verified.</small></label>
      <label>{platformLabel} download size (MB)<input name={`downloadSizeMb_${platform}`} type="number" min="0.01" max="1048576" step="0.01" defaultValue={sizeMb} placeholder="e.g. 850"/><small>Enter download size, not installed storage.</small></label>
      <label>Internet requirement<select name={`internetRequirement_${platform}`} defaultValue={detail?.internet_requirement || "unknown"}><option value="unknown">Not sure / not supplied</option><option value="offline">Works offline</option><option value="online">Internet required</option><option value="both">Online and offline modes</option></select></label>
      <label>Minimum operating system<input name={`minimumOs_${platform}`} maxLength={200} defaultValue={String(requirements.operating_system || "")} placeholder={platform === "android" ? "e.g. Android 10" : platform === "windows" ? "e.g. Windows 10" : "e.g. Modern browser version"}/></label>
      <label>Minimum processor<input name={`minimumProcessor_${platform}`} maxLength={200} defaultValue={String(requirements.processor || "")} placeholder="e.g. Quad-core 2.0 GHz"/></label>
      <label>Minimum memory / RAM<input name={`minimumRam_${platform}`} maxLength={200} defaultValue={String(requirements.ram || "")} placeholder="e.g. 4 GB RAM"/></label>
      <label>Minimum graphics<input name={`minimumGraphics_${platform}`} maxLength={200} defaultValue={String(requirements.graphics || "")} placeholder="e.g. OpenGL ES 3.0"/></label>
      <label>Storage required<input name={`minimumStorage_${platform}`} maxLength={200} defaultValue={String(requirements.storage || "")} placeholder="e.g. 2 GB free space"/></label>
    </div>
    <p className="submission-note">Only enter information for this platform. Leave unknown information blank. Game ON will mark these facts unverified until checked.</p>
  </>;
}

export default function CreatorApp({ scannerEnabled = false }: { scannerEnabled?: boolean } = {}) {
  const [section, setSection] = useState<Section>("overview");
  const [user, setUser] = useState<CreatorUser | null>(null);
  const [studio, setStudio] = useState<Studio | null>(null);
  const [studioProfile, setStudioProfile] = useState<StudioContactProfile | null>(null);
  const [games, setGames] = useState<GameRow[]>([]);
  const [editingGame, setEditingGame] = useState<GameRow | null>(null);
  const [submitPlatforms, setSubmitPlatforms] = useState<string[]>(["android"]);
  const [editingPlatforms, setEditingPlatforms] = useState<string[]>(["android"]);
  const [authMode, setAuthMode] = useState<"signup" | "signin">("signup");
  const [authMessage, setAuthMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const [draftSearch, setDraftSearch] = useState("");
  const [draftSort, setDraftSort] = useState<"recent" | "oldest" | "title" | "most-complete" | "least-complete">("recent");
  const [formReadiness, setFormReadiness] = useState<ListingReadiness>(() => getNewListingReadiness());
  const [studioLoading, setStudioLoading] = useState(true);
  const [studioProfileLoading, setStudioProfileLoading] = useState(true);
  const [setupError, setSetupError] = useState("");

  useEffect(() => {
    if (!supabase) {
      try {
        const savedUser = localStorage.getItem("goc-demo-user");
        const savedStudio = localStorage.getItem("goc-demo-studio");
        const savedStudioProfile = localStorage.getItem("goc-demo-studio-profile");
        const savedGames = localStorage.getItem("goc-demo-games");
        if (savedUser) setUser(JSON.parse(savedUser));
        if (savedStudio) setStudio(JSON.parse(savedStudio));
        if (savedStudioProfile) setStudioProfile(JSON.parse(savedStudioProfile));
        setStudioLoading(false);
        setStudioProfileLoading(false);
        if (savedGames) setGames(JSON.parse(savedGames)); else setGames(demoRows);
      } catch { setGames(demoRows); }
      return;
    }
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ? { id: data.session.user.id, email: data.session.user.email } : null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ? { id: session.user.id, email: session.user.email } : null));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setStudio(null);
      setStudioProfile(null);
      setStudioLoading(false);
      setStudioProfileLoading(false);
      return;
    }
    if (user.demo || !supabase) {
      setStudioLoading(false);
      setStudioProfileLoading(false);
      return;
    }
    let active = true;
    setStudioLoading(true);
    supabase.from("developer_studios").select("id,studio_name,slug,description,website_url,logo_url,verification_status").eq("owner_user_id", user.id).maybeSingle().then(({ data, error }) => {
      if (!active) return;
      if (error) setNotice(error.message);
      setStudio(data as Studio | null);
      setStudioLoading(false);
    });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!studio) {
      setStudioProfile(null);
      setStudioProfileLoading(false);
      return;
    }
    if (studio.demo || !supabase || !user) {
      try {
        const saved = localStorage.getItem("goc-demo-studio-profile");
        setStudioProfile(saved ? JSON.parse(saved) as StudioContactProfile : null);
      } catch {
        setStudioProfile(null);
      }
      setStudioProfileLoading(false);
      return;
    }
    let active = true;
    setStudioProfileLoading(true);
    supabase.from("developer_studio_contacts").select("studio_id,owner_user_id,contact_name,contact_role,official_email").eq("studio_id", studio.id).maybeSingle().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setSetupError("Studio contact details could not be loaded: " + error.message);
        setStudioProfile(null);
      } else {
        setStudioProfile(data as StudioContactProfile | null);
      }
      setStudioProfileLoading(false);
    });
    return () => { active = false; };
  }, [studio, user]);

  useEffect(() => {
    if (!studio) return;
    if (studio.demo || !supabase) { if (!games.length) setGames(demoRows); return; }
    let active = true;
    supabase.from("games").select("id,title,slug,genre,status,reviewed_at,rejection_reason,created_at,updated_at,short_description,monetization_type,price_minor,currency,supported_platforms,supported_languages,age_rating,offline_support,contains_ads,has_in_app_purchases,game_platform_details(platform,official_access_url,official_access_url_verified_at,download_size_bytes,download_size_verified_at,internet_requirement,internet_requirement_verified_at,minimum_requirements,minimum_requirements_verified_at)").eq("studio_id", studio.id).order("created_at", { ascending: false }).then(({ data, error }) => {
      if (!active) return;
      if (error) setNotice(error.message); else setGames((data || []) as GameRow[]);
    });
    return () => { active = false; };
  }, [studio]);

  useEffect(() => { if (!supabase && games.length) localStorage.setItem("goc-demo-games", JSON.stringify(games)); }, [games]);

  useEffect(() => {
    if (section === "submit") {
      setSubmitPlatforms(["android"]);
      setFormReadiness(getNewListingReadiness());
    } else if (section === "edit" && editingGame) {
      setFormReadiness(getDraftProgress(editingGame));
    }
  }, [section, editingGame]);

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setAuthMessage("");
    const form = new FormData(event.currentTarget); const email = String(form.get("email") || "").trim(); const password = String(form.get("password") || "");
    if (!supabase) {
      const demoUser = { id: `demo-user-${Date.now()}`, email, demo: true };
      setUser(demoUser); localStorage.setItem("goc-demo-user", JSON.stringify(demoUser)); setBusy(false); return;
    }
    try {
      const result = authMode === "signup" ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) setAuthMessage(result.error.message);
      else if (authMode === "signup" && !result.data.session) setAuthMessage("Check your email to confirm your account, then sign in.");
      else setUser(result.data.user ? { id: result.data.user.id, email: result.data.user.email } : null);
    } catch (caught) {
      setAuthMessage(caught instanceof Error ? caught.message : "Could not contact the account service. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function finishStudioSetup(input: StudioSetupData) {
    if (!user) return;
    setBusy(true);
    setSetupError("");
    setNotice("");
    try {
      const studioName = input.studioName.trim();
      const slug = makeSlug(studioName);
      if (studioName.length < 2 || studioName.length > 80 || !slug) throw new Error("Enter a valid company name between 2 and 80 characters.");
      const website = input.websiteUrl.trim();
      if (website) {
        const parsed = new URL(website);
        if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) throw new Error("Use a public HTTPS company website.");
      }
      if (input.contactName.trim().length < 2 || input.contactName.trim().length > 120) throw new Error("Enter your full name.");
      if (input.contactRole.trim().length < 2 || input.contactRole.trim().length > 60) throw new Error("Enter your role in the company.");
      if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(input.officialEmail.trim())) throw new Error("Enter a valid official company email.");

      if (user.demo || !supabase) {
        const next: Studio = {
          id: studio?.id || `demo-studio-${Date.now()}`,
          studio_name: studioName,
          slug,
          description: input.description.trim() || null,
          website_url: website || null,
          logo_url: studio?.logo_url || null,
          verification_status: studio?.verification_status || "pending",
          demo: true,
        };
        const profile: StudioContactProfile = {
          studio_id: next.id,
          owner_user_id: user.id,
          contact_name: input.contactName.trim(),
          contact_role: input.contactRole.trim(),
          official_email: input.officialEmail.trim().toLowerCase(),
        };
        setStudio(next);
        setStudioProfile(profile);
        localStorage.setItem("goc-demo-studio", JSON.stringify(next));
        localStorage.setItem("goc-demo-studio-profile", JSON.stringify(profile));
        setNotice("Your studio setup is complete. Demo data stays on this device.");
        return;
      }

      const studioValues = {
        studio_name: studioName,
        slug,
        description: input.description.trim() || null,
        website_url: website || null,
      };
      let savedStudio: Studio;
      if (studio && !studio.demo) {
        const { data, error } = await supabase.from("developer_studios").update(studioValues).eq("id", studio.id).eq("owner_user_id", user.id).select("id,studio_name,slug,description,website_url,logo_url,verification_status").single();
        if (error || !data) throw error || new Error("Your studio profile could not be updated.");
        savedStudio = data as Studio;
      } else {
        const { data, error } = await supabase.from("developer_studios").insert({
          owner_user_id: user.id,
          ...studioValues,
        }).select("id,studio_name,slug,description,website_url,logo_url,verification_status").single();
        if (error || !data) throw error || new Error("Your studio could not be created.");
        savedStudio = data as Studio;
      }
      // Keep the partial studio so the wizard can safely resume if a later setup step fails.
      setStudio(savedStudio);
      setStudioProfileLoading(true);

      if (input.logoFile) {
        const allowed: Record<string, { extension: string; type: string }> = {
          "image/jpeg": { extension: "jpg", type: "image/jpeg" },
          "image/png": { extension: "png", type: "image/png" },
          "image/webp": { extension: "webp", type: "image/webp" },
        };
        const image = allowed[input.logoFile.type];
        if (!image || input.logoFile.size < 1 || input.logoFile.size > 3 * 1024 * 1024) throw new Error("Choose a JPG, PNG or WebP company logo smaller than 3 MB.");
        const path = `${user.id}/studio-logo.${image.extension}`;
        const { error: uploadError } = await supabase.storage.from("studio-logos").upload(path, input.logoFile, {
          contentType: image.type,
          cacheControl: "3600",
          upsert: true,
        });
        if (uploadError) throw new Error("Company logo upload failed: " + uploadError.message);
        const logoUrl = supabase.storage.from("studio-logos").getPublicUrl(path).data.publicUrl;
        const { data: updatedStudio, error: logoError } = await supabase.from("developer_studios").update({ logo_url: logoUrl }).eq("id", savedStudio.id).eq("owner_user_id", user.id).select("id,studio_name,slug,description,website_url,logo_url,verification_status").single();
        if (logoError || !updatedStudio) throw logoError || new Error("The company logo uploaded, but the studio profile could not be updated.");
        savedStudio = updatedStudio as Studio;
        setStudio(savedStudio);
      }

      const { error: displayNameError } = await supabase.from("profiles").update({
        display_name: input.contactName.trim(),
        updated_at: new Date().toISOString(),
      }).eq("id", user.id);
      if (displayNameError) throw new Error("Your name could not be saved: " + displayNameError.message);

      const { data: contact, error: contactError } = await supabase.from("developer_studio_contacts").upsert({
        studio_id: savedStudio.id,
        owner_user_id: user.id,
        contact_name: input.contactName.trim(),
        contact_role: input.contactRole.trim(),
        official_email: input.officialEmail.trim().toLowerCase(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "studio_id" }).select("studio_id,owner_user_id,contact_name,contact_role,official_email").single();
      if (contactError || !contact) throw new Error("Your private company contact details could not be saved: " + (contactError?.message || "Please retry."));

      setStudio(savedStudio);
      setStudioProfile(contact as StudioContactProfile);
      setStudioProfileLoading(false);
      setNotice("Your studio setup is complete. Studio verification is still pending until Game ON reviews it.");
    } catch (caught) {
      setStudioProfileLoading(false);
      setSetupError(caught instanceof Error ? caught.message : "Studio setup could not be completed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function saveNewGameDraft(formElement: HTMLFormElement) {
    if (!studio) return;
    setBusy(true); setNotice("");
    const form = new FormData(formElement);
    const title = String(form.get("title") || "").trim();
    if (title.length < 2 || title.length > 100) { setBusy(false); setNotice("Enter a game title between 2 and 100 characters before saving a draft."); return; }
    const genre = String(form.get("genre") || "");
    const description = String(form.get("description") || "").trim();
    const platforms = form.getAll("platforms").map(String);
    const fitInput = readGameFitInputs(form, platforms, false);
    if (fitInput.error) { setBusy(false); setNotice(fitInput.error); return; }
    const monetization = String(form.get("monetization") || "free");
    const priceInput = String(form.get("priceNaira") || "").trim();
    const priceNaira = priceInput ? Number(priceInput) : 0;
    const priceMinor = monetization === "paid" && Number.isFinite(priceNaira) && priceNaira > 0 && Number.isSafeInteger(Math.round(priceNaira * 100)) ? Math.round(priceNaira * 100) : null;
    const ads = form.get("ads") === "on";
    const iap = form.get("iap") === "on";
    const offline = fitInput.platformDetails.some((detail) => detail.internet_requirement === "offline" || detail.internet_requirement === "both");
    const slug = (makeSlug(title) || "game") + "-" + Math.random().toString(36).slice(2, 6);
    const fallbackId = "draft-" + Date.now();
    if (studio.demo || !supabase) {
      const row: GameRow = { id: fallbackId, title, slug, genre, status: "draft", short_description: description, updated_at: new Date().toISOString(), monetization_type: monetization, price_minor: priceMinor, supported_languages: fitInput.supportedLanguages, age_rating: fitInput.ageRating, supported_platforms: platforms, game_platform_details: fitInput.platformDetails, offline_support: offline, contains_ads: ads, has_in_app_purchases: iap };
      setGames((old) => [row, ...old]); setSection("games"); setBusy(false); setNotice("Draft saved on this device. Open My games and choose Continue editing whenever you are ready."); return;
    }
    const { data: draftId, error: createError } = await supabase.rpc("create_game_draft", { p_studio_id: studio.id, p_title: title, p_slug: slug });
    if (createError || !draftId) { setBusy(false); setNotice(createError?.message || "The draft could not be created."); return; }
    const patch = { short_description: description, description, genre, supported_platforms: platforms, supported_languages: fitInput.supportedLanguages, age_rating: fitInput.ageRating, monetization_type: monetization, price_minor: priceMinor, currency: priceMinor === null ? null : "NGN", offline_support: offline, contains_ads: ads, has_in_app_purchases: iap, updated_at: new Date().toISOString() };
    const { error: updateError } = await supabase.from("games").update(patch).eq("id", draftId).eq("studio_id", studio.id);
    let detailsError: { message: string } | null = null;
    if (!updateError && fitInput.platformDetails.length) {
      const result = await supabase.from("game_platform_details").upsert(fitInput.platformDetails.map((detail) => ({ ...detail, game_id: draftId })), { onConflict: "game_id,platform" });
      detailsError = result.error;
    }
    const { data: saved } = await supabase.from("games").select("id,title,slug,genre,status,reviewed_at,rejection_reason,created_at,updated_at,short_description,monetization_type,price_minor,currency,supported_platforms,supported_languages,age_rating,offline_support,contains_ads,has_in_app_purchases,game_platform_details(platform,official_access_url,official_access_url_verified_at,download_size_bytes,download_size_verified_at,internet_requirement,internet_requirement_verified_at,minimum_requirements,minimum_requirements_verified_at)").eq("id", draftId).eq("studio_id", studio.id).maybeSingle();
    if (saved) setGames((old) => [saved as GameRow, ...old.filter((game) => game.id !== draftId)]);
    else setGames((old) => [{ id: String(draftId), title, slug, genre, status: "draft", short_description: description, updated_at: new Date().toISOString(), monetization_type: monetization, price_minor: priceMinor, supported_languages: fitInput.supportedLanguages, age_rating: fitInput.ageRating, supported_platforms: platforms, game_platform_details: fitInput.platformDetails, offline_support: offline, contains_ads: ads, has_in_app_purchases: iap }, ...old]);
    setBusy(false); setSection("games");
    setNotice(updateError ? "Your draft record was created, but some listing details did not save: " + updateError.message : detailsError ? "Draft saved, but some GAME FIT details did not save: " + detailsError.message : "Draft saved privately. Continue editing it from My games whenever you are ready.");
  }

  async function submitGame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!studio) return;
    if (getSubmissionAction(event) === "draft") { await saveNewGameDraft(formElement); return; }
    setBusy(true); setNotice("");
    const form = new FormData(formElement); const title = String(form.get("title") || "").trim(); const genre = String(form.get("genre") || ""); const description = String(form.get("description") || "").trim(); const monetization = String(form.get("monetization") || "free"); const platforms = form.getAll("platforms").map(String); const ads = form.get("ads") === "on"; const iap = form.get("iap") === "on";
    const fitInput = readGameFitInputs(form, platforms);
    if (fitInput.error || !fitInput.platformDetails.length) { setBusy(false); setNotice(fitInput.error || "Check the GAME FIT information for each selected platform."); return; }
    const offline = fitInput.platformDetails.some((detail) => detail.internet_requirement === "offline" || detail.internet_requirement === "both");
    const priceInput = String(form.get("priceNaira") || "").trim();
    const priceNaira = priceInput ? Number(priceInput) : 0;
    if (monetization === "paid" && (!Number.isFinite(priceNaira) || priceNaira <= 0 || !Number.isSafeInteger(Math.round(priceNaira * 100)))) { setBusy(false); setNotice("Enter a valid NGN price greater than zero for a paid game."); return; }
    const priceMinor = monetization === "paid" ? Math.round(priceNaira * 100) : null;
    const slug = (makeSlug(title) || "game") + "-" + Math.random().toString(36).slice(2, 6);
    if (studio.demo || !supabase) {
      const row: GameRow = { id: "demo-" + Date.now(), title, slug, genre, status: "submitted", short_description: description, monetization_type: monetization, supported_languages: fitInput.supportedLanguages, age_rating: fitInput.ageRating, supported_platforms: platforms, game_platform_details: fitInput.platformDetails };
      setGames((old) => [row, ...old]); setNotice("Demo submission saved locally. Connect the shared backend for real review and publishing."); setSection("games"); setBusy(false); return;
    }
    const { data, error } = await supabase.from("games").insert({ studio_id: studio.id, title, slug, short_description: description, description, genre, supported_platforms: platforms, supported_languages: fitInput.supportedLanguages, age_rating: fitInput.ageRating, monetization_type: monetization, price_minor: priceMinor, currency: monetization === "paid" ? "NGN" : null, offline_support: offline, contains_ads: ads, has_in_app_purchases: iap, status: "submitted" }).select("id,title,slug,genre,status,reviewed_at,rejection_reason,short_description,monetization_type,price_minor,currency,created_at,supported_platforms,supported_languages,age_rating,offline_support,contains_ads,has_in_app_purchases").single();
    if (error || !data) { setBusy(false); setNotice(error?.message || "The game listing could not be created."); return; }
    const { error: detailsError } = await supabase.from("game_platform_details").upsert(fitInput.platformDetails.map((detail) => ({ ...detail, game_id: data.id })), { onConflict: "game_id,platform" });
    setBusy(false);
    setGames((old) => [{ ...(data as GameRow), game_platform_details: fitInput.platformDetails }, ...old]); setSection("games");
    setNotice(detailsError ? "Listing created, but GAME FIT details could not be saved: " + detailsError.message : "Your game listing and GAME FIT details were submitted for review.");
  }

  async function saveGameEdits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!studio || !editingGame) return;
    const action = getSubmissionAction(event);
    const saveDraftOnly = editingGame.status === "draft" && action === "draft";
    setBusy(true); setNotice("");
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    const genre = String(form.get("genre") || "");
    const description = String(form.get("description") || "").trim();
    const platforms = form.getAll("platforms").map(String);
    const monetization = String(form.get("monetization") || "free");
    if (title.length < 2 || title.length > 100) { setBusy(false); setNotice("Enter a game title between 2 and 100 characters."); return; }
    const fitInput = readGameFitInputs(form, platforms, !saveDraftOnly);
    if (fitInput.error || (!saveDraftOnly && !fitInput.platformDetails.length)) { setBusy(false); setNotice(fitInput.error || "Check the GAME FIT information for each selected platform."); return; }
    const offline = fitInput.platformDetails.some((detail) => detail.internet_requirement === "offline" || detail.internet_requirement === "both");
    const ads = form.get("ads") === "on";
    const iap = form.get("iap") === "on";
    const priceInput = String(form.get("priceNaira") || "").trim();
    const priceNaira = priceInput ? Number(priceInput) : 0;
    const validPrice = Number.isFinite(priceNaira) && priceNaira > 0 && Number.isSafeInteger(Math.round(priceNaira * 100));
    if (!saveDraftOnly && monetization === "paid" && !validPrice) { setBusy(false); setNotice("Enter a valid NGN price greater than zero for a paid game."); return; }
    const priceMinor = monetization === "paid" && validPrice ? Math.round(priceNaira * 100) : null;
    if (studio.demo || !supabase) {
      const nextStatus = editingGame.status === "rejected" || (editingGame.status === "draft" && !saveDraftOnly) ? "submitted" : editingGame.status;
      setGames((old) => old.map((game) => game.id === editingGame.id ? { ...game, title, genre, status: nextStatus, short_description: description, updated_at: new Date().toISOString(), supported_languages: fitInput.supportedLanguages, age_rating: fitInput.ageRating, supported_platforms: platforms, game_platform_details: fitInput.platformDetails, monetization_type: monetization, price_minor: priceMinor, offline_support: offline, contains_ads: ads, has_in_app_purchases: iap } : game));
      setNotice(saveDraftOnly ? "Draft saved on this device." : nextStatus === "submitted" ? "Draft or rejected listing sent back for review in this local demo." : "Demo listing updated on this device."); setEditingGame(null); setSection("games"); setBusy(false); return;
    }
    const { error } = await supabase.from("games").update({ title, genre, short_description: description, description, supported_platforms: platforms, supported_languages: fitInput.supportedLanguages, age_rating: fitInput.ageRating, monetization_type: monetization, price_minor: priceMinor, currency: priceMinor === null ? null : "NGN", offline_support: offline, contains_ads: ads, has_in_app_purchases: iap, updated_at: new Date().toISOString() }).eq("id", editingGame.id).eq("studio_id", studio.id);
    if (error) { setBusy(false); setNotice(error.message); return; }
    if (fitInput.platformDetails.length) {
      const { error: detailsError } = await supabase.from("game_platform_details").upsert(fitInput.platformDetails.map((detail) => ({ ...detail, game_id: editingGame.id })), { onConflict: "game_id,platform" });
      if (detailsError) { setBusy(false); setNotice("Listing updated, but GAME FIT details could not be saved: " + detailsError.message); return; }
    }
    const removedPlatforms = GAME_PLATFORMS.map((item) => item.value).filter((platform) => !platforms.includes(platform));
    if (removedPlatforms.length) {
      const { error: deleteDetailsError } = await supabase.from("game_platform_details").delete().eq("game_id", editingGame.id).in("platform", removedPlatforms);
      if (deleteDetailsError) { setBusy(false); setNotice("Listing saved, but old platform details could not be removed: " + deleteDetailsError.message); return; }
    }
    if (editingGame.status === "rejected") {
      const resubmit = await supabase.rpc("resubmit_game", { p_game_id: editingGame.id });
      if (resubmit.error) { setBusy(false); setNotice("Changes saved, but resubmission failed: " + resubmit.error.message); return; }
    } else if (editingGame.status === "draft" && !saveDraftOnly) {
      const submission = await supabase.rpc("submit_game_draft", { p_game_id: editingGame.id });
      if (submission.error) { setBusy(false); setNotice("Your changes were saved as a draft, but submission was blocked: " + submission.error.message); return; }
    }
    const { data, error: refreshError } = await supabase.from("games").select("id,title,slug,genre,status,reviewed_at,rejection_reason,created_at,updated_at,short_description,monetization_type,price_minor,currency,supported_platforms,supported_languages,age_rating,offline_support,contains_ads,has_in_app_purchases,game_platform_details(platform,official_access_url,official_access_url_verified_at,download_size_bytes,download_size_verified_at,internet_requirement,internet_requirement_verified_at,minimum_requirements,minimum_requirements_verified_at)").eq("studio_id", studio.id).order("created_at", { ascending: false });
    if (!refreshError && data) setGames(data as GameRow[]);
    setBusy(false); setEditingGame(null); setSection("games");
    setNotice(saveDraftOnly ? "Draft saved privately. Continue editing it from My games whenever you are ready." : editingGame.status === "rejected" ? "Changes saved and listing resubmitted for review." : editingGame.status === "draft" ? "Draft submitted for Game ON review." : "Game listing updated.");
  }

  async function deleteGameDraft(game: GameRow) {
    if (!studio || game.status !== "draft" || deletingDraftId) return;
    const confirmed = window.confirm(`Permanently delete the draft "${game.title}"? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingDraftId(game.id);
    setNotice("");
    try {
      if (studio.demo || !supabase) {
        setGames((old) => old.filter((item) => item.id !== game.id));
        setNotice(`Draft "${game.title}" deleted from this device.`);
        return;
      }

      const { data, error } = await supabase
        .from("games")
        .delete()
        .eq("id", game.id)
        .eq("studio_id", studio.id)
        .eq("status", "draft")
        .select("id")
        .maybeSingle();

      if (error || !data) {
        setNotice(error?.message || "This listing is no longer a draft, or it could not be deleted.");
        return;
      }

      setGames((old) => old.filter((item) => item.id !== game.id));
      setNotice(`Draft "${game.title}" deleted.`);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "The draft could not be deleted. Check your connection and try again.");
    } finally {
      setDeletingDraftId(null);
    }
  }

  function beginEdit(game: GameRow) {
    if (game.status === "published") { setNotice("Published listings are locked for editing in this early release. Contact Game ON support for a listing change."); return; }
    setEditingGame(game); setFormReadiness(getDraftProgress(game)); const selectedPlatforms = (game.supported_platforms || []).filter((platform) => GAME_PLATFORMS.some((item) => item.value === platform)); setEditingPlatforms(game.status === "draft" ? selectedPlatforms : selectedPlatforms.length ? selectedPlatforms : ["android"]); setSection("edit"); setNotice("");
  }

  function handleListingFormChange(form: HTMLFormElement) {
    setFormReadiness(getListingFormReadiness(form));
  }

  async function signOut() {
    if (supabase && user && !user.demo) await supabase.auth.signOut();
    if (!supabase) { localStorage.removeItem("goc-demo-user"); localStorage.removeItem("goc-demo-studio"); }
    setUser(null); setStudio(null); setNotice("Signed out.");
  }

  const published = games.filter((g) => g.status === "published").length;
  const inReview = games.filter((g) => g.status === "submitted" || g.status === "in_review").length;
  const draftGames = games.filter((game) => game.status === "draft");
  const draft = draftGames.length;
  const readyDrafts = draftGames.filter((game) => getDraftProgress(game).ready).length;
  const visibleDraftGames = draftGames.filter((game) => { const query = draftSearch.trim().toLowerCase(); return !query || [game.title, game.genre, game.slug, ...(game.supported_platforms || [])].some((value) => String(value || "").toLowerCase().includes(query)); }).sort((left, right) => {
    const leftSaved = Date.parse(left.updated_at || left.created_at || "") || 0;
    const rightSaved = Date.parse(right.updated_at || right.created_at || "") || 0;
    if (draftSort === "oldest") return leftSaved - rightSaved;
    if (draftSort === "title") return left.title.localeCompare(right.title);
    if (draftSort === "most-complete") return getDraftProgress(right).percent - getDraftProgress(left).percent || rightSaved - leftSaved;
    if (draftSort === "least-complete") return getDraftProgress(left).percent - getDraftProgress(right).percent || rightSaved - leftSaved;
    return rightSaved - leftSaved;
  });
  const nav: { id: Section; label: string; icon: string }[] = [{ id: "overview", label: "Overview", icon: "▦" }, { id: "games", label: "My games", icon: "▣" }, { id: "drafts", label: "Drafts", icon: "✎" }, { id: "submit", label: "Submit a game", icon: "+" }, { id: "builds", label: "Game builds", icon: "⇧" }, { id: "analytics", label: "Analytics", icon: "⌁" }, { id: "sales", label: "Sales & earnings", icon: "₦" }, { id: "notifications", label: "Notifications", icon: "♢" }, { id: "settings", label: "Studio settings", icon: "⚙" }];

  if (!user) return <main className="creator-auth-screen"><div className="auth-visual"><div className="visual-glow"/><img src="/game-on-logo.jpg" alt="Game ON company logo"/><p className="eyebrow">BUILT FOR THE PEOPLE WHO BUILD GAMES</p><h1>Your game.<br/><em>Your audience.</em></h1><p className="auth-tagline">Publish with clarity. Understand your players. Grow on Game ON.</p><div className="auth-footnote">GAME ON CREATOR · DEVELOPER PORTAL</div></div><section className="auth-panel"><div className="auth-form-wrap"><div className="small-brand"><span className="brand-square">G</span><span>GAME ON <b>CREATOR</b></span></div><p className="eyebrow">DEVELOPER ACCESS</p><h2>{authMode === "signup" ? "Create your account" : "Welcome back"}</h2><p className="auth-help">Access your publishing workspace and manage your game listings.</p><form onSubmit={handleAuth}><label>Email address<input name="email" type="email" placeholder="you@studio.com" required autoComplete="email"/></label><label>Password<input name="password" type="password" placeholder="At least 8 characters" required minLength={8} autoComplete={authMode === "signup" ? "new-password" : "current-password"}/></label>{authMessage && <p className="error-message">{authMessage}</p>}<button className="creator-primary" disabled={busy}>{busy ? "Please wait…" : authMode === "signup" ? "Create developer account" : "Sign in to Creator"}</button></form><a className="forgot-password-link" href="/forgot-password">Forgot your password?</a><p className="auth-switch">{authMode === "signup" ? "Already registered?" : "New to Game ON Creator?"} <button onClick={() => { setAuthMode(authMode === "signup" ? "signin" : "signup"); setAuthMessage(""); }}>{authMode === "signup" ? "Sign in" : "Create account"}</button></p>{!isSupabaseConfigured && <p className="demo-banner">DEMO MODE · No password is saved. Connect Supabase to create real developer accounts.</p>}<a className="back-store" href={process.env.NEXT_PUBLIC_STORE_URL || "http://localhost:3000"}>← Back to Game ON Store</a></div></section></main>;

  if (studioLoading || studioProfileLoading) return <main className="studio-onboarding"><header className="onboarding-top"><div className="small-brand"><span className="brand-square">G</span><span>GAME ON <b>CREATOR</b></span></div></header><section className="onboarding-card"><div className="onboarding-symbol">✦</div><p className="eyebrow">CREATOR WORKSPACE</p><h1>Preparing your studio.</h1><p className="auth-help">We’re loading your company profile and setup progress.</p></section></main>;

  if (!studio || !studioProfile) return <StudioOnboardingWizard
    initialStudio={studio}
    initialProfile={studioProfile}
    userEmail={user.email}
    busy={busy}
    error={setupError}
    onSave={finishStudioSetup}
    onSignOut={signOut}
  />;

  return <main className="creator-app"><aside className="creator-sidebar"><div className="sidebar-brand"><img src={studio.logo_url || "/game-on-logo.jpg"} alt={studio.studio_name + " logo"}/><div><b>GAME ON</b><span>CREATOR</span></div></div><div className="studio-switch"><span className="studio-avatar">{studio.studio_name.slice(0, 1).toUpperCase()}</span><div><b>{studio.studio_name}</b><small>{studio.verification_status === "verified" ? "Verified studio" : "Verification pending"}</small></div><span className="switch-chevron">⌄</span></div><p className="side-label">WORKSPACE</p><nav className="side-nav">{nav.map((item) => <button key={item.id} className={section === item.id ? "selected" : ""} onClick={() => setSection(item.id)}><span className="nav-icon">{item.icon}</span>{item.label}{item.id === "drafts" && draft > 0 && <span className="nav-count">{draft}</span>}{item.id === "submit" && <span className="nav-new">NEW</span>}</button>)}</nav><div className="sidebar-bottom"><div className="help-card"><b>Need a hand?</b><p>Get help with your game submission or studio account.</p><button onClick={() => setNotice("Support centre will be available in a future release.")}>Visit support ↗</button></div><div className="sidebar-user"><span className="user-avatar">{(user.email || "D").slice(0, 1).toUpperCase()}</span><div><b>{studioProfile.contact_name || user.email?.split("@")[0] || "Developer"}</b><small>{user.email || "Demo account"}</small></div><button onClick={signOut} aria-label="Sign out">↗</button></div></div></aside>
    <section className="creator-main"><header className="creator-topbar"><div><span className="breadcrumb">CREATOR PORTAL</span><span className="crumb-divider">/</span><b>{nav.find((n) => n.id === section)?.label.toUpperCase()}</b></div><div className="topbar-right"><span className="secure-label"><i/> {isSupabaseConfigured ? "CONNECTED ENVIRONMENT" : "DEMO ENVIRONMENT"}</span><a className="admin-shortcut" href="/admin">Admin review ↗</a><button className="top-avatar" onClick={signOut}>{(user.email || "D").slice(0, 1).toUpperCase()}</button></div></header>
      <div className="creator-page">
        {notice && <button className="notice-banner" onClick={() => setNotice("")}>{notice}<span>×</span></button>}
        {section === "overview" && <><div className="page-intro"><div><p className="eyebrow">YOUR STUDIO AT A GLANCE</p><h1>Good to see you.</h1><p>Here is what's happening with {studio.studio_name}.</p></div><button className="creator-primary compact" onClick={() => setSection("submit")}>＋ Submit a game</button></div><div className="stat-grid"><div className="stat-card"><span className="stat-icon cyan">▣</span><small>TOTAL LISTINGS</small><b>{games.length}</b><em>Across your studio</em></div><div className="stat-card"><span className="stat-icon green">↗</span><small>PUBLISHED GAMES</small><b>{published}</b><em>Visible in the store</em></div><div className="stat-card"><span className="stat-icon amber">◷</span><small>IN REVIEW</small><b>{inReview}</b><em>Waiting for review</em></div><div className="stat-card"><span className="stat-icon violet">✎</span><small>DRAFTS</small><b>{draft}</b><em>Not yet submitted</em></div></div><div className="dashboard-grid"><section className="surface-card recent-card"><div className="surface-heading"><div><h2>Recent games</h2><p>Your latest listings and their status.</p></div><button className="plain-link" onClick={() => setSection("games")}>View all →</button></div><GameTable games={games.slice(0, 4)} onEdit={beginEdit} onDeleteDraft={deleteGameDraft} deletingDraftId={deletingDraftId}/></section><section className="surface-card getting-started"><p className="eyebrow">CREATOR CHECKLIST</p><h2>Build your presence.</h2><p>Complete these steps to prepare your studio for publishing.</p><div className="check-step done"><span>✓</span><div><b>Create your studio</b><small>Studio workspace created</small></div></div><div className="check-step"><span>2</span><div><b>Submit your first game</b><small>Add your store listing details</small></div></div><div className="check-step"><span>3</span><div><b>Complete studio verification</b><small>Confirm your studio identity</small></div></div><div className="check-step"><span>4</span><div><b>Prepare a secure game build</b><small>Upload through the private quarantine workflow</small></div></div><button className="creator-outline" onClick={() => setSection("builds")}>Manage game builds →</button></section></div></>}
        {section === "drafts" && <><div className="page-intro"><div><p className="eyebrow">PRIVATE WORKSPACE</p><h1>Drafts workspace.</h1><p>Find unfinished listings, see what is left, and pick up where you stopped. Drafts are private and are not visible in GAME ON Store.</p></div><button className="creator-primary compact" onClick={() => setSection("submit")}>＋ New draft</button></div>
          <div className="draft-summary-grid"><div className="draft-summary-card"><small>ALL DRAFTS</small><b>{draft}</b><span>Saved in this studio</span></div><div className="draft-summary-card"><small>READY TO SUBMIT</small><b>{readyDrafts}</b><span>Required listing details are in place</span></div><div className="draft-summary-card"><small>STILL IN PROGRESS</small><b>{draft - readyDrafts}</b><span>Have at least one step left</span></div></div>
          <section className="surface-card drafts-workspace"><div className="draft-toolbar"><label className="draft-search-wrap"><span>SEARCH DRAFTS</span><input type="search" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} placeholder="Search title, genre, slug or platform…" aria-label="Search drafts"/></label><label className="draft-sort-wrap"><span>SORT BY</span><select value={draftSort} onChange={(event) => setDraftSort(event.target.value as typeof draftSort)} aria-label="Sort drafts"><option value="recent">Recently saved</option><option value="oldest">Oldest saved</option><option value="title">Title A–Z</option><option value="most-complete">Most complete</option><option value="least-complete">Least complete</option></select></label></div>
            {draft === 0 ? <div className="draft-empty"><span>✎</span><h2>No drafts yet</h2><p>Save a game listing as a draft and it will stay here until you are ready to submit it.</p><button className="creator-primary compact" onClick={() => setSection("submit")}>Create your first draft →</button></div> : visibleDraftGames.length === 0 ? <div className="draft-empty"><span>⌕</span><h2>No matching drafts</h2><p>Try a different search term, or clear your search to see all saved drafts.</p><button className="creator-outline" onClick={() => setDraftSearch("")}>Clear search</button></div> : <div className="draft-card-grid">{visibleDraftGames.map((game) => { const progress = getDraftProgress(game); const platforms = (game.supported_platforms || []).map((platform) => GAME_PLATFORMS.find((item) => item.value === platform)?.label || platform).join(" · "); const saved = game.updated_at || game.created_at; return <article className="draft-workspace-card" key={game.id}>
              <div className="draft-card-heading"><div className="draft-game-title"><span className="mini-game-icon">🎮</span><div><h2>{game.title}</h2><p>{game.genre || "Genre not selected"}{platforms ? " · " + platforms : " · Platform not selected"}</p></div></div><span className={progress.ready ? "draft-ready-tag" : "draft-progress-tag"}>{progress.ready ? "Ready to submit" : "In progress"}</span></div>
              <div className="draft-progress-area"><div className="draft-progress-meta"><span>Submission readiness</span><b>{progress.percent}%</b></div><div className="draft-progress-track" role="progressbar" aria-label={"Submission readiness for " + game.title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}><span style={{ width: progress.percent + "%" }}/></div><small>{progress.completed} of {progress.total} required steps complete</small></div>
              <div className="draft-next-step"><span>{progress.ready ? "STATUS" : "NEXT STEP"}</span><b>{progress.nextStep}</b></div>
              <div className="draft-card-footer"><small>{saved ? "Last saved " + new Date(saved).toLocaleString() : "Saved draft"}</small><div><button className="draft-continue-button" onClick={() => beginEdit(game)}>Continue editing →</button><button className="draft-delete-button" onClick={() => deleteGameDraft(game)} disabled={Boolean(deletingDraftId)}>{deletingDraftId === game.id ? "Deleting…" : "Delete draft"}</button></div></div>
            </article>; })}</div>}
          </section></>}
        {section === "games" && <><div className="page-intro"><div><p className="eyebrow">YOUR CATALOGUE</p><h1>My games</h1><p>Manage your studio's game listings and review status.</p></div><button className="creator-primary compact" onClick={() => setSection("submit")}>＋ Submit a game</button></div><section className="surface-card full-card"><div className="surface-heading"><div><h2>All listings</h2><p>{games.length} game listings in your studio</p></div></div>
          <div className="review-status-guide" aria-label="Game listing status guide">
            <div><b>Submitted</b><span>Waiting for the Game ON review queue.</span></div>
            <div><b>In review</b><span>Game ON is checking the listing. Editing is locked until the review finishes.</span></div>
            <div><b>Rejected</b><span>Read the reason, make changes and resubmit.</span></div>
            <div><b>Published</b><span>Approved and visible in the separate GAME ON Store.</span></div>
          </div>
          <GameTable games={games} onEdit={beginEdit} onDeleteDraft={deleteGameDraft} deletingDraftId={deletingDraftId}/></section></>}
        {section === "submit" && <><div className="page-intro"><div><p className="eyebrow">PUBLISH ON GAME ON</p><h1>Submit a game.</h1><p>Create the store listing. Game builds and downloads are handled separately after security review is ready.</p></div></div><form className="surface-card submit-form" onSubmit={submitGame} onChange={(event) => handleListingFormChange(event.currentTarget)}><div className="form-section-heading"><b>GAME INFORMATION</b><span>STEP 1 OF 2</span></div><div className="form-two"><label>Game title<input name="title" placeholder="Enter your game title" required maxLength={100}/></label><label>Genre<select name="genre" required defaultValue=""><option value="" disabled>Select a genre</option>{["Action","Adventure","Arcade","Casual","Educational","Puzzle","Racing","Role-playing","Simulation","Sports","Strategy"].map((g) => <option key={g}>{g}</option>)}</select></label></div><label>Short description<textarea name="description" rows={4} maxLength={180} required placeholder="Describe your game in 180 characters or fewer."/></label><div className="form-section-heading separated"><b>PLATFORM & MONETIZATION</b><span>STORE DISCLOSURES</span></div><div className="platform-selection"><b>Where can players play this game?</b><p>Select every platform this same game supports. You will enter separate GAME FIT facts for each selected platform.</p><div className="checkbox-grid">{GAME_PLATFORMS.map((platform) => <label key={platform.value}><input type="checkbox" name="platforms" value={platform.value} checked={submitPlatforms.includes(platform.value)} onChange={(event) => setSubmitPlatforms((old) => event.target.checked ? [...old, platform.value] : old.filter((item) => item !== platform.value))}/>{platform.label}</label>)}</div></div>
      <div className="form-two"><label>Monetization<select name="monetization" defaultValue="free"><option value="free">Free</option><option value="paid">Paid</option><option value="free_with_ads">Free with ads</option><option value="free_with_iap">Free with in-app purchases</option><option value="demo">Free demo</option></select></label><label>Price in NGN<input name="priceNaira" type="number" min="0.01" max="1000000" step="0.01" placeholder="e.g. 2500.00"/><small>Required only when monetization is set to Paid. Enter the full NGN amount, not kobo.</small></label></div><div className="form-section-heading separated"><b>SHARED GAME INFORMATION</b><span>USED ACROSS PLATFORMS</span></div><div className="form-two"><label>Age rating / content guidance<input name="ageRating" maxLength={60} placeholder="e.g. PEGI 12, ESRB Teen"/></label><label>Supported languages<input name="supportedLanguages" maxLength={500} placeholder="English, Yoruba, French"/><small>Separate languages with commas.</small></label></div>{GAME_PLATFORMS.map((platform) => <div key={platform.value} hidden={!submitPlatforms.includes(platform.value)}><PlatformGameFitFields platform={platform.value}/></div>)}
        <div className="checkbox-grid"><label><input type="checkbox" name="ads"/> Contains advertising</label><label><input type="checkbox" name="iap"/> Contains in-app purchases</label></div><ListingReadinessPanel progress={formReadiness}/><div className="submission-note"><b>Before you submit</b><p>This creates a listing record for review. After submission, use the Builds section to upload an APK, AAB, EXE, MSI or ZIP package. Uploads remain private until a trusted malware scanner and Game ON release review both approve them. Your studio must be verified before uploads are enabled.</p></div><div className="form-actions"><button type="button" className="creator-outline" onClick={() => setSection("games")}>Cancel</button><button type="submit" className="creator-outline" name="submissionAction" value="draft" formNoValidate disabled={busy}>{busy ? "Saving…" : "Save as draft"}</button><button type="submit" className="creator-primary" name="submissionAction" value="submit" disabled={busy}>{busy ? "Submitting…" : "Submit listing for review →"}</button></div></form></>}
        {section === "edit" && editingGame && <><div className="page-intro"><div><p className="eyebrow">UPDATE YOUR LISTING</p><h1>Edit game.</h1><p>{editingGame.status === "draft" ? "Save your work privately and return later, or complete every required field to send it for review." : "Make changes to your listing. Rejected listings can be sent back for review after you save."}</p></div></div><form className="surface-card submit-form" onSubmit={saveGameEdits} onChange={(event) => handleListingFormChange(event.currentTarget)}><div className="form-section-heading"><b>GAME INFORMATION</b><span>{editingGame.status.replace("_", " ").toUpperCase()}</span></div><div className="form-two"><label>Game title<input name="title" defaultValue={editingGame.title} required maxLength={100}/></label><label>Genre<select name="genre" defaultValue={editingGame.genre || ""} required><option value="" disabled>Select a genre</option>{["Action","Adventure","Arcade","Casual","Educational","Puzzle","Racing","Role-playing","Simulation","Sports","Strategy"].map((g) => <option key={g}>{g}</option>)}</select></label></div><label>Short description<textarea name="description" rows={4} maxLength={180} required defaultValue={editingGame.short_description || ""}/></label><div className="platform-selection"><b>Supported platforms</b><p>Choose every platform this game supports. Each selected platform has its own GAME FIT details.</p><div className="checkbox-grid">{GAME_PLATFORMS.map((platform) => <label key={platform.value}><input type="checkbox" name="platforms" value={platform.value} checked={editingPlatforms.includes(platform.value)} onChange={(event) => setEditingPlatforms((old) => event.target.checked ? [...old, platform.value] : old.filter((item) => item !== platform.value))}/>{platform.label}</label>)}</div></div>
      <div className="form-two"><label>Monetization<select name="monetization" defaultValue={editingGame.monetization_type || "free"}><option value="free">Free</option><option value="paid">Paid</option><option value="free_with_ads">Free with ads</option><option value="free_with_iap">Free with in-app purchases</option><option value="demo">Free demo</option></select></label><label>Price in NGN<input name="priceNaira" type="number" min="0.01" max="1000000" step="0.01" defaultValue={editingGame.price_minor ? (editingGame.price_minor / 100).toFixed(2) : ""} placeholder="e.g. 2500.00"/><small>Required only when monetization is set to Paid. Enter the full NGN amount, not kobo.</small></label></div>
      <div className="form-section-heading separated"><b>SHARED GAME INFORMATION</b><span>USED ACROSS PLATFORMS</span></div><div className="form-two"><label>Age rating / content guidance<input name="ageRating" maxLength={60} defaultValue={editingGame.age_rating || ""} placeholder="e.g. PEGI 12, ESRB Teen"/></label><label>Supported languages<input name="supportedLanguages" maxLength={500} defaultValue={(editingGame.supported_languages || []).join(", ")} placeholder="English, Yoruba, French"/><small>Separate languages with commas.</small></label></div>
      {GAME_PLATFORMS.map((platform) => <div key={platform.value} hidden={!editingPlatforms.includes(platform.value)}><PlatformGameFitFields platform={platform.value} detail={editingGame.game_platform_details?.find((detail) => detail.platform === platform.value) || null}/></div>)}<ListingReadinessPanel progress={formReadiness}/><div className="submission-note"><b>Review status protection</b><p>{editingGame.status === "draft" ? "Drafts stay private and are not visible in GAME ON Store. Saving preserves the draft. Submitting checks the required listing details and sends it to Game ON for review." : "Saving changes will not publish your game. If the listing was rejected, the app will call the secure resubmission function to return it to the review queue."}</p></div><div className="form-actions"><button type="button" className="creator-outline" onClick={() => { setEditingGame(null); setSection("games"); }}>Cancel</button>{editingGame.status === "draft" ? <><button type="submit" className="creator-outline" name="submissionAction" value="draft" formNoValidate disabled={busy}>{busy ? "Saving…" : "Save draft"}</button><button type="submit" className="creator-primary" name="submissionAction" value="submit" disabled={busy}>{busy ? "Submitting…" : "Submit draft for review →"}</button></> : <button type="submit" className="creator-primary" disabled={busy}>{busy ? "Saving…" : editingGame.status === "rejected" ? "Save and resubmit →" : "Save changes →"}</button>}</div></form></>}
        {section === "builds" && <BuildManager studioVerified={studio?.verification_status === "verified"} scannerEnabled={scannerEnabled} games={games.map((game) => ({ id: game.id, title: game.title, status: game.status, supported_platforms: game.supported_platforms }))}/>}
        {section === "analytics" && <CreatorAnalytics/>}
        {section === "sales" && <CreatorSales/>}
        {section === "notifications" && <CreatorInbox userId={user.id}/>}
        {section === "settings" && <><div className="page-intro"><div><p className="eyebrow">STUDIO PROFILE</p><h1>Studio settings</h1><p>Manage your developer identity and publishing status.</p></div></div><section className="surface-card settings-card"><div className="settings-avatar">{studio.logo_url ? <img src={studio.logo_url} alt={studio.studio_name + " logo"}/> : studio.studio_name.slice(0, 1).toUpperCase()}</div><div><h2>{studio.studio_name}</h2><p className="slug-text">gameon.dev/studios/{studio.slug}</p><span className={`status-pill ${studio.verification_status === "verified" ? "published" : "review"}`}>{studio.verification_status || "pending"} verification</span></div><div className="settings-row"><span>Your name</span><b>{studioProfile.contact_name}</b></div><div className="settings-row"><span>Your company role</span><b>{studioProfile.contact_role}</b></div><div className="settings-row"><span>Official company email</span><b>{studioProfile.official_email}</b></div><div className="settings-row"><span>Account email</span><b>{user.email}</b></div><div className="settings-row"><span>Studio description</span><b>{studio.description || "Not provided"}</b></div><div className="settings-row"><span>Website</span><b>{studio.website_url || "Not provided"}</b></div><div className="settings-row"><span>Environment</span><b>{user.demo ? "Local demo" : "Connected Supabase"}</b></div><div className="settings-row"><button className="plain-link" onClick={() => { setSetupError(""); setStudioProfile(null); setStudioProfileLoading(false); }}>Edit company setup →</button></div></section></>}
      </div>
    </section></main>;
}

function getDraftProgress(game: GameRow) {
  return getListingReadiness({
    title: game.title,
    genre: game.genre,
    description: game.short_description,
    supportedPlatforms: game.supported_platforms || [],
    gameFitPlatforms: (game.game_platform_details || []).map((detail) => detail.platform),
    monetizationType: game.monetization_type,
    priceMinor: game.price_minor,
  });
}

function getNewListingReadiness() {
  return getListingReadiness({
    title: "",
    genre: "",
    description: "",
    supportedPlatforms: ["android"],
    gameFitPlatforms: ["android"],
    monetizationType: "free",
  });
}

function getListingFormReadiness(form: HTMLFormElement): ListingReadiness {
  const values = new FormData(form);
  const supportedPlatforms = values.getAll("platforms").map(String);
  const parsedGameFit = readGameFitInputs(values, supportedPlatforms, false);
  const rawPrice = String(values.get("priceNaira") || "").trim();
  const price = rawPrice ? Number(rawPrice) : 0;
  const priceMinor = Number.isFinite(price) && price > 0 && Number.isSafeInteger(Math.round(price * 100))
    ? Math.round(price * 100)
    : null;

  return getListingReadiness({
    title: String(values.get("title") || ""),
    genre: String(values.get("genre") || ""),
    description: String(values.get("description") || ""),
    supportedPlatforms,
    gameFitPlatforms: parsedGameFit.error ? [] : parsedGameFit.platformDetails.map((detail) => detail.platform),
    monetizationType: String(values.get("monetization") || "free"),
    priceMinor,
  });
}

function ListingReadinessPanel({ progress }: { progress: ListingReadiness }) {
  return <section className="listing-readiness-panel" aria-label="Live submission readiness">
    <div className="listing-readiness-heading">
      <div><b>LIVE SUBMISSION CHECKLIST</b><small>Updates as you complete the listing.</small></div>
      <strong>{progress.percent}%</strong>
    </div>
    <div className="draft-progress-track" role="progressbar" aria-label="Submission readiness" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}>
      <span style={{ width: progress.percent + "%" }}/>
    </div>
    <ul className="listing-readiness-checks">
      {progress.checks.map((check) => <li key={check.label} className={check.complete ? "complete" : ""}>
        <span aria-hidden="true">{check.complete ? "✓" : "○"}</span><span>{check.label}</span>
      </li>)}
    </ul>
    <p className="listing-readiness-next">{progress.ready ? "All required listing details are in place." : "Next step: " + progress.nextStep}</p>
    <small className="listing-readiness-disclaimer">This is a guide. The database performs the final submission check.</small>
  </section>;
}

function gameReviewStatus(status: string) {
  const labels: Record<string, { label: string; detail: string; tone: string }> = {
    draft: { label: "Draft", detail: "Not submitted to Game ON yet.", tone: "draft" },
    submitted: { label: "Submitted", detail: "Waiting for the Game ON review queue.", tone: "review" },
    in_review: { label: "In review", detail: "Game ON is checking this listing.", tone: "review" },
    rejected: { label: "Changes requested", detail: "Update the listing and resubmit it for review.", tone: "rejected" },
    published: { label: "Published", detail: "Approved and visible in GAME ON Store.", tone: "published" },
  };
  return labels[status] || { label: status.replaceAll("_", " "), detail: "Contact Game ON support if you need help with this status.", tone: "draft" };
}

function GameTable({ games, onEdit, onDeleteDraft, deletingDraftId }: { games: GameRow[]; onEdit: (game: GameRow) => void; onDeleteDraft?: (game: GameRow) => void; deletingDraftId?: string | null }) {
  if (!games.length) return <div className="table-empty"><span>▣</span><b>No game listings yet</b><p>Your saved drafts and submitted games will appear here.</p></div>;
  return <div className="table-wrap"><table className="games-table"><thead><tr><th>GAME</th><th>GENRE</th><th>STATUS & NEXT STEP</th><th>ACTION</th></tr></thead><tbody>{games.map((game) => {
    const status = gameReviewStatus(game.status);
    const canEdit = ["draft", "submitted", "rejected"].includes(game.status);
    const actionLabel = game.status === "published" ? "Published" : game.status === "in_review" ? "Locked during review" : game.status === "rejected" ? "Edit & resubmit →" : game.status === "draft" ? "Continue editing →" : "Edit listing →";
    return <tr key={game.id}>
      <td><div className="table-game"><span className="mini-game-icon">🎮</span><div><b>{game.title}</b><small>{game.slug}</small></div></div></td>
      <td>{game.genre || "—"}</td>
      <td><div className="listing-status-cell"><span className={`status-pill ${status.tone}`}>{status.label}</span><small>{status.detail}</small>
        {game.status === "rejected" && game.rejection_reason && <div className="game-rejection-note"><b>Reason from Game ON review</b><p>{game.rejection_reason}</p></div>}
        {game.reviewed_at && <small>Last reviewed {new Date(game.reviewed_at).toLocaleDateString()}</small>}{game.status === "draft" && game.updated_at && <small>Last saved {new Date(game.updated_at).toLocaleString()}</small>}
      </div></td>
      <td><div className="game-row-actions"><button className="row-menu" onClick={() => onEdit(game)} disabled={!canEdit || Boolean(deletingDraftId)} aria-label={`${actionLabel} for ${game.title}`}>{actionLabel}</button>{game.status === "draft" && onDeleteDraft && <button className="draft-delete-button" onClick={() => onDeleteDraft(game)} disabled={Boolean(deletingDraftId)} aria-label={`Delete draft ${game.title}`}>{deletingDraftId === game.id ? "Deleting…" : "Delete draft"}</button>}</div></td>
    </tr>;
  })}</tbody></table></div>;
}
