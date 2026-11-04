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

type Tab = "discover" | "library" | "wishlist";
type AuthMode = "signin" | "signup";

const GENRES = ["All", "Action", "Adventure", "Casual", "Puzzle", "Racing", "Strategy"];
const WISHLIST_KEY = "gameon.store.wishlist.v1";

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
  onOpen,
  onToggleSave
}: {
  game: Game;
  saved: boolean;
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
        <Text style={styles.gameEmoji}>{game.icon}</Text>
        <Text numberOfLines={1} style={styles.artTitle}>{game.title.toUpperCase()}</Text>
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
        <Text style={styles.tag}>{money(game.priceMinor, game.currency)}</Text>
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
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("All");
  const [selected, setSelected] = useState<Game | null>(null);
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
      })
      .catch(() => {
        if (!alive) return;
        setCatalogMessage("Connection issue. Showing sample listings instead.");
        setCatalogBusy(false);
      });

    return () => { alive = false; };
  }, []);

  const visibleGames = useMemo(() => {
    const source = tab === "wishlist"
      ? games.filter((game) => wishlist.includes(game.id))
      : tab === "library"
        ? games.filter((game) => false)
        : games;
    const normalizedQuery = query.trim().toLowerCase();

    return source.filter((game) => {
      const matchesGenre = genre === "All" || game.genre.toLowerCase() === genre.toLowerCase();
      const matchesQuery = !normalizedQuery ||
        `${game.title} ${game.genre} ${game.studio} ${game.description}`.toLowerCase().includes(normalizedQuery);
      return matchesGenre && matchesQuery;
    });
  }, [games, genre, query, tab, wishlist]);

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
      <StatusBar barStyle="light-content" backgroundColor="#070b14" />
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
          data={visibleGames}
          keyExtractor={(item) => item.id}
          numColumns={1}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View>
              <View style={styles.hero}>
                <Text style={styles.eyebrow}>YOUR NEXT ADVENTURE STARTS HERE</Text>
                <Text style={styles.heroTitle}>PLAY MORE.</Text>
                <Text style={[styles.heroTitle, styles.heroTitleAccent]}>DISCOVER MORE.</Text>
                <Text style={styles.heroCopy}>
                  Find your next favourite game. Explore worlds made by independent creators.
                </Text>
                <View style={styles.heroPills}>
                  <Text style={styles.heroPill}>DISCOVER</Text>
                  <Text style={styles.heroPill}>SAVE</Text>
                  <Text style={styles.heroPill}>PLAY</Text>
                </View>
              </View>

              <View style={styles.sectionHeading}>
                <View>
                  <Text style={styles.eyebrowSmall}>THE GAME ON UNIVERSE</Text>
                  <Text style={styles.sectionTitle}>
                    {tab === "discover" ? "DISCOVER GAMES" : tab === "wishlist" ? "YOUR WISHLIST" : "YOUR LIBRARY"}
                  </Text>
                </View>
                {catalogBusy ? <ActivityIndicator color="#18d9f4" /> : null}
              </View>

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

              <View style={styles.catalogStatus}>
                <View style={[styles.statusDot, isDemo && styles.statusDotDemo]} />
                <Text style={styles.catalogStatusText}>{catalogMessage}</Text>
              </View>

              {tab === "library" ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>🎮</Text>
                  <Text style={styles.emptyTitle}>YOUR LIBRARY IS WAITING</Text>
                  <Text style={styles.emptyCopy}>Purchased and downloaded games will appear here once secure checkout and game delivery are connected.</Text>
                  <Pressable onPress={() => setTab("discover")} style={styles.emptyButton}>
                    <Text style={styles.emptyButtonText}>EXPLORE THE STORE</Text>
                  </Pressable>
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
              {tab !== "library" && visibleGames.length > 0 ? (
                <Text style={styles.resultCount}>{visibleGames.length} GAMES TO EXPLORE</Text>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <GameCard
              game={item}
              saved={wishlist.includes(item.id)}
              onOpen={() => setSelected(item)}
              onToggleSave={() => { void toggleWishlist(item); }}
            />
          )}
          ListEmptyComponent={
            tab === "library" || tab === "wishlist" ? null : (
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
                  <Pressable
                    onPress={() => {
                      Alert.alert(
                        "Not available yet",
                        "Secure purchases and verified game downloads are being connected to the Game ON backend. This sample listing cannot be purchased."
                      );
                    }}
                    style={styles.primaryButton}
                  >
                    <Text style={styles.primaryButtonText}>GET THIS GAME  →</Text>
                  </Pressable>
                  <Pressable onPress={() => { void toggleWishlist(selected); }} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>
                      {wishlist.includes(selected.id) ? "♥  SAVED TO WISHLIST" : "♡  ADD TO WISHLIST"}
                    </Text>
                  </Pressable>
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
    <Pressable onPress={onPress} style={styles.tabButton}>
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
    minHeight: 72, paddingHorizontal: 20, flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#1a2a3d"
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
  listContent: { paddingHorizontal: 18, paddingTop: 22, paddingBottom: 22 },
  hero: {
    borderRadius: 18, padding: 23, marginBottom: 28, minHeight: 205,
    backgroundColor: "#0d2335", borderWidth: 1, borderColor: "#173a53",
    justifyContent: "center"
  },
  eyebrow: { color: "#18d9f4", fontSize: 9, fontWeight: "900", letterSpacing: 2, marginBottom: 13 },
  heroTitle: { color: "#f2f7ff", fontSize: 35, lineHeight: 37, fontWeight: "900", letterSpacing: -1 },
  heroTitleAccent: { color: "#18d9f4" },
  heroCopy: { color: "#a8bbcc", fontSize: 12, lineHeight: 19, maxWidth: 290, marginTop: 12 },
  heroPills: { flexDirection: "row", gap: 8, marginTop: 16 },
  heroPill: { color: "#d4faff", fontSize: 8, fontWeight: "800", letterSpacing: 1.5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 5, overflow: "hidden", backgroundColor: "#123e52" },
  sectionHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 },
  eyebrowSmall: { color: "#18d9f4", fontSize: 8, fontWeight: "900", letterSpacing: 1.8, marginBottom: 5 },
  sectionTitle: { color: "#f0f6ff", fontSize: 23, fontWeight: "900", letterSpacing: 0.5 },
  searchBox: {
    minHeight: 48, flexDirection: "row", alignItems: "center", paddingHorizontal: 13,
    borderRadius: 9, borderWidth: 1, borderColor: "#23344b", backgroundColor: "#0c1421"
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
  gameCard: { backgroundColor: "#0d1625", borderWidth: 1, borderColor: "#1a2a3d", borderRadius: 13, overflow: "hidden", marginBottom: 15 },
  gameArtwork: { height: 164, padding: 15, justifyContent: "space-between", alignItems: "center" },
  artTopLine: { width: "100%", flexDirection: "row", justifyContent: "space-between" },
  artLabel: { color: "rgba(255,255,255,0.72)", fontSize: 8, fontWeight: "900", letterSpacing: 1.3 },
  artPlatform: { color: "rgba(255,255,255,0.72)", fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  gameEmoji: { fontSize: 55, textShadowColor: "rgba(0,0,0,0.35)", textShadowRadius: 12 },
  artTitle: { color: "#ffffff", fontSize: 21, fontWeight: "900", letterSpacing: 1, textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 8 },
  gameInfo: { paddingHorizontal: 14, paddingTop: 13, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  gameInfoMain: { flex: 1, paddingRight: 10 },
  gameTitle: { color: "#f0f7ff", fontSize: 15, fontWeight: "800" },
  gameStudio: { color: "#8194aa", fontSize: 10, marginTop: 4 },
  heartButton: { width: 37, height: 37, borderRadius: 9, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#293a50", backgroundColor: "#101c2b" },
  heartButtonSaved: { borderColor: "#8e4567", backgroundColor: "#351c31" },
  heart: { color: "#9eafc2", fontSize: 22 },
  heartSaved: { color: "#ff709d" },
  gameTags: { flexDirection: "row", flexWrap: "wrap", gap: 7, paddingHorizontal: 14, marginTop: 12 },
  tag: { color: "#9cacc0", fontSize: 8, fontWeight: "800", letterSpacing: 0.7, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderColor: "#25374b", borderRadius: 5 },
  detailsLink: { alignSelf: "flex-start", marginHorizontal: 14, marginTop: 14, marginBottom: 14, paddingVertical: 5 },
  detailsLinkText: { color: "#18d9f4", fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
  tabBar: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#1b2b3d", backgroundColor: "#080f1b", paddingBottom: Platform.OS === "ios" ? 4 : 8, paddingTop: 8 },
  tabButton: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 5 },
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
