import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { creatorApiUrl, isSupabaseConfigured, supabase } from "./src/lib/supabase";

type Account = { id: string; email?: string; demo?: boolean };
type Studio = {
  id: string;
  studio_name: string;
  slug: string;
  description?: string | null;
  website_url?: string | null;
  verification_status?: string;
  demo?: boolean;
};
type GameRow = {
  id: string;
  title: string;
  slug: string;
  genre: string;
  status: string;
  short_description: string;
  monetization_type: string;
  created_at?: string;
  price_minor?: number | null;
  currency?: string | null;
  supported_platforms?: string[];
  cover_image_url?: string | null;
  rejection_reason?: string | null;
};
type BuildRow = {
  id: string;
  game_title: string;
  version_label: string;
  platform: string;
  file_size_bytes: number;
  upload_status: string;
  scan_status: string;
  release_status: string;
  created_at: string;
};

type Section = "overview" | "games" | "submit" | "builds" | "analytics" | "sales" | "notifications" | "studio";
type PickedBuild = { uri: string; name: string; size: number };
type PickedCover = { uri: string; name: string; size: number; mimeType: "image/jpeg" | "image/png" | "image/webp"; extension: "jpg" | "jpeg" | "png" | "webp" };
type AnalyticsRow = {
  game_id: string; game_title: string; game_status: string;
  download_link_issues: number; latest_download_link_at: string | null;
  approved_builds: number; latest_approved_version: string | null;
};
type SalesRow = {
  game_id: string; game_title: string; paid_orders: number;
  gross_sales_minor: number; platform_fees_minor: number;
  developer_net_minor: number; latest_sale_at: string | null;
};
type CreatorNotification = {
  id: string; title: string; message: string; notification_type: string;
  read_at: string | null; created_at: string;
};
type AuthMode = "signup" | "signin";

const USER_KEY = "gameon.creator.demo.user.v1";
const STUDIO_KEY = "gameon.creator.demo.studio.v1";
const GAMES_KEY = "gameon.creator.demo.games.v1";
const DEMO_GAMES: GameRow[] = [
  {
    id: "demo-001",
    title: "Neon Drift",
    slug: "neon-drift",
    genre: "Racing",
    status: "published",
    short_description: "High-speed racing through a neon city.",
    monetization_type: "free"
  },
  {
    id: "demo-002",
    title: "Emberfall",
    slug: "emberfall",
    genre: "Adventure",
    status: "in_review",
    short_description: "Explore ancient ruins in a story-rich world.",
    monetization_type: "demo"
  },
  {
    id: "demo-003",
    title: "Orbit Keepers",
    slug: "orbit-keepers",
    genre: "Strategy",
    status: "draft",
    short_description: "Build and defend a frontier space outpost.",
    monetization_type: "free"
  }
];

function makeSlug(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function statusLabel(value: string): string {
  return value.replaceAll("_", " ").toUpperCase();
}

function money(minor: number | null | undefined, currency = "NGN"): string {
  if (minor == null) return "Free";
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(minor / 100);
  } catch {
    return currency + " " + (minor / 100).toFixed(2);
  }
}

function ActionButton({
  label,
  onPress,
  secondary = false,
  disabled = false,
  busy = false
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        secondary && styles.secondaryButton,
        (disabled || busy) && styles.disabledButton,
        pressed && styles.pressed
      ]}
    >
      {busy ? <ActivityIndicator color={secondary ? "#bceff6" : "#06111e"} /> : (
        <Text style={[styles.actionButtonText, secondary && styles.secondaryButtonText]}>{label}</Text>
      )}
    </Pressable>
  );
}

