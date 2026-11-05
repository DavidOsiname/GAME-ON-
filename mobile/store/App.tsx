import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
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
import type { User } from "@supabase/supabase-js";
import { demoGames, mapGame, type Game } from "./src/data/demo-games";
import { isSupabaseConfigured, supabase } from "./src/lib/supabase";

type Tab = "discover" | "library" | "wishlist" | "purchases" | "notifications";
type AuthMode = "signin" | "signup";
type PlayerPurchase = {
  id: string;
  reference: string;
  game_title_snapshot: string;
  amount_minor: number | string;
  currency: string;
  status: string;
  created_at: string;
  paid_at: string | null;
  refund_status?: string | null;
  refund_reason?: string | null;
};
type PlayerNotification = {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
};
type PlayerReview = {
  id: string;
  user_id: string;
  rating: number;
  review_text: string | null;
  moderation_status: "pending" | "approved" | "rejected" | "hidden" | string;
  created_at: string;
};

const GENRES = ["All", "Action", "Adventure", "Casual", "Puzzle", "Racing", "Strategy"];
const WISHLIST_KEY = "gameon.store.wishlist.v1";

function dateLabel(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(parsed);
}

function money(amountMinor: number | null, currency: string): string {
  if (amountMinor === null) return "Free";
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(amountMinor / 100);
  } catch {
    return `${currency} ${(amountMinor / 100).toFixed(2)}`;
  }
}

