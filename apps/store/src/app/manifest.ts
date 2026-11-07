import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "Game ON Store", short_name: "Game ON", description: "Discover games worth playing.", start_url: "/", display: "standalone", background_color: "#070b14", theme_color: "#070b14", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/icon-512.png", sizes: "512x512", type: "image/png" }] };
}