function StatusPill({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const kind = normalized === "published" || normalized === "approved" || normalized === "clean"
    ? styles.statusSuccess
    : normalized === "rejected" || normalized === "failed" || normalized === "suspended"
      ? styles.statusDanger
      : styles.statusPending;
  return <Text style={[styles.statusPill, kind]}>{statusLabel(value)}</Text>;
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [section, setSection] = useState<Section>("overview");
  const [user, setUser] = useState<Account | null>(null);
  const [studio, setStudio] = useState<Studio | null>(null);
  const [games, setGames] = useState<GameRow[]>([]);
  const [builds, setBuilds] = useState<BuildRow[]>([]);
  const [buildsError, setBuildsError] = useState("");
  const [buildsBusy, setBuildsBusy] = useState(false);
  const [analyticsRows, setAnalyticsRows] = useState<AnalyticsRow[]>([]);
  const [analyticsBusy, setAnalyticsBusy] = useState(false);
  const [analyticsMessage, setAnalyticsMessage] = useState("");
  const [salesRows, setSalesRows] = useState<SalesRow[]>([]);
  const [salesBusy, setSalesBusy] = useState(false);
  const [salesMessage, setSalesMessage] = useState("");
  const [notifications, setNotifications] = useState<CreatorNotification[]>([]);
  const [notificationsBusy, setNotificationsBusy] = useState(false);
  const [notificationsMessage, setNotificationsMessage] = useState("");
  const [selectedBuildGameId, setSelectedBuildGameId] = useState("");
  const [selectedBuildPlatform, setSelectedBuildPlatform] = useState("android");
  const [buildVersion, setBuildVersion] = useState("1.0.0");
  const [pickedBuild, setPickedBuild] = useState<PickedBuild | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);

  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [studioName, setStudioName] = useState("");
  const [studioDescription, setStudioDescription] = useState("");
  const [studioWebsite, setStudioWebsite] = useState("");

  const [gameTitle, setGameTitle] = useState("");
  const [gameDescription, setGameDescription] = useState("");
  const [genre, setGenre] = useState("Adventure");
  const [platform, setPlatform] = useState("android");
  const [monetization, setMonetization] = useState("free");
  const [priceNaira, setPriceNaira] = useState("");
  const [pickedCover, setPickedCover] = useState<PickedCover | null>(null);
  const [editingGameId, setEditingGameId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      try {
        if (!supabase) {
          const [savedUser, savedStudio, savedGames] = await Promise.all([
            AsyncStorage.getItem(USER_KEY),
            AsyncStorage.getItem(STUDIO_KEY),
            AsyncStorage.getItem(GAMES_KEY)
          ]);
          if (!active) return;
          setUser(savedUser ? JSON.parse(savedUser) as Account : null);
          setStudio(savedStudio ? JSON.parse(savedStudio) as Studio : null);
          setGames(savedGames ? JSON.parse(savedGames) as GameRow[] : DEMO_GAMES);
        } else {
          const { data, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
          if (!active) return;
          setUser(data.session?.user ? {
            id: data.session.user.id,
            email: data.session.user.email
          } : null);
        }
      } catch {
        if (active) {
          setGames(DEMO_GAMES);
          setError("Some saved app data could not be restored. You can continue.");
        }
      } finally {
        if (active) {
          setReady(true);
        }
      }
    }
    void bootstrap();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const { data: authState } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? {
        id: session.user.id,
        email: session.user.email
      } : null);
    });
    return () => authState.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!ready || isSupabaseConfigured) return;
    Promise.all([
      user ? AsyncStorage.setItem(USER_KEY, JSON.stringify(user)) : AsyncStorage.removeItem(USER_KEY),
      studio ? AsyncStorage.setItem(STUDIO_KEY, JSON.stringify(studio)) : AsyncStorage.removeItem(STUDIO_KEY),
      AsyncStorage.setItem(GAMES_KEY, JSON.stringify(games))
    ]).catch(() => undefined);
  }, [ready, user, studio, games]);

  useEffect(() => {
    if (!ready || !user || user.demo || !supabase) {
      if (!user) {
        setStudio(null);
        setGames([]);
      }
      return;
    }
    let active = true;
    async function loadStudio() {
      const { data, error: queryError } = await supabase!
        .from("developer_studios")
        .select("id,studio_name,slug,description,website_url,verification_status")
        .eq("owner_user_id", user!.id)
        .maybeSingle();
      if (!active) return;
      if (queryError) setError("Studio could not be loaded: " + queryError.message);
      setStudio(data as Studio | null);
    }
    void loadStudio();
    return () => { active = false; };
  }, [ready, user]);

  useEffect(() => {
    if (!studio || studio.demo || !supabase) return;
    let active = true;
    async function loadGames() {
      const { data, error: queryError } = await supabase!
        .from("games")
        .select("id,title,slug,genre,status,short_description,monetization_type,created_at,price_minor,currency,supported_platforms,cover_image_url,rejection_reason")
        .eq("studio_id", studio!.id)
        .order("created_at", { ascending: false });
      if (!active) return;
      if (queryError) setError("Game listings could not be loaded: " + queryError.message);
      else setGames((data ?? []) as GameRow[]);
    }
    void loadGames();
    return () => { active = false; };
  }, [studio]);

  const published = useMemo(() => games.filter((game) => game.status === "published").length, [games]);
  const inReview = useMemo(() => games.filter((game) => game.status === "submitted" || game.status === "in_review").length, [games]);
  const drafts = useMemo(() => games.filter((game) => game.status === "draft").length, [games]);
  const buildEligibleGames = useMemo(
    () => games.filter((game) => ["draft", "submitted", "rejected"].includes(game.status)),
    [games]
  );
  const selectedBuildGame = buildEligibleGames.find((game) => game.id === selectedBuildGameId) ?? null;
  const editingGame = games.find((game) => game.id === editingGameId) ?? null;
  const buildPlatforms = (selectedBuildGame?.supported_platforms ?? ["android"])
    .filter((value) => ["android", "windows", "web"].includes(value.toLowerCase()));

  useEffect(() => {
    if (!selectedBuildGameId && buildEligibleGames.length) {
      const first = buildEligibleGames[0];
      setSelectedBuildGameId(first.id);
      const firstPlatform = (first.supported_platforms ?? ["android"])
        .find((value) => ["android", "windows", "web"].includes(value.toLowerCase()));
      setSelectedBuildPlatform(firstPlatform ?? "android");
    }
  }, [buildEligibleGames, selectedBuildGameId]);

  async function handleAuth() {
    setError("");
    setNotice("");
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || password.length < 8) {
      setError("Enter a valid email and a password with at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      if (!supabase) {
        setUser({
          id: "demo-user-" + Date.now().toString(),
          email: email.trim(),
          demo: true
        });
        setNotice("Demo account opened on this device. Connect Supabase for a real developer account.");
      } else if (authMode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password
        });
        if (authError) throw authError;
        if (!data.session) {
          setNotice("Check your email to confirm your developer account, then sign in.");
        } else {
          setNotice("Developer account created.");
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });
        if (authError) throw authError;
        setNotice("Signed in successfully.");
      }
      setPassword("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Account sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function createStudio() {
    setError("");
    setNotice("");
    const name = studioName.trim();
    if (name.length < 2 || name.length > 80) {
      setError("Studio name must be between 2 and 80 characters.");
      return;
    }
    setBusy(true);
    try {
      const slug = makeSlug(name);
      if (!user) throw new Error("Sign in before creating a studio.");
      if (user.demo || !supabase) {
        const next: Studio = {
          id: "demo-studio-" + Date.now().toString(),
          studio_name: name,
          slug,
          description: studioDescription.trim(),
          website_url: studioWebsite.trim() || null,
          verification_status: "pending",
          demo: true
        };
        setStudio(next);
        setNotice("Demo studio created on this device.");
      } else {
        const { data, error: insertError } = await supabase
          .from("developer_studios")
          .insert({
            owner_user_id: user.id,
            studio_name: name,
            slug,
            description: studioDescription.trim() || null,
            website_url: studioWebsite.trim() || null
          })
          .select("id,studio_name,slug,description,website_url,verification_status")
          .single();
        if (insertError) throw insertError;
        setStudio(data as Studio);
        setNotice("Studio created. Verification status is pending until Game ON reviews it.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Studio could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function pickCoverImage() {
    setError("");
    if (!supabase || !studio || studio.demo || !user || user.demo) {
      setError("Connect the shared Supabase backend and sign in with a real developer account to upload cover art.");
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({
      type: "image/*",
      copyToCacheDirectory: true,
      multiple: false
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    const extension = asset.name.split(".").pop()?.toLowerCase() ?? "";
    const mimeByExtension: Record<string, PickedCover["mimeType"]> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp"
    };
    if (!(extension in mimeByExtension)) {
      setError("Choose a JPG, PNG or WebP image for the game cover.");
      return;
    }
    const mimeType = mimeByExtension[extension];
    if (asset.mimeType && asset.mimeType !== mimeType) {
      setError("The selected image type does not match its file extension.");
      return;
    }
    const file = new File(asset.uri);
    const size = asset.size ?? file.size;
    if (!size || size < 1 || size > 5 * 1024 * 1024) {
      setError("Game cover images must be between 1 byte and 5 MB.");
      return;
    }
    setPickedCover({
      uri: asset.uri,
      name: asset.name,
      size,
      mimeType,
      extension: extension as PickedCover["extension"]
    });
  }

  function beginEditGame(game: GameRow) {
    if (!["draft", "submitted", "rejected"].includes(game.status)) {
      Alert.alert("Listing locked", "Published games and listings already under active review cannot be edited here.");
      return;
    }
    setEditingGameId(game.id);
    setGameTitle(game.title);
    setGameDescription(game.short_description);
    setGenre(game.genre);
    setPlatform(game.supported_platforms?.[0] ?? "android");
    setMonetization(game.monetization_type);
    setPriceNaira(game.price_minor == null ? "" : String(game.price_minor / 100));
    setPickedCover(null);
    setError("");
    setNotice("");
    setSection("submit");
  }

  function cancelGameEdit() {
    setEditingGameId(null);
    setGameTitle("");
    setGameDescription("");
    setGenre("Adventure");
    setPlatform("android");
    setMonetization("free");
    setPriceNaira("");
    setPickedCover(null);
    setError("");
    setNotice("");
    setSection("games");
  }

  async function submitGame() {
    setError("");
    setNotice("");
    if (!studio) {
      setError("Create your studio before submitting a game.");
      return;
    }
    const title = gameTitle.trim();
    const description = gameDescription.trim();
    if (title.length < 2 || title.length > 100) {
      setError("Game title must be between 2 and 100 characters.");
      return;
    }
    if (description.length < 10 || description.length > 180) {
      setError("Short description must be between 10 and 180 characters.");
      return;
    }
    let priceMinor: number | null = null;
    if (monetization === "paid") {
      const amount = Number(priceNaira);
      if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(Math.round(amount * 100))) {
        setError("Enter a valid NGN price greater than zero for a paid game.");
        return;
      }
      priceMinor = Math.round(amount * 100);
    }
    if (!editingGameId && pickedCover && (!supabase || studio.demo || !user || user.demo)) {
      setError("A real developer account and the shared Supabase backend are required to upload cover art.");
      return;
    }

    setBusy(true);
    let createdGameId: string | null = null;
    let uploadedCoverPath: string | null = null;
    try {
      const slug = makeSlug(title) + "-" + Date.now().toString(36);
      if (editingGameId) {
        const current = games.find((game) => game.id === editingGameId);
        if (!current || !["draft", "submitted", "rejected"].includes(current.status)) {
          throw new Error("This listing can no longer be edited. Refresh your games and try again.");
        }
        if (studio.demo || !supabase || user?.demo) {
          const updated: GameRow = {
            ...current,
            title,
            short_description: description,
            genre,
            supported_platforms: [platform],
            monetization_type: monetization,
            price_minor: priceMinor,
            currency: priceMinor === null ? null : "NGN"
          };
          setGames((items) => items.map((game) => game.id === editingGameId ? updated : game));
          setNotice("Demo listing updated locally. It has not been sent to Game ON.");
        } else {
          const { data: updated, error: updateError } = await supabase
            .from("games")
            .update({
              title,
              short_description: description,
              description,
              genre,
              supported_platforms: [platform],
              monetization_type: monetization,
              price_minor: priceMinor,
              currency: priceMinor === null ? null : "NGN"
            })
            .eq("id", editingGameId)
            .eq("studio_id", studio.id)
            .select("id,title,slug,genre,status,short_description,monetization_type,created_at,price_minor,currency,supported_platforms,cover_image_url,rejection_reason")
            .single();
          if (updateError) throw updateError;
          let finalGame = updated as GameRow;
          if (current.status === "rejected") {
            const { error: resubmitError } = await supabase.rpc("resubmit_game", { p_game_id: editingGameId });
            if (resubmitError) throw new Error("Your listing details were saved, but resubmission could not be completed: " + resubmitError.message);
            finalGame = { ...finalGame, status: "submitted", rejection_reason: null };
          }
          setGames((items) => items.map((game) => game.id === editingGameId ? finalGame : game));
          setNotice(current.status === "rejected"
            ? "Your changes were saved and the rejected listing was resubmitted for Game ON review."
            : "Your listing changes were saved. Its Game ON review status has not been changed.");
        }
      } else if (studio.demo || !supabase) {
        const row: GameRow = {
          id: "demo-game-" + Date.now().toString(),
          title,
          slug,
          genre,
          status: "submitted",
          short_description: description,
          monetization_type: monetization,
          price_minor: priceMinor,
          currency: priceMinor === null ? null : "NGN",
          supported_platforms: [platform],
          cover_image_url: null
        };
        setGames((current) => [row, ...current]);
        setNotice("Demo listing saved locally. Connect the shared backend to upload a cover image and submit a real listing.");
      } else {
        const { data: draft, error: insertError } = await supabase
          .from("games")
          .insert({
            studio_id: studio.id,
            title,
            slug,
            short_description: description,
            description,
            genre,
            supported_platforms: [platform],
            monetization_type: monetization,
            price_minor: priceMinor,
            currency: priceMinor === null ? null : "NGN",
            status: "draft"
          })
          .select("id,title,slug,genre,status,short_description,monetization_type,created_at,price_minor,currency,supported_platforms,cover_image_url,rejection_reason")
          .single();
        if (insertError) throw insertError;
        createdGameId = draft.id;

        let coverImageUrl: string | null = null;
        if (pickedCover) {
          const imageFile = new File(pickedCover.uri);
          const bytes = await imageFile.arrayBuffer();
          if (bytes.byteLength !== pickedCover.size) {
            throw new Error("The selected cover image changed while uploading. Please choose it again.");
          }
          uploadedCoverPath = `${studio.id}/${draft.id}/cover.${pickedCover.extension}`;
          const { error: uploadError } = await supabase.storage
            .from("game-covers")
            .upload(uploadedCoverPath, bytes, {
              contentType: pickedCover.mimeType,
              cacheControl: "31536000",
              upsert: false
            });
          if (uploadError) throw new Error("Cover image upload failed: " + uploadError.message);
          coverImageUrl = supabase.storage.from("game-covers").getPublicUrl(uploadedCoverPath).data.publicUrl;
        }

        const { data: submitted, error: submitError } = await supabase
          .from("games")
          .update({ status: "submitted", cover_image_url: coverImageUrl })
          .eq("id", draft.id)
          .select("id,title,slug,genre,status,short_description,monetization_type,created_at,price_minor,currency,supported_platforms,cover_image_url,rejection_reason")
          .single();
        if (submitError) throw submitError;
        setGames((current) => [submitted as GameRow, ...current]);
        setNotice(pickedCover
          ? "Your game and cover image were submitted for Game ON review."
          : "Your game listing was submitted for Game ON review without cover artwork.");
      }
      setGameTitle("");
      setGameDescription("");
      setPriceNaira("");
      setPickedCover(null);
      setEditingGameId(null);
      setSection("games");
    } catch (caught) {
      if (createdGameId && supabase) {
        if (uploadedCoverPath) {
          await supabase.storage.from("game-covers").remove([uploadedCoverPath]).catch(() => undefined);
        }
        try {
          await supabase.from("games").delete().eq("id", createdGameId);
        } catch {
          // Best-effort cleanup; preserve the original upload/submission error.
        }
      }
      setError(caught instanceof Error ? caught.message : "Game listing could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  async function loadBuilds() {
    setError("");
    setBuildsError("");
    if (!creatorApiUrl) {
      setBuildsError("Secure build history is not connected yet. Configure the Creator server URL before using private build uploads.");
      return;
    }
    if (!supabase || !user || user.demo) {
      setBuildsError("Sign in with a real Game ON developer account and connect Supabase to load private build history.");
      return;
    }
    setBuildsBusy(true);
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = data.session?.access_token;
      if (!token) throw new Error("Your session has expired. Sign in again.");
      const response = await fetch(creatorApiUrl + "/api/builds", {
        method: "GET",
        headers: { Authorization: "Bearer " + token },
        cache: "no-store"
      });
      const payload = await response.json().catch(() => ({})) as { builds?: BuildRow[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Build history could not be loaded.");
      setBuilds(Array.isArray(payload.builds) ? payload.builds : []);
    } catch (caught) {
      setBuildsError(caught instanceof Error ? caught.message : "Build history could not be loaded.");
    } finally {
      setBuildsBusy(false);
    }
  }

  async function pickBuildFile() {
    setError("");
    if (!selectedBuildGame) {
      setBuildsError("Create a draft or submitted game listing before choosing a build.");
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      copyToCacheDirectory: true,
      multiple: false
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const file = new File(asset.uri);
    const size = asset.size ?? file.size;
    if (!size || size < 1) {
      setBuildsError("The selected file is empty or could not be read.");
      setPickedBuild(null);
      return;
    }
    if (size > 50 * 1024 * 1024) {
      setBuildsError("The current secure upload limit is 50 MB per file.");
      setPickedBuild(null);
      return;
    }
    const extensions: Record<string, string[]> = {
      android: ["apk", "aab"],
      windows: ["exe", "msi", "zip"],
      web: ["zip"]
    };
    const extension = asset.name.split(".").pop()?.toLowerCase() ?? "";
    if (!(extensions[selectedBuildPlatform] ?? []).includes(extension)) {
      setBuildsError("For " + selectedBuildPlatform + ", choose: " +
        (extensions[selectedBuildPlatform] ?? []).join(", ") + ".");
      setPickedBuild(null);
      return;
    }
    setPickedBuild({ uri: asset.uri, name: asset.name, size });
    setBuildsError("");
  }

  async function uploadBuild() {
    setBuildsError("");
    setNotice("");
    if (!supabase || !user || user.demo) {
      setBuildsError("Connect Supabase and sign in with a real developer account before uploading builds.");
      return;
    }
    if (!creatorApiUrl) {
      setBuildsError("The secure Creator server URL is not configured. Build upload is disabled until the adult project owner configures EXPO_PUBLIC_CREATOR_API_URL.");
      return;
    }
    if (!selectedBuildGame || !pickedBuild) {
      setBuildsError("Choose an eligible game and a build file first.");
      return;
    }
    if (!buildPlatforms.includes(selectedBuildPlatform)) {
      setBuildsError("This game listing does not declare the selected build platform.");
      return;
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9._+-]{0,39}$/.test(buildVersion.trim())) {
      setBuildsError("Version must be 1–40 characters using letters, numbers, dots, underscores, plus signs or hyphens.");
      return;
    }
    if (pickedBuild.size > 50 * 1024 * 1024) {
      setBuildsError("The current secure upload limit is 50 MB per file.");
      return;
    }

    setUploadBusy(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");

      const prepareResponse = await fetch(creatorApiUrl + "/api/builds/upload-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify({
          gameId: selectedBuildGame.id,
          version: buildVersion.trim(),
          platform: selectedBuildPlatform,
          fileName: pickedBuild.name,
          fileSize: pickedBuild.size
        })
      });
      const prepared = await prepareResponse.json().catch(() => ({})) as {
        bucket?: string; path?: string; token?: string; buildId?: string; error?: string
      };
      if (!prepareResponse.ok) throw new Error(prepared.error || "Secure upload could not be prepared.");
      if (!prepared.bucket || !prepared.path || !prepared.token || !prepared.buildId) {
        throw new Error("The Creator server returned an incomplete upload reservation.");
      }

      const nativeFile = new File(pickedBuild.uri);
      const bytes = await nativeFile.arrayBuffer();
      if (bytes.byteLength !== pickedBuild.size) {
        throw new Error("The selected file changed while preparing the upload. Please select it again.");
      }
      const { error: uploadError } = await supabase.storage
        .from(prepared.bucket)
        .uploadToSignedUrl(prepared.path, prepared.token, bytes, {
          contentType: "application/octet-stream",
          cacheControl: "3600"
        });
      if (uploadError) throw new Error("Private file transfer failed: " + uploadError.message);

      const finishResponse = await fetch(creatorApiUrl + "/api/builds/finalize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify({ buildId: prepared.buildId })
      });
      const finished = await finishResponse.json().catch(() => ({})) as { error?: string; message?: string };
      if (!finishResponse.ok) throw new Error(finished.error || "The upload arrived but could not be finalized.");
      setNotice("Build uploaded into private quarantine. It is not downloadable until a trusted malware scanner reports it clean and Game ON approves the release.");
      setPickedBuild(null);
      await loadBuilds();
    } catch (caught) {
      setBuildsError(caught instanceof Error ? caught.message : "Build upload failed. Refresh the build history and contact Game ON support if a pending upload remains.");
    } finally {
      setUploadBusy(false);
    }
  }

  async function loadAnalytics() {
    setAnalyticsMessage("");
    if (!supabase || !user || user.demo) {
      setAnalyticsRows([]);
      setAnalyticsMessage("Connect a real Game ON developer account to view live studio analytics.");
      return;
    }
    setAnalyticsBusy(true);
    const { data, error: queryError } = await supabase.rpc("get_creator_game_analytics");
    if (queryError) {
      setAnalyticsMessage(queryError.message.includes("function")
        ? "Apply database migration 0008 to enable creator analytics."
        : queryError.message);
    } else {
      setAnalyticsRows((data ?? []) as AnalyticsRow[]);
    }
    setAnalyticsBusy(false);
  }

  async function loadSales() {
    setSalesMessage("");
    if (!supabase || !user || user.demo) {
      setSalesRows([]);
      setSalesMessage("Connect a real Game ON developer account to view verified sales.");
      return;
    }
    setSalesBusy(true);
    const { data, error: queryError } = await supabase.rpc("get_creator_sales_summary");
    if (queryError) {
      setSalesMessage(queryError.message.includes("function")
        ? "Apply database migration 0009 to enable the verified sales ledger."
        : queryError.message);
    } else {
      setSalesRows((data ?? []) as SalesRow[]);
    }
    setSalesBusy(false);
  }

  async function loadNotifications() {
    setNotificationsMessage("");
    if (!supabase || !user || user.demo) {
      setNotifications([]);
      setNotificationsMessage("Connect a real Game ON developer account to receive publishing notifications.");
      return;
    }
    setNotificationsBusy(true);
    const { data, error: queryError } = await supabase
      .from("notifications")
      .select("id,title,message,notification_type,read_at,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (queryError) setNotificationsMessage(queryError.message);
    else setNotifications((data ?? []) as CreatorNotification[]);
    setNotificationsBusy(false);
  }

  async function markCreatorNotificationRead(item: CreatorNotification) {
    if (!supabase || !user || item.read_at) return;
    const readAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("id", item.id)
      .eq("user_id", user.id);
    if (updateError) {
      setNotificationsMessage("Notification could not be updated. " + updateError.message);
      return;
    }
    setNotifications((current) => current.map((row) =>
      row.id === item.id ? { ...row, read_at: readAt } : row
    ));
  }

  async function markAllCreatorNotificationsRead() {
    if (!supabase || !user || user.demo) return;
    const readAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("user_id", user.id)
      .is("read_at", null);
    if (updateError) {
      setNotificationsMessage("Notifications could not be updated. " + updateError.message);
      return;
    }
    setNotifications((current) => current.map((row) => row.read_at ? row : { ...row, read_at: readAt }));
    setNotificationsMessage("All notifications marked as read.");
  }

  async function signOut() {
    setError("");
    setNotice("");
    if (supabase && user && !user.demo) {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        setError(signOutError.message);
        return;
      }
    }
    setUser(null);
    setStudio(null);
    setGames([]);
    setBuilds([]);
    if (!supabase) {
      await Promise.all([
        AsyncStorage.removeItem(USER_KEY),
        AsyncStorage.removeItem(STUDIO_KEY),
        AsyncStorage.removeItem(GAMES_KEY)
      ]).catch(() => undefined);
    }
  }

  if (!ready) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loadingScreen}>
          <ActivityIndicator color="#18d9f4" size="large" />
          <Text style={styles.loadingText}>LOADING GAME ON CREATOR…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" />
        <KeyboardAvoidingView style={styles.authScreen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}><Text style={styles.brandMarkText}>G</Text></View>
            <View><Text style={styles.brandName}>GAME ON</Text><Text style={styles.brandSub}>CREATOR</Text></View>
          </View>
          <View style={styles.authPanel}>
            <Text style={styles.eyebrow}>BUILT FOR THE PEOPLE WHO BUILD GAMES</Text>
            <Text style={styles.authTitle}>{authMode === "signup" ? "YOUR GAME. YOUR AUDIENCE." : "WELCOME BACK."}</Text>
            <Text style={styles.bodyCopy}>Create your developer account, set up your studio and manage your Game ON listings.</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email address"
              placeholderTextColor="#718198"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              style={styles.input}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password (at least 8 characters)"
              placeholderTextColor="#718198"
              secureTextEntry
              autoCapitalize="none"
              autoComplete={authMode === "signup" ? "new-password" : "current-password"}
              style={styles.input}
              onSubmitEditing={() => { void handleAuth(); }}
            />
            {!!error && <Text style={styles.errorText}>{error}</Text>}
            {!!notice && <Text style={styles.noticeText}>{notice}</Text>}
            <ActionButton label={authMode === "signup" ? "CREATE DEVELOPER ACCOUNT" : "SIGN IN TO CREATOR"} onPress={() => { void handleAuth(); }} busy={busy} />
            <Pressable onPress={() => { setAuthMode(authMode === "signup" ? "signin" : "signup"); setError(""); setNotice(""); }}>
              <Text style={styles.switchText}>{authMode === "signup" ? "Already registered? Sign in" : "New to Creator? Create an account"}</Text>
            </Pressable>
            {!isSupabaseConfigured && <Text style={styles.demoBanner}>DEMO MODE · No real account is created until Supabase is connected.</Text>}
          </View>
          <Text style={styles.footerText}>GAME ON CREATOR · A SEPARATE DEVELOPER APP</Text>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (!studio) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" />
        <KeyboardAvoidingView style={styles.onboardingScreen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.topBar}>
            <Brand />
            <Pressable onPress={() => { void signOut(); }}><Text style={styles.linkText}>SIGN OUT</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.eyebrow}>ONE QUICK STEP</Text>
            <Text style={styles.pageTitle}>SET UP YOUR STUDIO.</Text>
            <Text style={styles.bodyCopy}>Your studio is the home for the games you publish on Game ON. You can update these details later.</Text>
            <Text style={styles.fieldLabel}>STUDIO NAME</Text>
            <TextInput value={studioName} onChangeText={setStudioName} placeholder="e.g. Blue Lantern Games" placeholderTextColor="#718198" style={styles.input} maxLength={80} />
            <Text style={styles.fieldLabel}>SHORT DESCRIPTION</Text>
            <TextInput value={studioDescription} onChangeText={setStudioDescription} placeholder="Tell players and Game ON about your studio." placeholderTextColor="#718198" multiline style={[styles.input, styles.multilineInput]} />
            <Text style={styles.fieldLabel}>WEBSITE (OPTIONAL)</Text>
            <TextInput value={studioWebsite} onChangeText={setStudioWebsite} placeholder="https://yourstudio.com" placeholderTextColor="#718198" autoCapitalize="none" keyboardType="url" style={styles.input} />
            {!!error && <Text style={styles.errorText}>{error}</Text>}
            {!!notice && <Text style={styles.noticeText}>{notice}</Text>}
            <ActionButton label="CREATE MY STUDIO" onPress={() => { void createStudio(); }} busy={busy} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.appShell}>
        <View style={styles.topBar}>
          <Brand />
          <Pressable onPress={() => Alert.alert("Developer account", user.email || "Signed in", [
            { text: "Close", style: "cancel" },
            { text: "Sign out", style: "destructive", onPress: () => { void signOut(); } }
          ])} style={styles.accountButton}>
            <Text style={styles.accountButtonText}>ACCOUNT</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navRow}>
          <NavButton label="OVERVIEW" active={section === "overview"} onPress={() => setSection("overview")} />
          <NavButton label="MY GAMES" active={section === "games"} onPress={() => setSection("games")} />
          <NavButton label="SUBMIT GAME" active={section === "submit"} onPress={() => setSection("submit")} />
          <NavButton label="BUILDS" active={section === "builds"} onPress={() => { setSection("builds"); void loadBuilds(); }} />
          <NavButton label="ANALYTICS" active={section === "analytics"} onPress={() => { setSection("analytics"); void loadAnalytics(); }} />
          <NavButton label="SALES" active={section === "sales"} onPress={() => { setSection("sales"); void loadSales(); }} />
          <NavButton label="INBOX" active={section === "notifications"} onPress={() => { setSection("notifications"); void loadNotifications(); }} />
          <NavButton label="STUDIO" active={section === "studio"} onPress={() => setSection("studio")} />
        </ScrollView>
        <ScrollView style={styles.mainScroll} contentContainerStyle={styles.mainContent} keyboardShouldPersistTaps="handled">
          {section === "overview" ? (
            <>
              <Text style={styles.eyebrow}>DEVELOPER WORKSPACE</Text>
              <Text style={styles.pageTitle}>WELCOME, {studio.studio_name.toUpperCase()}</Text>
              <Text style={styles.bodyCopy}>Your studio dashboard. Keep your listings organised and follow their review status.</Text>
              <View style={styles.creatorHero}>
                <View style={styles.creatorHeroTop}>
                  <Text style={styles.creatorHeroEyebrow}>GAME ON / CREATOR WORKSPACE</Text>
                  <Text style={styles.creatorHeroStatus}>STUDIO OVERVIEW</Text>
                </View>
                <Text style={styles.creatorHeroTitle}>Your studio, at a glance.</Text>
                <Text style={styles.creatorHeroCopy}>Manage your game listings, submissions and release activity from one workspace.</Text>
              </View>
              <View style={styles.verificationCard}>
                <View style={styles.rowBetween}>
                  <View style={styles.flexOne}>
                    <Text style={styles.cardLabel}>STUDIO VERIFICATION</Text>
                    <Text style={styles.cardTitle}>{studio.verification_status ? statusLabel(studio.verification_status) : "PENDING"}</Text>
                  </View>
                  <StatusPill value={studio.verification_status || "pending"} />
                </View>
                <Text style={styles.mutedCopy}>Game ON reviews studio details before publishing rights are granted. You cannot verify your own studio.</Text>
              </View>
              <View style={styles.statsGrid}>
                <StatCard label="TOTAL GAMES" value={String(games.length)} />
                <StatCard label="PUBLISHED" value={String(published)} />
                <StatCard label="IN REVIEW" value={String(inReview)} />
                <StatCard label="DRAFTS" value={String(drafts)} />
              </View>
              <ActionButton label="+ SUBMIT A GAME" onPress={() => setSection("submit")} />
              <ActionButton label="VIEW ALL MY GAMES" onPress={() => setSection("games")} secondary />
              {!isSupabaseConfigured && <Text style={styles.demoBanner}>LOCAL DEMO DATA · Changes stay on this device and are not submitted to Game ON.</Text>}
            </>
          ) : null}

          {section === "games" ? (
            <>
              <Text style={styles.eyebrow}>YOUR STUDIO CATALOGUE</Text>
              <Text style={styles.pageTitle}>MY GAMES</Text>
              <Text style={styles.bodyCopy}>{games.length} listing{games.length === 1 ? "" : "s"} connected to this studio.</Text>
              {!!notice && <Text style={styles.noticeText}>{notice}</Text>}
              {!!error && <Text style={styles.errorText}>{error}</Text>}
              <ActionButton label="+ SUBMIT A GAME" onPress={() => setSection("submit")} />
              {games.length === 0 ? <EmptyState title="NO GAMES SUBMITTED" copy="Submit your first listing to start the Game ON review process." /> : games.map((game) => (
                <View key={game.id} style={styles.gameCard}>
                  <View style={styles.rowBetween}>
                    {game.cover_image_url ? <Image source={{ uri: game.cover_image_url }} resizeMode="cover" style={styles.gameCoverThumbnail} /> : null}
                    <View style={styles.flexOne}>
                      <Text style={styles.gameTitle}>{game.title}</Text>
                      <Text style={styles.mutedCopy}>{game.genre} · {game.supported_platforms?.join(", ").toUpperCase() || "ANDROID"}</Text>
                    </View>
                    <StatusPill value={game.status} />
                  </View>
                  <Text style={styles.gameDescription}>{game.short_description}</Text>
                  {game.status === "rejected" && game.rejection_reason ? <Text style={styles.errorText}>GAME ON FEEDBACK: {game.rejection_reason}</Text> : null}
                  <View style={styles.rowBetween}>
                    <Text style={styles.moneyText}>{game.monetization_type.replaceAll("_", " ").toUpperCase()}</Text>
                    <Text style={styles.moneyText}>{money(game.price_minor, game.currency || "NGN")}</Text>
                  </View>
                  {["draft", "submitted", "rejected"].includes(game.status) ? (
                    <ActionButton label={game.status === "rejected" ? "EDIT & RESUBMIT" : "EDIT LISTING"} onPress={() => beginEditGame(game)} secondary />
                  ) : null}
                </View>
              ))}
            </>
          ) : null}

          {section === "submit" ? (
            <>
              <Text style={styles.eyebrow}>{editingGameId ? "UPDATE YOUR LISTING" : "PUBLISH ON GAME ON"}</Text>
              <Text style={styles.pageTitle}>{editingGameId ? "EDIT GAME" : "SUBMIT A GAME"}</Text>
              <Text style={styles.bodyCopy}>{editingGameId ? "Update your listing details. Game ON keeps control of review and publication status." : "Create your game listing. Game ON reviews submissions before a title can be published."}</Text>
              {editingGameId && editingGame ? (
                <View style={styles.coverPickerRow}>
                  {editingGame.cover_image_url ? <Image source={{ uri: editingGame.cover_image_url }} resizeMode="cover" style={styles.coverPreview} /> : <View style={styles.coverPlaceholder}><Text style={styles.coverPlaceholderText}>ART</Text></View>}
                  <View style={styles.flexOne}>
                    <Text style={styles.gameTitle}>Current cover artwork</Text>
                    <Text style={styles.mutedCopy}>Cover artwork stays unchanged when editing listing details.</Text>
                    <StatusPill value={editingGame.status} />
                    {editingGame.status === "rejected" && editingGame.rejection_reason ? <Text style={styles.errorText}>GAME ON FEEDBACK: {editingGame.rejection_reason}</Text> : null}
                  </View>
                </View>
              ) : null}
              <Text style={styles.fieldLabel}>GAME TITLE</Text>
              <TextInput value={gameTitle} onChangeText={setGameTitle} placeholder="Your game's name" placeholderTextColor="#718198" style={styles.input} maxLength={100} />
              <Text style={styles.fieldLabel}>SHORT DESCRIPTION (10–180 CHARACTERS)</Text>
              <TextInput value={gameDescription} onChangeText={setGameDescription} placeholder="Tell players what makes your game special." placeholderTextColor="#718198" style={[styles.input, styles.multilineInput]} multiline maxLength={180} />
              {!editingGameId ? (
                <>
                <Text style={styles.fieldLabel}>GAME COVER (OPTIONAL)</Text>
                <View style={styles.coverPickerRow}>
                  {pickedCover ? (
                    <Image source={{ uri: pickedCover.uri }} resizeMode="cover" style={styles.coverPreview} />
                  ) : (
                    <View style={styles.coverPlaceholder}>
                      <Text style={styles.coverPlaceholderText}>ART</Text>
                    </View>
                  )}
                  <View style={styles.flexOne}>
                    <Text style={styles.gameTitle}>{pickedCover ? pickedCover.name : "Add your game's cover art"}</Text>
                    <Text style={styles.mutedCopy}>JPG, PNG or WebP · Maximum 5 MB. This image appears in the GAME ON Store.</Text>
                    <ActionButton
                      label={pickedCover ? "CHANGE COVER IMAGE" : "CHOOSE COVER IMAGE"}
                      onPress={() => { void pickCoverImage(); }}
                      secondary
                      disabled={!supabase || Boolean(user?.demo)}
                    />
                    {pickedCover ? (
                      <Pressable onPress={() => setPickedCover(null)} style={styles.removeCoverButton}>
                        <Text style={styles.linkText}>REMOVE COVER</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
                </>
              ) : null}
              <Text style={styles.fieldLabel}>GENRE</Text>
              <TextInput value={genre} onChangeText={setGenre} placeholder="Adventure, Racing, Puzzle…" placeholderTextColor="#718198" style={styles.input} />
              <Text style={styles.fieldLabel}>PLATFORM</Text>
              <View style={styles.choiceRow}>
                {["android", "ios", "windows", "web"].map((item) => (
                  <Pressable key={item} onPress={() => setPlatform(item)} style={[styles.choiceChip, platform === item && styles.choiceChipActive]}>
                    <Text style={[styles.choiceText, platform === item && styles.choiceTextActive]}>{item.toUpperCase()}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.fieldLabel}>MONETIZATION</Text>
              <View style={styles.choiceColumn}>
                {[
                  { value: "free", label: "Free" },
                  { value: "paid", label: "Paid" },
                  { value: "free_with_ads", label: "Free with ads" },
                  { value: "free_with_iap", label: "Free with in-app purchases" },
                  { value: "demo", label: "Free demo" }
                ].map((item) => (
                  <Pressable key={item.value} onPress={() => setMonetization(item.value)} style={[styles.choiceChip, styles.choiceFull, monetization === item.value && styles.choiceChipActive]}>
                    <Text style={[styles.choiceText, monetization === item.value && styles.choiceTextActive]}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
              {monetization === "paid" ? (
                <>
                  <Text style={styles.fieldLabel}>PRICE (NGN)</Text>
                  <TextInput value={priceNaira} onChangeText={setPriceNaira} placeholder="e.g. 2500" placeholderTextColor="#718198" style={styles.input} keyboardType="decimal-pad" />
                </>
              ) : null}
              {!!error && <Text style={styles.errorText}>{error}</Text>}
              {!!notice && <Text style={styles.noticeText}>{notice}</Text>}
              <ActionButton label={editingGameId ? (editingGame?.status === "rejected" ? "SAVE & RESUBMIT" : "SAVE CHANGES") : "SUBMIT FOR REVIEW"} onPress={() => { void submitGame(); }} busy={busy} />
              {editingGameId ? <ActionButton label="CANCEL EDITING" onPress={cancelGameEdit} secondary disabled={busy} /> : null}
              <Text style={styles.mutedCopy}>{editingGameId ? "These changes cannot approve or publish a game. Game ON controls all review decisions." : "Submitting a listing does not publish it. Only authorised Game ON reviewers can approve a game."}</Text>
            </>
          ) : null}

          {section === "builds" ? (
            <>
              <Text style={styles.eyebrow}>PRIVATE GAME FILES</Text>
              <Text style={styles.pageTitle}>BUILD MANAGER</Text>
              <Text style={styles.bodyCopy}>Upload a build into private quarantine. Game ON requires a trusted malware scan and release approval before players can receive it.</Text>
              <View style={styles.verificationCard}>
                <Text style={styles.cardTitle}>SECURE UPLOAD</Text>
                <Text style={styles.mutedCopy}>The Creator server checks your developer session, studio ownership, listing status, declared platform and file size before creating a one-time private upload URL.</Text>
                <Text style={styles.fieldLabel}>GAME LISTING</Text>
                {buildEligibleGames.length === 0 ? (
                  <Text style={styles.mutedCopy}>Create a draft or submitted game listing before uploading a build.</Text>
                ) : buildEligibleGames.map((game) => (
                  <Pressable
                    key={game.id}
                    onPress={() => {
                      setSelectedBuildGameId(game.id);
                      const available = (game.supported_platforms ?? ["android"])
                        .find((value) => ["android", "windows", "web"].includes(value.toLowerCase()));
                      setSelectedBuildPlatform(available ?? "android");
                      setPickedBuild(null);
                    }}
                    style={[styles.choiceChip, styles.choiceFull, selectedBuildGameId === game.id && styles.choiceChipActive]}
                  >
                    <Text style={[styles.choiceText, selectedBuildGameId === game.id && styles.choiceTextActive]}>{game.title} · {statusLabel(game.status)}</Text>
                  </Pressable>
                ))}
                <Text style={styles.fieldLabel}>PLATFORM</Text>
                <View style={styles.choiceRow}>
                  {buildPlatforms.map((item) => (
                    <Pressable key={item} onPress={() => { setSelectedBuildPlatform(item.toLowerCase()); setPickedBuild(null); }} style={[styles.choiceChip, selectedBuildPlatform === item.toLowerCase() && styles.choiceChipActive]}>
                      <Text style={[styles.choiceText, selectedBuildPlatform === item.toLowerCase() && styles.choiceTextActive]}>{item.toUpperCase()}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.fieldLabel}>VERSION LABEL</Text>
                <TextInput value={buildVersion} onChangeText={setBuildVersion} placeholder="e.g. 1.0.0" placeholderTextColor="#718198" style={styles.input} maxLength={40} autoCapitalize="none" />
                <ActionButton label="CHOOSE BUILD FILE" onPress={() => { void pickBuildFile(); }} secondary />
                {pickedBuild ? <Text style={styles.selectedFile}>{pickedBuild.name} · {(pickedBuild.size / 1024 / 1024).toFixed(1)} MB</Text> : <Text style={styles.mutedCopy}>Android: APK/AAB · Windows: EXE/MSI/ZIP · Web: ZIP · 50 MB maximum</Text>}
                <ActionButton label="UPLOAD TO PRIVATE QUARANTINE" onPress={() => { void uploadBuild(); }} busy={uploadBusy} disabled={!pickedBuild || !selectedBuildGame || !creatorApiUrl || !supabase || Boolean(user.demo)} />
                <ActionButton label="REFRESH BUILD HISTORY" onPress={() => { void loadBuilds(); }} busy={buildsBusy} secondary />
              </View>
              {!!buildsError && <Text style={styles.errorText}>{buildsError}</Text>}
              {!!notice && <Text style={styles.noticeText}>{notice}</Text>}
              {buildsBusy ? <ActivityIndicator color="#18d9f4" /> : builds.length === 0 ? <EmptyState title="NO BUILD RECORDS" copy="Build history appears here after the private Creator API is connected and a build is uploaded." /> : builds.map((build) => (
                <View key={build.id} style={styles.gameCard}>
                  <Text style={styles.gameTitle}>{build.game_title} · v{build.version_label}</Text>
                  <Text style={styles.mutedCopy}>{build.platform.toUpperCase()} · {(Number(build.file_size_bytes) / 1024 / 1024).toFixed(1)} MB · {new Date(build.created_at).toLocaleDateString()}</Text>
                  <View style={styles.choiceRow}>
                    <StatusPill value={build.upload_status} />
                    <StatusPill value={build.scan_status} />
                    <StatusPill value={build.release_status} />
                  </View>
                </View>
              ))}
              {!creatorApiUrl ? <Text style={styles.demoBanner}>PRIVATE UPLOAD IS LOCKED UNTIL THE ADULT PROJECT OWNER CONFIGURES THE CREATOR SERVER URL.</Text> : null}
            </>
          ) : null}

          {section === "analytics" ? (
            <>
              <Text style={styles.eyebrow}>UNDERSTAND YOUR REACH</Text>
              <Text style={styles.pageTitle}>STUDIO ANALYTICS</Text>
              <Text style={styles.bodyCopy}>Track secure download-link requests and approved releases. Link issuance is not proof of a completed download.</Text>
              <ActionButton label="REFRESH ANALYTICS" onPress={() => { void loadAnalytics(); }} busy={analyticsBusy} secondary />
              {!!analyticsMessage && <Text style={styles.noticeText}>{analyticsMessage}</Text>}
              <View style={styles.statsGrid}>
                <StatCard label="DOWNLOAD LINKS ISSUED" value={analyticsBusy ? "—" : analyticsRows.reduce((sum, row) => sum + Number(row.download_link_issues || 0), 0).toLocaleString()} />
                <StatCard label="APPROVED BUILDS" value={analyticsBusy ? "—" : analyticsRows.reduce((sum, row) => sum + Number(row.approved_builds || 0), 0).toLocaleString()} />
                <StatCard label="TRACKED GAMES" value={analyticsBusy ? "—" : String(analyticsRows.length)} />
                <StatCard label="PUBLISHED GAMES" value={analyticsBusy ? "—" : String(analyticsRows.filter((row) => row.game_status === "published").length)} />
              </View>
              {analyticsBusy ? <ActivityIndicator color="#18d9f4" /> : analyticsRows.length === 0 ? <EmptyState title="NO ANALYTICS YET" copy="Approved games and download-link activity will appear here when the backend has recorded them." /> : analyticsRows.map((row) => (
                <View key={row.game_id} style={styles.gameCard}>
                  <Text style={styles.gameTitle}>{row.game_title}</Text>
                  <Text style={styles.mutedCopy}>{statusLabel(row.game_status)} · {Number(row.approved_builds).toLocaleString()} approved build(s){row.latest_approved_version ? " · v" + row.latest_approved_version : ""}</Text>
                  <Text style={styles.statValue}>{Number(row.download_link_issues).toLocaleString()}</Text>
                  <Text style={styles.mutedCopy}>Download links issued · {row.latest_download_link_at ? new Date(row.latest_download_link_at).toLocaleString() : "No links issued"}</Text>
                </View>
              ))}
              <Text style={styles.demoBanner}>DOWNLOAD-LINK COUNTS DO NOT PROVE THAT A FILE TRANSFER FINISHED OR THAT A GAME WAS INSTALLED.</Text>
            </>
          ) : null}

          {section === "sales" ? (
            <>
              <Text style={styles.eyebrow}>YOUR STUDIO REVENUE</Text>
              <Text style={styles.pageTitle}>SALES & EARNINGS</Text>
              <Text style={styles.bodyCopy}>Verified paid orders and the estimated developer share from Game ON's sales ledger.</Text>
              <ActionButton label="REFRESH SALES" onPress={() => { void loadSales(); }} busy={salesBusy} secondary />
              {!!salesMessage && <Text style={styles.noticeText}>{salesMessage}</Text>}
              <View style={styles.statsGrid}>
                <StatCard label="GROSS SALES" value={salesBusy ? "—" : money(salesRows.reduce((sum, row) => sum + Number(row.gross_sales_minor || 0), 0))} />
                <StatCard label="PLATFORM FEES" value={salesBusy ? "—" : money(salesRows.reduce((sum, row) => sum + Number(row.platform_fees_minor || 0), 0))} />
                <StatCard label="ESTIMATED DEVELOPER NET" value={salesBusy ? "—" : money(salesRows.reduce((sum, row) => sum + Number(row.developer_net_minor || 0), 0))} />
                <StatCard label="PAID ORDERS" value={salesBusy ? "—" : salesRows.reduce((sum, row) => sum + Number(row.paid_orders || 0), 0).toLocaleString()} />
              </View>
              {salesBusy ? <ActivityIndicator color="#18d9f4" /> : salesRows.length === 0 ? <EmptyState title="NO VERIFIED SALES YET" copy="Verified paid purchases of your published games will appear here." /> : salesRows.map((row) => (
                <View key={row.game_id} style={styles.gameCard}>
                  <Text style={styles.gameTitle}>{row.game_title}</Text>
                  <Text style={styles.mutedCopy}>{Number(row.paid_orders).toLocaleString()} verified paid order(s)</Text>
                  <Text style={styles.statValue}>{money(Number(row.developer_net_minor))}</Text>
                  <Text style={styles.mutedCopy}>Estimated developer net</Text>
                  <View style={styles.rowBetween}>
                    <Text style={styles.moneyText}>GROSS {money(Number(row.gross_sales_minor))}</Text>
                    <Text style={styles.moneyText}>FEE {money(Number(row.platform_fees_minor))}</Text>
                  </View>
                  <Text style={styles.mutedCopy}>{row.latest_sale_at ? "Latest sale " + new Date(row.latest_sale_at).toLocaleString() : "No sales recorded"}</Text>
                </View>
              ))}
              <Text style={styles.demoBanner}>THESE ARE LEDGER ESTIMATES, NOT PAYOUTS. PROCESSOR FEES, TAXES, REFUNDS AND PAYOUT TIMING ARE SEPARATE. DEVELOPER TRANSFERS ARE NOT ENABLED.</Text>
            </>
          ) : null}

          {section === "notifications" ? (
            <>
              <Text style={styles.eyebrow}>STUDIO ACTIVITY</Text>
              <Text style={styles.pageTitle}>NOTIFICATIONS</Text>
              <Text style={styles.bodyCopy}>Publishing decisions and important updates about your developer account.</Text>
              <ActionButton label="MARK ALL AS READ" onPress={() => { void markAllCreatorNotificationsRead(); }} disabled={!notifications.some((item) => !item.read_at)} secondary />
              <ActionButton label="REFRESH INBOX" onPress={() => { void loadNotifications(); }} busy={notificationsBusy} secondary />
              {!!notificationsMessage && <Text style={styles.noticeText}>{notificationsMessage}</Text>}
              {notificationsBusy ? <ActivityIndicator color="#18d9f4" /> : notifications.length === 0 ? <EmptyState title="NO NOTIFICATIONS YET" copy="Studio verification and game publishing updates will appear here." /> : notifications.map((item) => (
                <Pressable key={item.id} onPress={() => { void markCreatorNotificationRead(item); }} style={[styles.gameCard, !item.read_at && styles.notificationUnread]}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.gameTitle}>{item.title}</Text>
                    <StatusPill value={item.read_at ? "read" : "new"} />
                  </View>
                  <Text style={styles.gameDescription}>{item.message}</Text>
                  <Text style={styles.mutedCopy}>{statusLabel(item.notification_type)} · {new Date(item.created_at).toLocaleString()}</Text>
                </Pressable>
              ))}
            </>
          ) : null}

          {section === "studio" ? (
            <>
              <Text style={styles.eyebrow}>YOUR DEVELOPER PROFILE</Text>
              <Text style={styles.pageTitle}>STUDIO SETTINGS</Text>
              <View style={styles.verificationCard}>
                <Text style={styles.cardLabel}>STUDIO NAME</Text>
                <Text style={styles.cardTitle}>{studio.studio_name}</Text>
                <Text style={styles.cardLabel}>STUDIO SLUG</Text>
                <Text style={styles.mutedCopy}>{studio.slug}</Text>
                <Text style={styles.cardLabel}>VERIFICATION</Text>
                <StatusPill value={studio.verification_status || "pending"} />
                {!!studio.description && <Text style={styles.mutedCopy}>{studio.description}</Text>}
                {!!studio.website_url && <Text style={styles.linkText}>{studio.website_url}</Text>}
              </View>
              <Text style={styles.bodyCopy}>Studio identity and verification changes are managed by Game ON. Contact support for a change request.</Text>
              <ActionButton label="SIGN OUT" onPress={() => { void signOut(); }} secondary />
            </>
          ) : null}

          {!!error && section !== "submit" && section !== "builds" ? <Text style={styles.errorText}>{error}</Text> : null}
          {!!notice && section !== "overview" && section !== "submit" ? <Text style={styles.noticeText}>{notice}</Text> : null}
          <View style={styles.footer}>
            <Text style={styles.footerBrand}>GAME ON <Text style={styles.footerAccent}>CREATOR</Text></Text>
            <Text style={styles.footerText}>A home for the people who make games.</Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function Brand() {
  return (
    <View style={styles.brandRow}>
      <View style={styles.brandMark}><Text style={styles.brandMarkText}>G</Text></View>
      <View><Text style={styles.brandName}>GAME ON</Text><Text style={styles.brandSub}>CREATOR</Text></View>
    </View>
  );
}

function NavButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.navButton, active && styles.navButtonActive]}>
      <Text style={[styles.navButtonText, active && styles.navButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.mutedCopy}>{copy}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#070b14" },
  appShell: { flex: 1, backgroundColor: "#080c18" },
  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  loadingText: { color: "#90a6bd", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  authScreen: { flex: 1, paddingHorizontal: 22, justifyContent: "center" },
  authPanel: { width: "100%", maxWidth: 480, alignSelf: "center", backgroundColor: "#111a29", borderWidth: 1, borderColor: "#2b3d52", borderRadius: 18, padding: 23, marginTop: 28 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  brandMark: { width: 42, height: 42, borderRadius: 10, backgroundColor: "#102d40", borderWidth: 1, borderColor: "#18d9f4", alignItems: "center", justifyContent: "center" },
  brandMarkText: { color: "#18d9f4", fontSize: 26, fontWeight: "900" },
  brandName: { color: "#f0f7ff", fontWeight: "900", fontSize: 18, letterSpacing: 2 },
  brandSub: { color: "#18d9f4", fontWeight: "800", fontSize: 9, letterSpacing: 4, marginTop: 2 },
  eyebrow: { color: "#18d9f4", fontSize: 9, fontWeight: "900", letterSpacing: 1.8, marginBottom: 10 },
  authTitle: { color: "#f2f7ff", fontSize: 31, lineHeight: 36, fontWeight: "900", marginBottom: 10 },
  pageTitle: { color: "#f2f7ff", fontSize: 26, lineHeight: 32, fontWeight: "800", marginBottom: 8 },
  bodyCopy: { color: "#a7b6c8", fontSize: 13, lineHeight: 20, marginBottom: 18 },
  input: { minHeight: 48, borderWidth: 1, borderColor: "#293b50", backgroundColor: "#07101c", color: "#f0f7ff", borderRadius: 8, paddingHorizontal: 13, marginBottom: 12, fontSize: 12 },
  multilineInput: { minHeight: 88, paddingTop: 13, textAlignVertical: "top" },
  switchText: { color: "#18d9f4", textAlign: "center", fontSize: 10, fontWeight: "800", paddingVertical: 17 },
  demoBanner: { color: "#e6bd89", borderWidth: 1, borderColor: "#654c2b", backgroundColor: "#241d16", borderRadius: 8, padding: 12, fontSize: 9, lineHeight: 15, fontWeight: "800", marginTop: 13 },
  footerText: { color: "#71849a", fontSize: 9, letterSpacing: 1.2, textAlign: "center", marginTop: 23 },
  onboardingScreen: { flex: 1 },
  topBar: { minHeight: 82, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#23445c", backgroundColor: "#080f1c" },
  linkText: { color: "#18d9f4", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  formContent: { padding: 22, paddingBottom: 50 },
  fieldLabel: { color: "#8298af", fontSize: 8, fontWeight: "900", letterSpacing: 1.4, marginBottom: 8, marginTop: 8 },
  actionButton: { minHeight: 54, alignItems: "center", justifyContent: "center", backgroundColor: "#18d9f4", borderRadius: 14, paddingHorizontal: 18, marginTop: 13, shadowColor: "#18d9f4", shadowOpacity: 0.18, shadowRadius: 12, elevation: 4 },
  actionButtonText: { color: "#06111e", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  secondaryButton: { backgroundColor: "#0e2030", borderWidth: 1, borderColor: "#265168" },
  secondaryButtonText: { color: "#bdeef5" },
  disabledButton: { opacity: 0.55 },
  pressed: { opacity: 0.82 },
  accountButton: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#0b1e2b", borderWidth: 1, borderColor: "#1a9db5", borderRadius: 8 },
  accountButtonText: { color: "#bceff6", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  navRow: { gap: 9, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#24445b", backgroundColor: "#0a1220" },
  navButton: { paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "#2b3d52", backgroundColor: "#111a29", borderRadius: 9 },
  navButtonActive: { borderColor: "#18d9f4", backgroundColor: "#103042" },
  navButtonText: { color: "#91a3b7", fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  navButtonTextActive: { color: "#c0f8ff" },
  mainScroll: { flex: 1 },
  mainContent: { padding: 18, paddingBottom: 48 },
  creatorHero: { minHeight: 174, borderRadius: 18, borderWidth: 1, borderColor: "#2c465e", backgroundColor: "#111a29", padding: 20, marginBottom: 17, overflow: "hidden", justifyContent: "center" },
  creatorHeroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 17 },
  creatorHeroEyebrow: { color: "#18d9f4", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  creatorHeroStatus: { color: "#c5d3e2", fontSize: 8, fontWeight: "800", letterSpacing: 0.5, borderWidth: 1, borderColor: "#304358", backgroundColor: "#182536", borderRadius: 6, paddingHorizontal: 9, paddingVertical: 6 },
  creatorHeroTitle: { color: "#f2f7ff", fontSize: 26, lineHeight: 32, fontWeight: "800", letterSpacing: -0.4 },
  creatorHeroCopy: { color: "#a7b6c8", fontSize: 12, lineHeight: 19, maxWidth: 310, marginTop: 8 },
  creatorHeroChips: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 15 },
  creatorHeroChip: { color: "#d7d6ff", backgroundColor: "#282650", borderWidth: 1, borderColor: "#4b4785", borderRadius: 6, paddingHorizontal: 9, paddingVertical: 6, fontSize: 8, fontWeight: "900", letterSpacing: 0.8, overflow: "hidden" },
  creatorHeroOrb: { position: "absolute", width: 150, height: 150, borderRadius: 75, borderWidth: 16, borderColor: "rgba(125,112,255,0.12)", right: -48, bottom: -67 },
  verificationCard: { borderWidth: 1, borderColor: "#31556f", borderRadius: 19, backgroundColor: "#0e1d30", padding: 18, marginBottom: 17, elevation: 2 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  flexOne: { flex: 1 },
  cardLabel: { color: "#8298af", fontSize: 8, fontWeight: "900", letterSpacing: 1.4, marginBottom: 6, marginTop: 5 },
  cardTitle: { color: "#f1f7ff", fontSize: 15, fontWeight: "900" },
  mutedCopy: { color: "#8da1b7", fontSize: 10, lineHeight: 16, marginTop: 8 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginBottom: 13 },
  statCard: { width: "47%", minHeight: 100, borderWidth: 1, borderColor: "#293d53", borderRadius: 15, backgroundColor: "#121d2c", padding: 16, justifyContent: "center" },
  statValue: { color: "#55d9ee", fontSize: 25, fontWeight: "800" },
  statLabel: { color: "#9aabbe", fontSize: 9, fontWeight: "700", letterSpacing: 0.5, marginTop: 6 },
  statusPill: { color: "#d0deeb", fontSize: 8, fontWeight: "900", letterSpacing: 0.6, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 5, overflow: "hidden" },
  statusSuccess: { backgroundColor: "#17372b", color: "#a7e6bd" },
  statusDanger: { backgroundColor: "#3a1f26", color: "#f2a8b4" },
  statusPending: { backgroundColor: "#263548", color: "#c3d1df" },
  gameCard: { borderWidth: 1, borderColor: "#304b66", borderRadius: 18, backgroundColor: "#0e192a", padding: 17, marginTop: 14, elevation: 2 },
  gameTitle: { color: "#f0f7ff", fontSize: 14, fontWeight: "900" },
  gameDescription: { color: "#a5b5c7", fontSize: 11, lineHeight: 17, marginTop: 9, marginBottom: 10 },
  selectedFile: { color: "#bceff6", fontSize: 10, lineHeight: 15, marginTop: 10, fontWeight: "800" },
  coverPickerRow: { flexDirection: "row", alignItems: "flex-start", gap: 13, padding: 13, borderWidth: 1, borderColor: "#2b4054", borderRadius: 13, backgroundColor: "#0d1725", marginBottom: 12 },
  coverPreview: { width: 92, height: 112, borderRadius: 9, backgroundColor: "#16263a" },
  coverPlaceholder: { width: 92, height: 112, borderRadius: 9, backgroundColor: "#17283a", borderWidth: 1, borderColor: "#30465e", alignItems: "center", justifyContent: "center" },
  coverPlaceholderText: { color: "#18d9f4", fontSize: 20, fontWeight: "800", letterSpacing: 2 },
  removeCoverButton: { alignSelf: "flex-start", paddingVertical: 8 },
  gameCoverThumbnail: { width: 58, height: 64, borderRadius: 8, backgroundColor: "#17283a" },
  notificationUnread: { borderColor: "#18647a", backgroundColor: "#0d202e" },
  moneyText: { color: "#8ba1b7", fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  choiceColumn: { gap: 7, marginBottom: 7 },
  choiceChip: { borderWidth: 1, borderColor: "#293a50", backgroundColor: "#0b1421", borderRadius: 7, paddingHorizontal: 12, paddingVertical: 10 },
  choiceFull: { width: "100%" },
  choiceChipActive: { borderColor: "#18d9f4", backgroundColor: "#103042" },
  choiceText: { color: "#91a4b8", fontSize: 9, fontWeight: "800" },
  choiceTextActive: { color: "#c0f8ff" },
  errorText: { color: "#ff9aa8", fontSize: 10, lineHeight: 15, marginTop: 8, marginBottom: 5 },
  noticeText: { color: "#9be3bb", fontSize: 10, lineHeight: 15, marginTop: 8, marginBottom: 5 },
  emptyState: { borderWidth: 1, borderColor: "#26384e", borderStyle: "dashed", borderRadius: 12, padding: 22, alignItems: "center", marginTop: 13 },
  emptyTitle: { color: "#f0f7ff", fontSize: 12, fontWeight: "900", letterSpacing: 0.8, textAlign: "center" },
  footer: { borderTopWidth: 1, borderTopColor: "#1b2b3d", paddingTop: 20, marginTop: 27 },
  footerBrand: { color: "#f2f7ff", fontSize: 17, fontWeight: "900", letterSpacing: 2 },
  footerAccent: { color: "#18d9f4" }
});