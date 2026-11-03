import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Game ON Creator",
    short_name: "GO Creator",
    description: "Publish and manage your games on Game ON.",
    start_url: "/",
    display: "standalone",
    background_color: "#080d15",
    theme_color: "#080d15",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" }
    ]
  };
}