function GameCard({
  game,
  saved,
  owned = false,
  onOpen,
  onToggleSave
}: {
  game: Game;
  saved: boolean;
  owned?: boolean;
  onOpen: () => void;
  onToggleSave: () => void;
}) {
  return (
    <View style={styles.gameCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${game.title} details`}
        onPress={onOpen}
        style={({ pressed }) => [styles.gameArtwork, { backgroundColor: game.accent }, pressed && styles.pressed]}
      >
        <View style={styles.artTopLine}>
          <Text style={styles.artLabel}>GAME ON / DISCOVER</Text>
          <Text style={styles.artPlatform}>{game.platforms[0]?.toUpperCase() ?? "GAME"}</Text>
        </View>
        <View style={styles.gameCoverMark}>
          <Text style={styles.gameCoverInitial}>{game.genre.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.gameCoverCaption}>
          <Text style={styles.artTitle}>{game.genre}</Text>
          <Text style={styles.artSubtitle}>GAME ON COLLECTION</Text>
        </View>
      </Pressable>
      <View style={styles.gameInfo}>
        <View style={styles.gameInfoMain}>
          <Text numberOfLines={1} style={styles.gameTitle}>{game.title}</Text>
          <Text style={styles.gameStudio}>{game.studio} · {game.genre}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? `Remove ${game.title} from wishlist` : `Save ${game.title} to wishlist`}
          onPress={onToggleSave}
          style={({ pressed }) => [styles.heartButton, saved && styles.heartButtonSaved, pressed && styles.pressed]}
        >
          <Text style={[styles.heart, saved && styles.heartSaved]}>{saved ? "♥" : "♡"}</Text>
        </Pressable>
      </View>
      <View style={styles.gameTags}>
        <Text style={styles.tag}>{owned ? "IN YOUR LIBRARY" : money(game.priceMinor, game.currency)}</Text>
        <Text style={styles.tag}>{game.offline ? "OFFLINE" : "ONLINE"}</Text>
        {game.ads ? <Text style={styles.tag}>ADS</Text> : null}
      </View>
      <Pressable onPress={onOpen} style={styles.detailsLink}>
        <Text style={styles.detailsLinkText}>VIEW GAME DETAILS  ↗</Text>
      </Pressable>
    </View>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("discover");
  const [games, setGames] = useState<Game[]>(demoGames);
  const [libraryGames, setLibraryGames] = useState<Game[]>([]);
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [libraryError, setLibraryError] = useState("");
  const [libraryRefresh, setLibraryRefresh] = useState(0);
  const [purchases, setPurchases] = useState<PlayerPurchase[]>([]);
  const [notifications, setNotifications] = useState<PlayerNotification[]>([]);
  const [activityBusy, setActivityBusy] = useState(false);
  const [activityError, setActivityError] = useState("");
  const [activityRefresh, setActivityRefresh] = useState(0);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("All");
  const [selected, setSelected] = useState<Game | null>(null);
  const [gameReviews, setGameReviews] = useState<PlayerReview[]>([]);
  const [myReview, setMyReview] = useState<PlayerReview | null>(null);
  const [canReview, setCanReview] = useState(false);
  const [reviewsBusy, setReviewsBusy] = useState(false);
  const [reviewsError, setReviewsError] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [catalogMessage, setCatalogMessage] = useState(
    isSupabaseConfigured ? "Connecting to the Game ON catalogue…" : "DEMO CATALOGUE · SAMPLE GAMES"
  );

  useEffect(() => {
    let alive = true;

    AsyncStorage.getItem(WISHLIST_KEY)
      .then((value) => {
        if (!alive || !value) return;
        try {
          const parsed: unknown = JSON.parse(value);
          if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
            setWishlist(parsed);
          }
        } catch {
          setWishlist([]);
        }
      })
      .catch(() => undefined);

    if (!supabase) {
      return () => { alive = false; };
    }

    supabase.auth.getSession().then(({ data }) => {
      if (alive) setUser(data.session?.user ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) setUser(session?.user ?? null);
    });

    return () => {
      alive = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist)).catch(() => undefined);
  }, [wishlist]);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    setCatalogBusy(true);
    supabase
      .from("games")
      .select("id,title,slug,genre,short_description,description,supported_platforms,monetization_type,price_minor,currency,offline_support,contains_ads,has_in_app_purchases,developer_studios(studio_name)")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          setCatalogMessage("Live catalogue could not load. Showing sample listings instead.");
        } else {
          const liveGames = ((data ?? []) as unknown as Record<string, unknown>[]).map(mapGame);
          setGames(liveGames);
          setCatalogMessage(liveGames.length ? "LIVE GAME ON CATALOGUE" : "YOUR GAME ON CATALOGUE IS READY FOR APPROVED GAMES");
        }
        setCatalogBusy(false);
      });

    return () => { alive = false; };
  }, []);



  useEffect(() => {
    if (!supabase || !user) return;
    let alive = true;

    supabase
      .from("wishlists")
      .select("game_id")
      .eq("user_id", user.id)
      .then(({ data, error }) => {
        if (!alive || error || !data) return;
        const liveIds = data.map((row) => String(row.game_id));
        setWishlist(liveIds);
      });

    return () => { alive = false; };
  }, [user]);

  useEffect(() => {
    if (tab !== "library") return;
    if (!supabase || !user) {
      setLibraryGames([]);
      setLibraryBusy(false);
      setLibraryError("");
      return;
    }

    let alive = true;
    setLibraryBusy(true);
    setLibraryError("");

    async function loadLibrary() {
      const { data: libraryRows, error: libraryQueryError } = await supabase!
        .from("user_library")
        .select("game_id,added_at")
        .eq("user_id", user!.id)
        .order("added_at", { ascending: false });

      if (libraryQueryError) throw libraryQueryError;

      const gameIds = (libraryRows ?? []).map((row) => String(row.game_id));
      if (gameIds.length === 0) {
        if (alive) setLibraryGames([]);
        return;
      }

      const { data: gameRows, error: gamesQueryError } = await supabase!
        .from("games")
        .select("id,title,slug,genre,short_description,description,supported_platforms,monetization_type,price_minor,currency,offline_support,contains_ads,has_in_app_purchases,developer_studios(studio_name)")
        .in("id", gameIds)
        .eq("status", "published");

      if (gamesQueryError) throw gamesQueryError;

      if (alive) {
        const mappedGames = ((gameRows ?? []) as unknown as Record<string, unknown>[]).map(mapGame);
        const position = new Map(gameIds.map((id, index) => [id, index]));
        mappedGames.sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
        setLibraryGames(mappedGames);
      }
    }

    loadLibrary()
      .catch((error: unknown) => {
        if (!alive) return;
        setLibraryGames([]);
        setLibraryError(error instanceof Error ? error.message : "Your library could not be loaded. Try again.");
      })
      .finally(() => {
        if (alive) setLibraryBusy(false);
      });

    return () => { alive = false; };
  }, [tab, user, libraryRefresh]);

  useEffect(() => {
    if (!selected || selected.id.startsWith("demo-") || !supabase) {
      setGameReviews([]);
      setMyReview(null);
      setCanReview(false);
      setReviewsBusy(false);
      setReviewsError("");
      setReviewMessage("");
      return;
    }

    let alive = true;
    setReviewsBusy(true);
    setReviewsError("");
    setReviewMessage("");
    setGameReviews([]);
    setMyReview(null);
    setCanReview(false);

    async function loadGameReviews() {
      const { data: reviewRows, error: reviewQueryError } = await supabase!
        .from("reviews")
        .select("id,user_id,rating,review_text,moderation_status,created_at")
        .eq("game_id", selected!.id)
        .order("created_at", { ascending: false })
        .limit(30);

      if (reviewQueryError) throw reviewQueryError;

      const mappedReviews = (reviewRows ?? []) as PlayerReview[];
      const own = user ? mappedReviews.find((review) => review.user_id === user.id) ?? null : null;

      let entitled = false;
      if (user) {
        const { data: entitlement, error: entitlementError } = await supabase!
          .from("user_library")
          .select("game_id")
          .eq("user_id", user.id)
          .eq("game_id", selected!.id)
          .maybeSingle();

        if (entitlementError) throw entitlementError;
        entitled = Boolean(entitlement);
      }

      if (alive) {
        setGameReviews(mappedReviews);
        setMyReview(own);
        setCanReview(entitled);
        if (own) {
          setReviewRating(own.rating);
          setReviewText(own.review_text ?? "");
        } else {
          setReviewRating(5);
          setReviewText("");
        }
      }
    }

    loadGameReviews()
      .catch((error: unknown) => {
        if (!alive) return;
        setReviewsError(error instanceof Error ? error.message : "Ratings and reviews could not be loaded.");
      })
      .finally(() => {
        if (alive) setReviewsBusy(false);
      });

    return () => { alive = false; };
  }, [selected, user]);

  useEffect(() => {
    if (tab !== "purchases" && tab !== "notifications") return;
    if (!supabase || !user) {
      setPurchases([]);
      setNotifications([]);
      setActivityBusy(false);
      setActivityError("");
      return;
    }

    let alive = true;
    setActivityBusy(true);
    setActivityError("");

    async function loadActivity() {
      if (tab === "purchases") {
        const { data: orderRows, error: orderError } = await supabase!
          .from("marketplace_orders")
          .select("id,reference,game_title_snapshot,amount_minor,currency,status,created_at,paid_at")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(100);

        if (orderError) throw orderError;

        const { data: refundRows, error: refundError } = await supabase!
          .from("refund_requests")
          .select("order_id,status,reason,requested_at")
          .eq("user_id", user!.id);

        if (refundError) throw refundError;

        const refundByOrder = new Map(
          (refundRows ?? []).map((refund) => [
            String(refund.order_id),
            { status: String(refund.status), reason: String(refund.reason) }
          ])
        );

        const items = (orderRows ?? []).map((order) => {
          const refund = refundByOrder.get(String(order.id));
          return {
            id: String(order.id),
            reference: String(order.reference),
            game_title_snapshot: String(order.game_title_snapshot),
            amount_minor: order.amount_minor as number | string,
            currency: String(order.currency),
            status: String(order.status),
            created_at: String(order.created_at),
            paid_at: order.paid_at ? String(order.paid_at) : null,
            refund_status: refund?.status ?? null,
            refund_reason: refund?.reason ?? null
          } satisfies PlayerPurchase;
        });

        if (alive) setPurchases(items);
      } else {
        const { data, error } = await supabase!
          .from("notifications")
          .select("id,notification_type,title,message,read_at,created_at")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;
        if (alive) setNotifications((data ?? []) as PlayerNotification[]);
      }
    }

    loadActivity()
      .catch((error: unknown) => {
        if (!alive) return;
        setActivityError(error instanceof Error ? error.message : "Your account activity could not be loaded.");
      })
      .finally(() => {
        if (alive) setActivityBusy(false);
      });

    return () => { alive = false; };
  }, [tab, user, activityRefresh]);

  const visibleGames = useMemo(() => {
    const source = tab === "wishlist"
      ? games.filter((game) => wishlist.includes(game.id))
      : tab === "library"
        ? libraryGames
        : tab === "discover"
          ? games
          : [];
    const normalizedQuery = query.trim().toLowerCase();

    return source.filter((game) => {
      const matchesGenre = genre === "All" || game.genre.toLowerCase() === genre.toLowerCase();
      const matchesQuery = !normalizedQuery ||
        `${game.title} ${game.genre} ${game.studio} ${game.description}`.toLowerCase().includes(normalizedQuery);
      return matchesGenre && matchesQuery;
    });
  }, [games, libraryGames, genre, query, tab, wishlist]);

  async function toggleWishlist(game: Game) {
    const wasSaved = wishlist.includes(game.id);

    if (supabase && user && !game.id.startsWith("demo-")) {
      const result = wasSaved
        ? await supabase.from("wishlists").delete().eq("user_id", user.id).eq("game_id", game.id)
        : await supabase.from("wishlists").upsert(
            { user_id: user.id, game_id: game.id },
            { onConflict: "user_id,game_id", ignoreDuplicates: true }
          );

      if (result.error) {
        Alert.alert("Wishlist not updated", "Please check your connection and try again.");
        return;
      }
    }

    setWishlist((current) =>
      wasSaved ? current.filter((id) => id !== game.id) : [...current, game.id]
    );
  }

  async function submitGameReview() {
    if (!selected || selected.id.startsWith("demo-") || !supabase || !user) {
      setReviewMessage("Sign in and open a published GAME ON listing to write a review.");
      return;
    }
    if (!canReview) {
      setReviewMessage("Add this game to your library before reviewing it.");
      return;
    }

    const cleanedText = reviewText.trim();
    if (cleanedText.length > 3000) {
      setReviewMessage("Your review must be 3,000 characters or fewer.");
      return;
    }
    if (myReview && !["pending", "rejected"].includes(myReview.moderation_status)) {
      setReviewMessage("This review has already been approved and can no longer be edited.");
      return;
    }

    setReviewSaving(true);
    setReviewMessage("");

    try {
      if (myReview) {
        const { data, error } = await supabase
          .from("reviews")
          .update({
            rating: reviewRating,
            review_text: cleanedText || null,
            moderation_status: "pending"
          })
          .eq("id", myReview.id)
          .eq("user_id", user.id)
          .select("id,user_id,rating,review_text,moderation_status,created_at")
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error("Your review could not be updated. It may already have been moderated.");
        const updated = data as PlayerReview;
        setMyReview(updated);
        setGameReviews((current) => [
          updated,
          ...current.filter((review) => review.id !== updated.id)
        ]);
      } else {
        const { data, error } = await supabase
          .from("reviews")
          .insert({
            user_id: user.id,
            game_id: selected.id,
            rating: reviewRating,
            review_text: cleanedText || null
          })
          .select("id,user_id,rating,review_text,moderation_status,created_at")
          .single();

        if (error) throw error;
        const created = data as PlayerReview;
        setMyReview(created);
        setGameReviews((current) => [created, ...current.filter((review) => review.id !== created.id)]);
      }

      setReviewMessage("Thanks! Your review has been submitted for GAME ON moderation.");
    } catch (error) {
      setReviewMessage(error instanceof Error
        ? error.message
        : "Your review could not be submitted. Please try again.");
    } finally {
      setReviewSaving(false);
    }
  }

  async function markNotificationRead(item: PlayerNotification) {
    if (item.read_at || !supabase || !user) return;

    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("id", item.id)
      .eq("user_id", user.id);

    if (error) {
      Alert.alert("Could not update notification", "Please try again.");
      return;
    }

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === item.id ? { ...notification, read_at: readAt } : notification
      )
    );
  }

  async function addFreeGameToLibrary(game: Game) {
    if (!supabase || !user) {
      setSelected(null);
      setAuthMode("signin");
      setAuthOpen(true);
      return;
    }
    if (game.id.startsWith("demo-")) {
      Alert.alert("Sample listing", "This is a sample game, not a real downloadable title.");
      return;
    }
    if (!["Free", "Free with ads", "Free with optional purchases", "Free demo"].includes(game.monetization)) {
      Alert.alert(
        "Secure checkout required",
        "This is a paid game. GAME ON will only add it to your library after the payment provider has securely confirmed your purchase."
      );
      return;
    }

    const { error } = await supabase
      .from("user_library")
      .upsert(
        { user_id: user.id, game_id: game.id },
        { onConflict: "user_id,game_id", ignoreDuplicates: true }
      );

    if (error) {
      Alert.alert("Could not add game", error.message);
      return;
    }

    setLibraryGames((current) =>
      current.some((item) => item.id === game.id) ? current : [game, ...current]
    );
    if (selected?.id === game.id) setCanReview(true);
    Alert.alert(
      "Added to your library",
      `${game.title} is now in your Game ON library. Secure game downloads will be enabled when the delivery service is connected.`
    );
  }

  async function submitAuth() {
    if (!supabase) {
      Alert.alert(
        "Connect Game ON",
        "The mobile app is ready for a Supabase project. Add the public project URL and publishable key to the app environment to enable accounts."
      );
      return;
    }
    if (!email.trim() || password.length < 8) {
      Alert.alert("Check your details", "Enter a valid email and a password with at least 8 characters.");
      return;
    }

    setAuthBusy(true);
    try {
      const result = authMode === "signup"
        ? await supabase.auth.signUp({ email: email.trim(), password })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });

      if (result.error) throw result.error;

      if (authMode === "signup" && !result.data.session) {
        Alert.alert("Check your inbox", "A confirmation email may be required before you can sign in.");
      } else {
        setAuthOpen(false);
        setPassword("");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please try again.";
      Alert.alert("Account error", message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        Alert.alert("Sign out failed", error.message);
        return;
      }
    }
    setUser(null);
    setAuthOpen(false);
  }

  function openProfile() {
    setAuthMode(user ? "signin" : "signin");
    setAuthOpen(true);
  }

  const isDemo = !isSupabaseConfigured;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.appShell}>
        <View style={styles.header}>
          <View style={styles.brandBlock}>
            <View style={styles.brandMark}><Text style={styles.brandMarkText}>G</Text></View>
            <View>
              <Text style={styles.brandName}>GAME ON</Text>
              <Text style={styles.brandSub}>STORE</Text>
            </View>
          </View>
          <Pressable onPress={openProfile} style={styles.profileButton}>
            <Text style={styles.profileButtonText}>{user ? "MY ACCOUNT" : "SIGN IN"}</Text>
          </Pressable>
        </View>

        <FlatList
          data={tab === "purchases" || tab === "notifications" ? [] : visibleGames}
          keyExtractor={(item) => item.id}
          numColumns={1}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View>
              {tab === "discover" ? (
                <View style={styles.hero}>
                  <View style={styles.heroAccentLine} />
                  <Text style={styles.eyebrow}>GAME ON / DISCOVER</Text>
                  <Text style={styles.heroTitle}>Find your next</Text>
                  <Text style={[styles.heroTitle, styles.heroTitleAccent]}>favourite game.</Text>
                  <Text style={styles.heroCopy}>
                    Browse a growing library of games from independent studios. Save the titles you want to play.
                  </Text>
                  {games.length > 0 ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setSelected(games[0])}
                      style={({ pressed }) => [styles.heroFeature, pressed && styles.pressed]}
                    >
                      <View style={styles.heroFeatureCopy}>
                        <Text style={styles.heroFeatureEyebrow}>FEATURED TITLE</Text>
                        <Text numberOfLines={1} style={styles.heroFeatureTitle}>{games[0].title}</Text>
                        <Text style={styles.heroFeatureMeta}>{games[0].genre} · {games[0].studio}</Text>
                      </View>
                      <View style={styles.heroFeatureAction}>
                        <Text style={styles.heroFeatureActionText}>EXPLORE</Text>
                      </View>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.sectionHeading}>
                <View>
                  <Text style={styles.eyebrowSmall}>EXPLORE THE CATALOGUE</Text>
                  <Text style={styles.sectionTitle}>
                    {tab === "discover" ? "DISCOVER GAMES" : tab === "wishlist" ? "YOUR WISHLIST" : tab === "library" ? "YOUR LIBRARY" : tab === "purchases" ? "PURCHASE HISTORY" : "NOTIFICATIONS"}
                  </Text>
                </View>
                {catalogBusy ? <ActivityIndicator color="#18d9f4" /> : null}
              </View>

              {tab !== "purchases" && tab !== "notifications" ? (
                <>
                  <View style={styles.searchBox}>
                  <Text style={styles.searchIcon}>⌕</Text>
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search games, genres or studios"
                    placeholderTextColor="#718198"
                    style={styles.searchInput}
                    returnKeyType="search"
                    accessibilityLabel="Search games"
                  />
                  {query.length > 0 ? (
                    <Pressable onPress={() => setQuery("")}><Text style={styles.clearSearch}>×</Text></Pressable>
                  ) : null}
                </View>
  
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.genreRow}>
                  {GENRES.map((item) => (
                    <Pressable
                      key={item}
                      onPress={() => setGenre(item)}
                      style={[styles.genreChip, genre === item && styles.genreChipActive]}
                    >
                      <Text style={[styles.genreChipText, genre === item && styles.genreChipTextActive]}>{item}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                </>
              ) : null}

              {tab !== "purchases" && tab !== "notifications" ? (
                <View style={styles.catalogStatus}>
                  <View style={[styles.statusDot, isDemo && styles.statusDotDemo]} />
                  <Text style={styles.catalogStatusText}>{catalogMessage}</Text>
                </View>
              ) : null}

              {tab === "library" && !user ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>🎮</Text>
                  <Text style={styles.emptyTitle}>SIGN IN TO SEE YOUR GAMES</Text>
                  <Text style={styles.emptyCopy}>Your owned games are tied to your Game ON account, so sign in to load your library.</Text>
                  <Pressable onPress={openProfile} style={styles.emptyButton}>
                    <Text style={styles.emptyButtonText}>SIGN IN TO GAME ON</Text>
                  </Pressable>
                </View>
              ) : null}
              {tab === "library" && user && libraryBusy ? (
                <View style={styles.libraryStatus}>
                  <ActivityIndicator color="#18d9f4" />
                  <Text style={styles.libraryStatusText}>LOADING YOUR GAME LIBRARY…</Text>
                </View>
              ) : null}
              {tab === "library" && user && !libraryBusy && libraryError ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>!</Text>
                  <Text style={styles.emptyTitle}>LIBRARY NOT AVAILABLE</Text>
                  <Text style={styles.emptyCopy}>{libraryError}</Text>
                  <Pressable onPress={() => setLibraryRefresh((value) => value + 1)} style={styles.emptyButton}>
                    <Text style={styles.emptyButtonText}>TRY AGAIN</Text>
                  </Pressable>
                </View>
              ) : null}
              {tab === "library" && user && !libraryBusy && !libraryError && libraryGames.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>▣</Text>
                  <Text style={styles.emptyTitle}>YOUR LIBRARY IS READY</Text>
                  <Text style={styles.emptyCopy}>Free games you add and purchases verified by GAME ON will appear here.</Text>
                  <Pressable onPress={() => setTab("discover")} style={styles.emptyButton}>
                    <Text style={styles.emptyButtonText}>EXPLORE THE STORE</Text>
                  </Pressable>
                </View>
              ) : null}
              {tab === "library" && user && !libraryBusy && libraryGames.length > 0 ? (
                <View style={styles.libraryToolbar}>
                  <Text style={styles.resultCount}>{libraryGames.length} GAMES IN YOUR LIBRARY</Text>
                  <Pressable onPress={() => setLibraryRefresh((value) => value + 1)}>
                    <Text style={styles.refreshText}>REFRESH ↻</Text>
                  </Pressable>
                </View>
              ) : null}

              {tab === "purchases" && !user ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>▤</Text>
                  <Text style={styles.emptyTitle}>SIGN IN TO VIEW PURCHASES</Text>
                  <Text style={styles.emptyCopy}>Your purchase history is private to your Game ON account.</Text>
                  <Pressable onPress={openProfile} style={styles.emptyButton}><Text style={styles.emptyButtonText}>SIGN IN TO GAME ON</Text></Pressable>
                </View>
              ) : null}
              {tab === "notifications" && !user ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>♧</Text>
                  <Text style={styles.emptyTitle}>YOUR PLAYER INBOX</Text>
                  <Text style={styles.emptyCopy}>Sign in to see game updates and messages from GAME ON.</Text>
                  <Pressable onPress={openProfile} style={styles.emptyButton}><Text style={styles.emptyButtonText}>SIGN IN TO GAME ON</Text></Pressable>
                </View>
              ) : null}
              {(tab === "purchases" || tab === "notifications") && user && activityBusy ? (
                <View style={styles.libraryStatus}>
                  <ActivityIndicator color="#18d9f4" />
                  <Text style={styles.libraryStatusText}>LOADING YOUR ACCOUNT ACTIVITY…</Text>
                </View>
              ) : null}
              {(tab === "purchases" || tab === "notifications") && user && !activityBusy && activityError ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>!</Text>
                  <Text style={styles.emptyTitle}>COULD NOT LOAD THIS PAGE</Text>
                  <Text style={styles.emptyCopy}>{activityError}</Text>
                  <Pressable onPress={() => setActivityRefresh((value) => value + 1)} style={styles.emptyButton}><Text style={styles.emptyButtonText}>TRY AGAIN</Text></Pressable>
                </View>
              ) : null}
              {tab === "purchases" && user && !activityBusy && !activityError && purchases.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>▤</Text>
                  <Text style={styles.emptyTitle}>NO PURCHASES YET</Text>
                  <Text style={styles.emptyCopy}>Completed purchases will appear here after secure payment verification.</Text>
                  <Pressable onPress={() => setTab("discover")} style={styles.emptyButton}><Text style={styles.emptyButtonText}>EXPLORE THE STORE</Text></Pressable>
                </View>
              ) : null}
              {tab === "purchases" && user && !activityBusy && !activityError && purchases.length > 0 ? (
                <View style={styles.activityList}>
                  <View style={styles.activityToolbar}>
                    <Text style={styles.resultCount}>{purchases.length} PURCHASE RECORDS</Text>
                    <Pressable onPress={() => setActivityRefresh((value) => value + 1)}><Text style={styles.refreshText}>REFRESH ↻</Text></Pressable>
                  </View>
                  {purchases.map((purchase) => (
                    <View key={purchase.id} style={styles.activityCard}>
                      <View style={styles.activityCardTop}>
                        <View style={styles.activityCardTitleBlock}>
                          <Text style={styles.activityCardTitle}>{purchase.game_title_snapshot}</Text>
                          <Text style={styles.activityCardDate}>{dateLabel(purchase.created_at)}</Text>
                        </View>
                        <Text style={[
                          styles.orderStatus,
                          purchase.status === "paid" ? styles.orderStatusPaid : purchase.status === "refunded" ? styles.orderStatusRefunded : styles.orderStatusOther
                        ]}>{purchase.status.toUpperCase()}</Text>
                      </View>
                      <Text style={styles.activityMeta}>REFERENCE  {purchase.reference}</Text>
                      <Text style={styles.purchaseAmount}>{money(Number(purchase.amount_minor), purchase.currency)}</Text>
                      {purchase.refund_status ? (
                        <Text style={styles.refundStatus}>REFUND: {purchase.refund_status.toUpperCase()}</Text>
                      ) : null}
                    </View>
                  ))}
                  <Text style={styles.activityFootnote}>Purchase status is shown from Game ON's server-verified records. This screen cannot confirm or alter payments.</Text>
                </View>
              ) : null}
              {tab === "notifications" && user && !activityBusy && !activityError && notifications.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>♧</Text>
                  <Text style={styles.emptyTitle}>YOU'RE ALL CAUGHT UP</Text>
                  <Text style={styles.emptyCopy}>Game updates and important account messages will show up here.</Text>
                  <Pressable onPress={() => setActivityRefresh((value) => value + 1)} style={styles.emptyButton}><Text style={styles.emptyButtonText}>REFRESH INBOX</Text></Pressable>
                </View>
              ) : null}
              {tab === "notifications" && user && !activityBusy && !activityError && notifications.length > 0 ? (
                <View style={styles.activityList}>
                  <View style={styles.activityToolbar}>
                    <Text style={styles.resultCount}>{notifications.filter((item) => !item.read_at).length} UNREAD NOTIFICATIONS</Text>
                    <Pressable onPress={() => setActivityRefresh((value) => value + 1)}><Text style={styles.refreshText}>REFRESH ↻</Text></Pressable>
                  </View>
                  {notifications.map((item) => (
                    <Pressable key={item.id} onPress={() => { void markNotificationRead(item); }} style={[styles.notificationCard, !item.read_at && styles.notificationUnread]}>
                      <View style={styles.notificationTop}>
                        <Text style={styles.notificationTitle}>{item.title}</Text>
                        <Text style={[styles.notificationReadState, !item.read_at && styles.notificationUnreadText]}>{item.read_at ? "READ" : "NEW"}</Text>
                      </View>
                      <Text style={styles.notificationMessage}>{item.message}</Text>
                      <Text style={styles.activityCardDate}>{dateLabel(item.created_at)} · {item.notification_type.replaceAll("_", " ").toUpperCase()}</Text>
                    </Pressable>
                  ))}
                  <Text style={styles.activityFootnote}>Tap a notification to mark it as read.</Text>
                </View>
              ) : null}

              {tab === "wishlist" && visibleGames.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>♡</Text>
                  <Text style={styles.emptyTitle}>SAVE GAMES FOR LATER</Text>
                  <Text style={styles.emptyCopy}>Tap the heart on a game you like and it will be saved here.</Text>
                  <Pressable onPress={() => setTab("discover")} style={styles.emptyButton}>
                    <Text style={styles.emptyButtonText}>BROWSE GAMES</Text>
                  </Pressable>
                </View>
              ) : null}
              {(tab === "discover" || tab === "wishlist") && visibleGames.length > 0 ? (
                <Text style={styles.resultCount}>{visibleGames.length} GAMES TO EXPLORE</Text>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <GameCard
              game={item}
              saved={wishlist.includes(item.id)}
              owned={tab === "library"}
              onOpen={() => setSelected(item)}
              onToggleSave={() => { void toggleWishlist(item); }}
            />
          )}
          ListEmptyComponent={
            tab === "library" || tab === "wishlist" || tab === "purchases" || tab === "notifications" ? undefined : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>⌕</Text>
                <Text style={styles.emptyTitle}>NO GAMES FOUND</Text>
                <Text style={styles.emptyCopy}>Try another game title or genre.</Text>
              </View>
            )
          }
          ListFooterComponent={<View style={styles.footer}><Text style={styles.footerBrand}>GAME ON <Text style={styles.footerAccent}>STORE</Text></Text><Text style={styles.footerCopy}>A home for games and the people who make them.</Text></View>}
        />

        <View style={styles.tabBar}>
          <TabButton label="DISCOVER" icon="⌕" active={tab === "discover"} onPress={() => setTab("discover")} />
          <TabButton label="LIBRARY" icon="▣" active={tab === "library"} onPress={() => setTab("library")} />
          <TabButton label="WISHLIST" icon="♡" active={tab === "wishlist"} onPress={() => setTab("wishlist")} />
          <TabButton label="PURCHASES" icon="▤" active={tab === "purchases"} onPress={() => setTab("purchases")} />
          <TabButton label="INBOX" icon="♧" active={tab === "notifications"} onPress={() => setTab("notifications")} />
        </View>
      </View>

      <Modal visible={Boolean(selected)} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.detailSheet}>
            <View style={styles.sheetHandle} />
            <Pressable onPress={() => setSelected(null)} style={styles.closeButton}><Text style={styles.closeButtonText}>×</Text></Pressable>
            {selected ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={[styles.detailArtwork, { backgroundColor: selected.accent }]}>
                  <Text style={styles.detailEmoji}>{selected.icon}</Text>
                  <Text style={styles.detailArtworkTitle}>{selected.title.toUpperCase()}</Text>
                </View>
                <View style={styles.detailBody}>
                  <Text style={styles.eyebrowSmall}>{selected.genre.toUpperCase()} · BY {selected.studio.toUpperCase()}</Text>
                  <Text style={styles.detailTitle}>{selected.title}</Text>
                  <Text style={styles.detailDescription}>{selected.description}</Text>
                  <View style={styles.detailFacts}>
                    <Fact label="PRICE" value={money(selected.priceMinor, selected.currency)} />
                    <Fact label="PLATFORMS" value={selected.platforms.join(", ")} />
                    <Fact label="PLAY MODE" value={selected.offline ? "Offline supported" : "Online"} />
                    <Fact label="MONETIZATION" value={selected.monetization} />
                  </View>
                  {libraryGames.some((item) => item.id === selected.id) ? (
                    <View style={styles.ownedNotice}>
                      <Text style={styles.ownedNoticeTitle}>✓  IN YOUR GAME ON LIBRARY</Text>
                      <Text style={styles.ownedNoticeCopy}>Your ownership is linked to your account. Secure downloads will be available when the game-delivery service is connected.</Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => { void addFreeGameToLibrary(selected); }}
                      style={styles.primaryButton}
                    >
                      <Text style={styles.primaryButtonText}>
                        {["Free", "Free with ads", "Free with optional purchases", "Free demo"].includes(selected.monetization)
                          ? "ADD TO LIBRARY  →"
                          : "PURCHASE NOT YET AVAILABLE"}
                      </Text>
                    </Pressable>
                  )}
                  <Pressable onPress={() => { void toggleWishlist(selected); }} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>
                      {wishlist.includes(selected.id) ? "♥  SAVED TO WISHLIST" : "♡  ADD TO WISHLIST"}
                    </Text>
                  </Pressable>
                  <View style={styles.reviewSection}>
                    <View style={styles.reviewSectionHeading}>
                      <View>
                        <Text style={styles.eyebrowSmall}>PLAYER FEEDBACK</Text>
                        <Text style={styles.reviewSectionTitle}>RATINGS & REVIEWS</Text>
                      </View>
                      {gameReviews.some((review) => review.moderation_status === "approved") ? (
                        <Text style={styles.reviewAverage}>
                          {(gameReviews.filter((review) => review.moderation_status === "approved").reduce((sum, review) => sum + review.rating, 0) /
                            gameReviews.filter((review) => review.moderation_status === "approved").length).toFixed(1)} / 5
                        </Text>
                      ) : null}
                    </View>

                    {reviewsBusy ? (
                      <View style={styles.reviewLoading}>
                        <ActivityIndicator color="#18d9f4" />
                        <Text style={styles.reviewHint}>LOADING PLAYER REVIEWS…</Text>
                      </View>
                    ) : reviewsError ? (
                      <Text style={styles.reviewMessageError}>{reviewsError}</Text>
                    ) : (
                      <>
                        {gameReviews.filter((review) =>
                          review.moderation_status === "approved" ||
                          (user && review.user_id === user.id)
                        ).length > 0 ? (
                          <View style={styles.reviewCards}>
                            {gameReviews.filter((review) =>
                              review.moderation_status === "approved" ||
                              (user && review.user_id === user.id)
                            ).map((review) => (
                              <View key={review.id} style={styles.reviewCard}>
                                <View style={styles.reviewCardTop}>
                                  <Text style={styles.reviewStars}>
                                    {"★".repeat(review.rating)}{"☆".repeat(Math.max(0, 5 - review.rating))}
                                  </Text>
                                  {review.user_id === user?.id && review.moderation_status !== "approved" ? (
                                    <Text style={styles.reviewPending}>{review.moderation_status.toUpperCase()}</Text>
                                  ) : null}
                                </View>
                                <Text style={styles.reviewAuthor}>
                                  {review.user_id === user?.id ? "YOUR REVIEW" : "GAME ON PLAYER"}
                                </Text>
                                {review.review_text ? (
                                  <Text style={styles.reviewBody}>{review.review_text}</Text>
                                ) : (
                                  <Text style={styles.reviewBodyMuted}>Rating only</Text>
                                )}
                                <Text style={styles.activityCardDate}>{dateLabel(review.created_at)}</Text>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text style={styles.reviewHint}>No approved player reviews yet. Be the first eligible player to rate this game.</Text>
                        )}

                        {!user ? (
                          <Pressable onPress={openProfile} style={styles.secondaryButton}>
                            <Text style={styles.secondaryButtonText}>SIGN IN TO WRITE A REVIEW</Text>
                          </Pressable>
                        ) : canReview && (!myReview || ["pending", "rejected"].includes(myReview.moderation_status)) ? (
                          <View style={styles.reviewForm}>
                            <Text style={styles.reviewFormTitle}>{myReview ? "UPDATE YOUR REVIEW" : "RATE THIS GAME"}</Text>
                            <View style={styles.ratingPicker}>
                              {[1, 2, 3, 4, 5].map((value) => (
                                <Pressable
                                  key={value}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Rate ${value} out of 5 stars`}
                                  onPress={() => setReviewRating(value)}
                                  style={styles.ratingStarButton}
                                >
                                  <Text style={[styles.ratingStar, value <= reviewRating && styles.ratingStarSelected]}>★</Text>
                                </Pressable>
                              ))}
                            </View>
                            <TextInput
                              value={reviewText}
                              onChangeText={setReviewText}
                              placeholder="Share a helpful, respectful review (optional)"
                              placeholderTextColor="#718198"
                              style={styles.reviewInput}
                              multiline
                              maxLength={3000}
                              textAlignVertical="top"
                              accessibilityLabel="Write your game review"
                            />
                            <Pressable
                              disabled={reviewSaving}
                              onPress={() => { void submitGameReview(); }}
                              style={[styles.primaryButton, reviewSaving && styles.buttonDisabled]}
                            >
                              {reviewSaving
                                ? <ActivityIndicator color="#06111e" />
                                : <Text style={styles.primaryButtonText}>{myReview ? "RESUBMIT REVIEW" : "SUBMIT REVIEW"}</Text>}
                            </Pressable>
                            <Text style={styles.reviewHint}>Only players with this game in their library can review it. New and edited reviews are checked by GAME ON before publication.</Text>
                            {reviewMessage ? <Text style={styles.reviewMessage}>{reviewMessage}</Text> : null}
                          </View>
                        ) : myReview?.moderation_status === "approved" ? (
                          <Text style={styles.reviewHint}>Your review is approved. Approved reviews are locked to preserve the moderation record.</Text>
                        ) : (
                          <Text style={styles.reviewHint}>Add this game to your library to unlock player ratings and reviews.</Text>
                        )}
                      </>
                    )}
                  </View>
                  <Text style={styles.disclaimer}>Sample catalogue entries are for interface testing only. They are not live listings or downloadable game files.</Text>
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal visible={authOpen} animationType="slide" transparent onRequestClose={() => setAuthOpen(false)}>
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.authSheet}>
            <View style={styles.sheetHandle} />
            <Pressable onPress={() => setAuthOpen(false)} style={styles.closeButton}><Text style={styles.closeButtonText}>×</Text></Pressable>
            <Text style={styles.eyebrowSmall}>WELCOME TO GAME ON</Text>
            <Text style={styles.authTitle}>{user ? "YOUR ACCOUNT" : authMode === "signup" ? "CREATE ACCOUNT" : "WELCOME BACK"}</Text>
            {user ? (
              <View style={styles.signedInBlock}>
                <Text style={styles.accountEmail}>{user.email ?? "Signed in"}</Text>
                <Text style={styles.authHint}>Your Game ON account is connected.</Text>
                <Pressable onPress={() => { void signOut(); }} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>SIGN OUT</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={styles.authHint}>Use your Game ON account to keep your games and wishlist together.</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email address"
                  placeholderTextColor="#718198"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  style={styles.authInput}
                />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password (at least 8 characters)"
                  placeholderTextColor="#718198"
                  secureTextEntry
                  autoCapitalize="none"
                  style={styles.authInput}
                />
                <Pressable disabled={authBusy} onPress={() => { void submitAuth(); }} style={[styles.primaryButton, authBusy && styles.buttonDisabled]}>
                  {authBusy ? <ActivityIndicator color="#06111e" /> : <Text style={styles.primaryButtonText}>{authMode === "signup" ? "CREATE MY ACCOUNT" : "SIGN IN"}</Text>}
                </Pressable>
                <Pressable onPress={() => setAuthMode(authMode === "signup" ? "signin" : "signup")} style={styles.switchAuth}>
                  <Text style={styles.switchAuthText}>{authMode === "signup" ? "Already have an account? Sign in" : "New to Game ON? Create an account"}</Text>
                </Pressable>
              </>
            )}
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function TabButton({
  label,
  icon,
  active,
  onPress
}: {
  label: string;
  icon: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tabButton, active && styles.tabButtonActive]}>
      <Text style={[styles.tabIcon, active && styles.tabIconActive]}>{icon}</Text>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.factBox}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#070b14" },
  appShell: { flex: 1, backgroundColor: "#070b14" },
  header: {
    minHeight: 82, paddingHorizontal: 20, flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#23445c",
    backgroundColor: "#080f1c"
  },
  brandBlock: { flexDirection: "row", alignItems: "center", gap: 11 },
  brandMark: {
    width: 42, height: 42, borderRadius: 10, backgroundColor: "#102d40",
    borderWidth: 1, borderColor: "#18d9f4", alignItems: "center", justifyContent: "center"
  },
  brandMarkText: { color: "#18d9f4", fontSize: 26, fontWeight: "900" },
  brandName: { color: "#f0f7ff", fontWeight: "900", fontSize: 18, letterSpacing: 2 },
  brandSub: { color: "#18d9f4", fontWeight: "800", fontSize: 9, letterSpacing: 4, marginTop: 2 },
  profileButton: { borderWidth: 1, borderColor: "#1a9db5", backgroundColor: "#0b1e2b", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12 },
  profileButtonText: { color: "#bceff6", fontWeight: "800", fontSize: 9, letterSpacing: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 24 },
  hero: {
    borderRadius: 22, padding: 22, marginBottom: 24, minHeight: 260,
    backgroundColor: "#111a29", borderWidth: 1, borderColor: "#2a3b50",
    justifyContent: "center", overflow: "hidden"
  },
  heroGlow: { position: "absolute", width: 230, height: 230, borderRadius: 115, right: -92, top: -115, backgroundColor: "#174b70", opacity: 0.58 },
  heroOrbit: { position: "absolute", width: 170, height: 170, borderRadius: 85, right: -35, top: -45, borderWidth: 1, borderColor: "rgba(24,217,244,0.24)" },
  heroAccentLine: { width: 36, height: 3, borderRadius: 2, backgroundColor: "#18d9f4", marginBottom: 17 },
  heroFeature: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 20, padding: 15, borderRadius: 13, borderWidth: 1, borderColor: "#304961", backgroundColor: "#0b1421" },
  heroFeatureCopy: { flex: 1 },
  heroFeatureEyebrow: { color: "#83eafa", fontSize: 8, fontWeight: "900", letterSpacing: 1.4 },
  heroFeatureTitle: { color: "#f4f8ff", fontSize: 15, fontWeight: "900", marginTop: 5 },
  heroFeatureMeta: { color: "#9aafc6", fontSize: 9, marginTop: 3 },
  heroFeatureAction: { borderRadius: 8, backgroundColor: "#18d9f4", paddingHorizontal: 14, paddingVertical: 11 },
  heroFeatureActionText: { color: "#06111e", fontSize: 8, fontWeight: "900", letterSpacing: 0.7 },
  eyebrow: { color: "#18d9f4", fontSize: 9, fontWeight: "900", letterSpacing: 2, marginBottom: 13 },
  heroTitle: { color: "#f2f7ff", fontSize: 32, lineHeight: 37, fontWeight: "800", letterSpacing: -0.7 },
  heroTitleAccent: { color: "#18d9f4" },
  heroCopy: { color: "#a8bbcc", fontSize: 12, lineHeight: 19, maxWidth: 290, marginTop: 12 },
  heroPills: { flexDirection: "row", gap: 8, marginTop: 16 },
  heroPill: { color: "#d4faff", fontSize: 8, fontWeight: "800", letterSpacing: 1.5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 5, overflow: "hidden", backgroundColor: "#123e52" },
  sectionHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 },
  eyebrowSmall: { color: "#18d9f4", fontSize: 8, fontWeight: "900", letterSpacing: 1.8, marginBottom: 5 },
  sectionTitle: { color: "#f0f6ff", fontSize: 22, fontWeight: "800", letterSpacing: 0 },
  searchBox: {
    minHeight: 48, flexDirection: "row", alignItems: "center", paddingHorizontal: 13,
    borderRadius: 14, borderWidth: 1, borderColor: "#29435d", backgroundColor: "#0c1421"
  },
  searchIcon: { color: "#18d9f4", fontSize: 24, marginRight: 9 },
  searchInput: { flex: 1, color: "#f0f6ff", fontSize: 12, paddingVertical: 10 },
  clearSearch: { color: "#18d9f4", fontSize: 23, paddingHorizontal: 4 },
  genreRow: { gap: 8, paddingVertical: 15 },
  genreChip: { borderWidth: 1, borderColor: "#27374c", backgroundColor: "#0b1320", borderRadius: 7, paddingHorizontal: 12, paddingVertical: 8 },
  genreChipActive: { borderColor: "#18d9f4", backgroundColor: "#103042" },
  genreChipText: { color: "#97a9bd", fontSize: 10, fontWeight: "700" },
  genreChipTextActive: { color: "#bdf7ff" },
  catalogStatus: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  statusDot: { width: 6, height: 6, borderRadius: 6, backgroundColor: "#8eea37" },
  statusDotDemo: { backgroundColor: "#e7ad46" },
  catalogStatusText: { color: "#8294a8", fontSize: 8, letterSpacing: 1.1, fontWeight: "800", flex: 1 },
  resultCount: { color: "#7e92a9", fontWeight: "800", fontSize: 8, letterSpacing: 1.5, marginBottom: 10 },
  libraryToolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  libraryStatus: { minHeight: 110, alignItems: "center", justifyContent: "center", gap: 12 },
  libraryStatusText: { color: "#91a5bb", fontSize: 9, fontWeight: "800", letterSpacing: 1.2 },
  activityList: { gap: 10, marginTop: 4 },
  activityToolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  activityCard: { borderWidth: 1, borderColor: "#23364c", borderRadius: 11, backgroundColor: "#0d1827", padding: 14 },
  activityCardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  activityCardTitleBlock: { flex: 1 },
  activityCardTitle: { color: "#f0f7ff", fontSize: 14, fontWeight: "800" },
  activityCardDate: { color: "#7f93a9", fontSize: 9, marginTop: 5 },
  activityMeta: { color: "#778ca4", fontSize: 8, letterSpacing: 0.9, marginTop: 12 },
  purchaseAmount: { color: "#bfefff", fontSize: 17, fontWeight: "900", marginTop: 8 },
  orderStatus: { fontSize: 8, fontWeight: "900", letterSpacing: 0.9, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 5, overflow: "hidden" },
  orderStatusPaid: { color: "#a7e6bd", backgroundColor: "#17372b" },
  orderStatusRefunded: { color: "#f0c28a", backgroundColor: "#3a2b1b" },
  orderStatusOther: { color: "#b8c8d9", backgroundColor: "#263548" },
  refundStatus: { color: "#e6bd89", fontSize: 9, fontWeight: "800", marginTop: 10 },
  activityFootnote: { color: "#657990", fontSize: 9, lineHeight: 15, marginTop: 3, marginBottom: 12 },
  notificationCard: { borderWidth: 1, borderColor: "#23364c", borderRadius: 11, backgroundColor: "#0d1827", padding: 14 },
  notificationUnread: { borderColor: "#18647a", backgroundColor: "#0d202e" },
  notificationTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  notificationTitle: { color: "#f0f7ff", fontSize: 13, fontWeight: "800", flex: 1 },
  notificationReadState: { color: "#8295aa", fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  notificationUnreadText: { color: "#18d9f4" },
  notificationMessage: { color: "#9fb0c3", fontSize: 11, lineHeight: 18, marginTop: 8 },
  refreshText: { color: "#18d9f4", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  reviewSection: { marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: "#23354a" },
  reviewSectionHeading: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14 },
  reviewSectionTitle: { color: "#f0f7ff", fontSize: 20, fontWeight: "900", letterSpacing: 0.5 },
  reviewAverage: { color: "#bfefff", fontSize: 17, fontWeight: "900" },
  reviewLoading: { minHeight: 70, alignItems: "center", justifyContent: "center", gap: 8 },
  reviewHint: { color: "#8195aa", fontSize: 9, lineHeight: 15, marginTop: 10 },
  reviewCards: { gap: 9, marginBottom: 14 },
  reviewCard: { backgroundColor: "#101b2a", borderWidth: 1, borderColor: "#25384d", borderRadius: 9, padding: 12 },
  reviewCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  reviewStars: { color: "#f3c56d", fontSize: 16, letterSpacing: 2 },
  reviewPending: { color: "#e9bd80", fontSize: 8, fontWeight: "900", letterSpacing: 0.9 },
  reviewAuthor: { color: "#18d9f4", fontSize: 8, fontWeight: "900", letterSpacing: 1.1, marginTop: 8 },
  reviewBody: { color: "#c1cfdd", fontSize: 11, lineHeight: 17, marginTop: 7 },
  reviewBodyMuted: { color: "#788da4", fontSize: 10, fontStyle: "italic", marginTop: 7 },
  reviewForm: { marginTop: 14, padding: 13, borderWidth: 1, borderColor: "#1c5063", borderRadius: 10, backgroundColor: "#0c1c2a" },
  reviewFormTitle: { color: "#e9f6ff", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  ratingPicker: { flexDirection: "row", gap: 9, marginTop: 12, marginBottom: 12 },
  ratingStarButton: { padding: 4 },
  ratingStar: { color: "#52677e", fontSize: 27 },
  ratingStarSelected: { color: "#f3c56d" },
  reviewInput: { minHeight: 100, borderWidth: 1, borderColor: "#293c53", backgroundColor: "#07101c", borderRadius: 8, padding: 11, color: "#edf6ff", fontSize: 11, lineHeight: 17 },
  reviewMessage: { color: "#a6e6c2", fontSize: 10, lineHeight: 15, marginTop: 9 },
  reviewMessageError: { color: "#f1a3a3", fontSize: 10, lineHeight: 15, marginTop: 8 },
  ownedNotice: { borderWidth: 1, borderColor: "#366b59", borderRadius: 9, backgroundColor: "#10251f", padding: 14, marginTop: 18 },
  ownedNoticeTitle: { color: "#9be3bb", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  ownedNoticeCopy: { color: "#a3b9ae", fontSize: 10, lineHeight: 16, marginTop: 7 },
  gameCard: { backgroundColor: "#0d1728", borderWidth: 1, borderColor: "#29435d", borderRadius: 19, overflow: "hidden", marginBottom: 18, elevation: 3 },
  gameArtwork: { height: 174, padding: 18, justifyContent: "space-between", alignItems: "flex-start", overflow: "hidden" },
  artTopLine: { width: "100%", flexDirection: "row", justifyContent: "space-between", zIndex: 1 },
  artworkGlow: { position: "absolute", width: 190, height: 190, borderRadius: 95, right: -55, top: -95, borderWidth: 2, borderColor: "rgba(255,255,255,0.22)" },
  artworkOrb: { position: "absolute", width: 105, height: 105, borderRadius: 53, left: -34, bottom: -50, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", backgroundColor: "rgba(255,255,255,0.06)" },
  artLabel: { color: "rgba(255,255,255,0.72)", fontSize: 8, fontWeight: "900", letterSpacing: 1.3 },
  artPlatform: { color: "rgba(255,255,255,0.72)", fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  gameCoverMark: { width: 62, height: 62, borderWidth: 1, borderColor: "rgba(255,255,255,0.36)", backgroundColor: "rgba(7,15,27,0.24)", borderRadius: 16, alignItems: "center", justifyContent: "center" },
  gameCoverInitial: { color: "#ffffff", fontSize: 29, fontWeight: "800", letterSpacing: -1 },
  gameCoverCaption: { alignItems: "flex-start", gap: 4 },
  artTitle: { color: "#ffffff", fontSize: 20, fontWeight: "800", letterSpacing: 0 },
  artSubtitle: { color: "rgba(255,255,255,0.72)", fontSize: 8, fontWeight: "700", letterSpacing: 1.2 },
  gameInfo: { paddingHorizontal: 17, paddingTop: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  gameInfoMain: { flex: 1, paddingRight: 10 },
  gameTitle: { color: "#f0f7ff", fontSize: 15, fontWeight: "800" },
  gameStudio: { color: "#8194aa", fontSize: 10, marginTop: 4 },
  heartButton: { width: 37, height: 37, borderRadius: 9, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#293a50", backgroundColor: "#101c2b" },
  heartButtonSaved: { borderColor: "#8e4567", backgroundColor: "#351c31" },
  heart: { color: "#9eafc2", fontSize: 22 },
  heartSaved: { color: "#ff709d" },
  gameTags: { flexDirection: "row", flexWrap: "wrap", gap: 7, paddingHorizontal: 14, marginTop: 12 },
  tag: { color: "#aab8c9", fontSize: 9, fontWeight: "700", letterSpacing: 0.2, paddingHorizontal: 9, paddingVertical: 6, borderWidth: 1, borderColor: "#293a4f", borderRadius: 6 },
  detailsLink: { alignSelf: "flex-start", marginHorizontal: 14, marginTop: 14, marginBottom: 14, paddingVertical: 5 },
  detailsLinkText: { color: "#18d9f4", fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
  tabBar: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#23445c", backgroundColor: "#080f1b", paddingHorizontal: 4, paddingBottom: Platform.OS === "ios" ? 5 : 10, paddingTop: 10 },
  tabButton: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 7, marginHorizontal: 3, borderRadius: 11 },
  tabButtonActive: { backgroundColor: "#103044", borderWidth: 1, borderColor: "#18d9f4" },
  tabIcon: { color: "#71849c", fontSize: 20 },
  tabIconActive: { color: "#18d9f4" },
  tabLabel: { color: "#71849c", fontSize: 8, fontWeight: "800", letterSpacing: 1 },
  tabLabelActive: { color: "#b9f7ff" },
  emptyState: { borderWidth: 1, borderColor: "#26384e", borderStyle: "dashed", borderRadius: 13, padding: 24, alignItems: "center", marginVertical: 12 },
  emptyIcon: { color: "#18d9f4", fontSize: 34, marginBottom: 8 },
  emptyTitle: { color: "#f0f7ff", fontSize: 14, fontWeight: "900", letterSpacing: 0.8, textAlign: "center" },
  emptyCopy: { color: "#899bb0", fontSize: 11, lineHeight: 18, textAlign: "center", marginTop: 8, maxWidth: 280 },
  emptyButton: { paddingHorizontal: 14, paddingVertical: 11, backgroundColor: "#10384b", borderColor: "#176f89", borderWidth: 1, borderRadius: 8, marginTop: 16 },
  emptyButtonText: { color: "#c5f8ff", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  footer: { borderTopWidth: 1, borderTopColor: "#1b2b3d", paddingTop: 20, marginTop: 25, paddingBottom: 8 },
  footerBrand: { color: "#f2f7ff", fontSize: 17, fontWeight: "900", letterSpacing: 2 },
  footerAccent: { color: "#18d9f4" },
  footerCopy: { color: "#8192a7", fontSize: 10, marginTop: 6 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.74)", justifyContent: "flex-end" },
  detailSheet: { height: "91%", backgroundColor: "#0b1422", borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: "#1e3a51" },
  sheetHandle: { width: 42, height: 4, borderRadius: 3, backgroundColor: "#45566b", alignSelf: "center", marginTop: 9, marginBottom: 8 },
  closeButton: { position: "absolute", right: 15, top: 13, zIndex: 3, width: 34, height: 34, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  closeButtonText: { color: "#ffffff", fontSize: 25, lineHeight: 28 },
  detailArtwork: { height: 190, alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 },
  detailEmoji: { fontSize: 61 },
  detailArtworkTitle: { color: "#ffffff", fontSize: 25, fontWeight: "900", letterSpacing: 1.3 },
  detailBody: { padding: 22 },
  detailTitle: { color: "#f3f8ff", fontSize: 29, fontWeight: "900", marginTop: 4 },
  detailDescription: { color: "#a9b9ca", fontSize: 13, lineHeight: 21, marginTop: 9 },
  detailFacts: { flexDirection: "row", flexWrap: "wrap", gap: 1, borderWidth: 1, borderColor: "#23354a", marginTop: 20, backgroundColor: "#23354a" },
  factBox: { width: "49.8%", minHeight: 69, backgroundColor: "#111d2d", padding: 11, justifyContent: "center" },
  factLabel: { color: "#7f93a9", fontSize: 8, fontWeight: "900", letterSpacing: 1.4 },
  factValue: { color: "#f0f7ff", fontSize: 11, fontWeight: "700", marginTop: 6 },
  primaryButton: { minHeight: 47, alignItems: "center", justifyContent: "center", backgroundColor: "#18d9f4", borderRadius: 8, marginTop: 18 },
  primaryButtonText: { color: "#06111e", fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  secondaryButton: { minHeight: 45, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#265168", borderRadius: 8, marginTop: 10, backgroundColor: "#0e2030" },
  secondaryButtonText: { color: "#bdeef5", fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  disclaimer: { color: "#687d94", fontSize: 9, lineHeight: 15, marginTop: 15 },
  authSheet: { backgroundColor: "#0b1422", borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: "#1e3a51", padding: 23, paddingBottom: 34 },
  authTitle: { color: "#f3f8ff", fontSize: 25, fontWeight: "900", marginTop: 4, marginBottom: 10 },
  authHint: { color: "#94a8be", fontSize: 11, lineHeight: 18, marginBottom: 16 },
  authInput: { minHeight: 48, borderWidth: 1, borderColor: "#293b50", backgroundColor: "#07101c", color: "#f0f7ff", borderRadius: 8, paddingHorizontal: 13, marginBottom: 11, fontSize: 12 },
  switchAuth: { alignItems: "center", paddingVertical: 16 },
  switchAuthText: { color: "#18d9f4", fontSize: 10, fontWeight: "700" },
  signedInBlock: { marginTop: 14 },
  accountEmail: { color: "#e9f4ff", fontSize: 14, fontWeight: "700", marginBottom: 6 },
  buttonDisabled: { opacity: 0.55 },
  pressed: { opacity: 0.82 }
});
