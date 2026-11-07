export type GamePlatformDetail = {
  platform: string;
  official_access_url: string | null;
  official_access_url_verified_at: string | null;
  download_size_bytes: number | null;
  download_size_verified_at: string | null;
  internet_requirement: "unknown" | "offline" | "online" | "both";
  internet_requirement_verified_at: string | null;
  minimum_requirements: Record<string, unknown>;
  minimum_requirements_verified_at: string | null;
};

export type Game = {
  id: string; title: string; slug: string; genre: string; description: string;
  studio: string; platforms: string[]; monetization: string; offline: boolean;
  internetRequirement?: string; platformDetails?: GamePlatformDetail[];
  supportedLanguages?: string[]; ageRating?: string | null;
  ads: boolean; iap: boolean; priceMinor: number | null; currency: string;
  rating: number; accent: string; icon: string; featured?: boolean;
};

// Fictional demonstration listings. Replace with approved live catalogue records.
export const demoGames: Game[] = [
  { id: "demo-neon-drift", title: "Neon Drift", slug: "neon-drift", genre: "Racing", description: "Race through a luminous megacity, master tight corners and build your perfect street machine.", studio: "Pixel Harbor", platforms: ["Android", "PC"], monetization: "Free with optional purchases", offline: true, internetRequirement: "offline", ads: false, iap: true, priceMinor: null, currency: "NGN", rating: 4.8, accent: "blue", icon: "🏎️", featured: true },
  { id: "demo-emberfall", title: "Emberfall", slug: "emberfall", genre: "Adventure", description: "Explore ancient ruins, solve environmental puzzles and uncover the story beneath the ash.", studio: "Northstar Tiny Games", platforms: ["Android"], monetization: "Free demo", offline: true, internetRequirement: "offline", ads: false, iap: false, priceMinor: null, currency: "NGN", rating: 4.7, accent: "ember", icon: "🔥" },
  { id: "demo-orbit-keepers", title: "Orbit Keepers", slug: "orbit-keepers", genre: "Strategy", description: "Build a space outpost, manage your crew and defend a frontier at the edge of the galaxy.", studio: "Small Planet Studio", platforms: ["Android", "PC"], monetization: "Free", offline: false, internetRequirement: "unknown", ads: false, iap: false, priceMinor: null, currency: "NGN", rating: 4.6, accent: "violet", icon: "🪐" },
  { id: "demo-shadow-circuit", title: "Shadow Circuit", slug: "shadow-circuit", genre: "Action", description: "A fast tactical challenge built around timing, movement and clever use of the environment.", studio: "Copper Fox Games", platforms: ["Android"], monetization: "Free with ads", offline: true, internetRequirement: "offline", ads: true, iap: false, priceMinor: null, currency: "NGN", rating: 4.4, accent: "green", icon: "⚡" },
  { id: "demo-tiny-chef", title: "Tiny Chef Rush", slug: "tiny-chef-rush", genre: "Casual", description: "Run a tiny kitchen, create wild recipes and keep a cheerful crowd happy.", studio: "Bright Button", platforms: ["Android", "Web"], monetization: "Free", offline: true, internetRequirement: "offline", ads: false, iap: false, priceMinor: null, currency: "NGN", rating: 4.5, accent: "pink", icon: "🍜" },
  { id: "demo-deep-field", title: "Deep Field", slug: "deep-field", genre: "Puzzle", description: "Connect signals across a silent planet in a calm, thoughtful puzzle adventure.", studio: "Blue Lantern", platforms: ["Android", "PC"], monetization: "Free demo", offline: true, internetRequirement: "offline", ads: false, iap: false, priceMinor: null, currency: "NGN", rating: 4.9, accent: "cyan", icon: "🌌" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function mapGame(row: Record<string, unknown>): Game {
  const studioValue = row.developer_studios as { studio_name?: string } | { studio_name?: string }[] | null;
  const studio = Array.isArray(studioValue) ? studioValue[0]?.studio_name : studioValue?.studio_name;
  const monetization = String(row.monetization_type ?? "free");
  const monetizationLabel: Record<string, string> = { free: "Free", paid: "Paid", free_with_ads: "Free with ads", free_with_iap: "Free with optional purchases", demo: "Free demo" };
  const rawDetails = Array.isArray(row.game_platform_details) ? row.game_platform_details : [];
  const platformDetails: GamePlatformDetail[] = rawDetails.filter(isRecord).map((detail) => ({
    platform: String(detail.platform ?? ""),
    official_access_url: typeof detail.official_access_url === "string" ? detail.official_access_url : null,
    official_access_url_verified_at: typeof detail.official_access_url_verified_at === "string" ? detail.official_access_url_verified_at : null,
    download_size_bytes: typeof detail.download_size_bytes === "number" ? detail.download_size_bytes : null,
    download_size_verified_at: typeof detail.download_size_verified_at === "string" ? detail.download_size_verified_at : null,
    internet_requirement: ["offline", "online", "both"].includes(String(detail.internet_requirement)) ? detail.internet_requirement as GamePlatformDetail["internet_requirement"] : "unknown",
    internet_requirement_verified_at: typeof detail.internet_requirement_verified_at === "string" ? detail.internet_requirement_verified_at : null,
    minimum_requirements: isRecord(detail.minimum_requirements) ? detail.minimum_requirements : {},
    minimum_requirements_verified_at: typeof detail.minimum_requirements_verified_at === "string" ? detail.minimum_requirements_verified_at : null,
  }));
  const requirements = Array.from(new Set(platformDetails.map((detail) => detail.internet_requirement)));
  const internetRequirement = requirements.length === 0
    ? (row.offline_support === true ? "offline" : "unknown")
    : requirements.length === 1 ? requirements[0] : "varies";
  const offline = platformDetails.some((detail) => detail.internet_requirement === "offline" || detail.internet_requirement === "both")
    || (platformDetails.length === 0 && row.offline_support === true);

  return {
    id: String(row.id), title: String(row.title), slug: String(row.slug), genre: String(row.genre),
    description: String(row.short_description ?? row.description ?? "Game description coming soon."),
    studio: studio ?? "Game ON developer", platforms: Array.isArray(row.supported_platforms) ? row.supported_platforms.map(String) : ["Android"],
    monetization: monetizationLabel[monetization] ?? monetization, offline, internetRequirement, platformDetails,
    supportedLanguages: Array.isArray(row.supported_languages) ? row.supported_languages.map(String) : [],
    ageRating: typeof row.age_rating === "string" ? row.age_rating : null,
    ads: Boolean(row.contains_ads), iap: Boolean(row.has_in_app_purchases), priceMinor: typeof row.price_minor === "number" ? row.price_minor : null,
    currency: String(row.currency ?? "NGN"), rating: 0, accent: "blue", icon: "🎮",
  };
}
