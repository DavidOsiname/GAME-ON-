export type Game = {
  id: string;
  title: string;
  genre: string;
  description: string;
  studio: string;
  platforms: string[];
  monetization: string;
  offline: boolean;
  ads: boolean;
  iap: boolean;
  priceMinor: number | null;
  currency: string;
  coverImageUrl?: string | null;
  rating: number;
  icon: string;
  accent: string;
};

export const demoGames: Game[] = [
  {
    id: "demo-neon-drift",
    title: "Neon Drift",
    genre: "Racing",
    description: "Race through a luminous megacity, master tight corners and build your perfect street machine.",
    studio: "Pixel Harbor",
    platforms: ["Android", "PC"],
    monetization: "Free with optional purchases",
    offline: true,
    ads: false,
    iap: true,
    priceMinor: null,
    currency: "NGN",
    rating: 4.8,
    icon: "🏎️",
    accent: "#123c65"
  },
  {
    id: "demo-emberfall",
    title: "Emberfall",
    genre: "Adventure",
    description: "Explore ancient ruins, solve environmental puzzles and uncover the story beneath the ash.",
    studio: "Northstar Tiny Games",
    platforms: ["Android"],
    monetization: "Free demo",
    offline: true,
    ads: false,
    iap: false,
    priceMinor: null,
    currency: "NGN",
    rating: 4.7,
    icon: "🔥",
    accent: "#642d29"
  },
  {
    id: "demo-orbit-keepers",
    title: "Orbit Keepers",
    genre: "Strategy",
    description: "Build a space outpost, manage your crew and defend a frontier at the edge of the galaxy.",
    studio: "Small Planet Studio",
    platforms: ["Android", "PC"],
    monetization: "Free",
    offline: false,
    ads: false,
    iap: false,
    priceMinor: null,
    currency: "NGN",
    rating: 4.6,
    icon: "🪐",
    accent: "#3d326e"
  },
  {
    id: "demo-shadow-circuit",
    title: "Shadow Circuit",
    genre: "Action",
    description: "A fast tactical challenge built around timing, movement and clever use of the environment.",
    studio: "Copper Fox Games",
    platforms: ["Android"],
    monetization: "Free with ads",
    offline: true,
    ads: true,
    iap: false,
    priceMinor: null,
    currency: "NGN",
    rating: 4.4,
    icon: "⚡",
    accent: "#255341"
  },
  {
    id: "demo-tiny-chef",
    title: "Tiny Chef Rush",
    genre: "Casual",
    description: "Run a tiny kitchen, create wild recipes and keep a cheerful crowd happy.",
    studio: "Bright Button",
    platforms: ["Android", "Web"],
    monetization: "Free",
    offline: true,
    ads: false,
    iap: false,
    priceMinor: null,
    currency: "NGN",
    rating: 4.5,
    icon: "🍜",
    accent: "#703a61"
  },
  {
    id: "demo-deep-field",
    title: "Deep Field",
    genre: "Puzzle",
    description: "Connect signals across a silent planet in a calm, thoughtful puzzle adventure.",
    studio: "Blue Lantern",
    platforms: ["Android", "PC"],
    monetization: "Free demo",
    offline: true,
    ads: false,
    iap: false,
    priceMinor: null,
    currency: "NGN",
    rating: 4.9,
    icon: "🌌",
    accent: "#17536c"
  }
];

export function mapGame(row: Record<string, unknown>): Game {
  const studioValue = row.developer_studios as
    | { studio_name?: string }
    | { studio_name?: string }[]
    | null;
  const studio = Array.isArray(studioValue)
    ? studioValue[0]?.studio_name
    : studioValue?.studio_name;
  const monetization = String(row.monetization_type ?? "free");
  const labels: Record<string, string> = {
    free: "Free",
    paid: "Paid",
    free_with_ads: "Free with ads",
    free_with_iap: "Free with optional purchases",
    demo: "Free demo"
  };

  return {
    id: String(row.id),
    title: String(row.title),
    genre: String(row.genre ?? "Other"),
    description: String(row.short_description ?? row.description ?? "Game details coming soon."),
    studio: studio ?? "Game ON developer",
    platforms: Array.isArray(row.supported_platforms)
      ? row.supported_platforms.map(String)
      : ["Android"],
    monetization: labels[monetization] ?? monetization,
    offline: Boolean(row.offline_support),
    ads: Boolean(row.contains_ads),
    iap: Boolean(row.has_in_app_purchases),
    priceMinor: typeof row.price_minor === "number" ? row.price_minor : null,
    currency: String(row.currency ?? "NGN"),
    coverImageUrl: typeof row.cover_image_url === "string" ? row.cover_image_url : null,
    rating: 0,
    icon: "🎮",
    accent: "#123c65"
  };
}
