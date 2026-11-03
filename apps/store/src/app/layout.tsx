import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Game ON Store — Discover your next game",
  description: "A gaming marketplace built around discovery, transparency and players.",
  applicationName: "Game ON Store",
  robots: { index: true, follow: true },
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = { themeColor: "#070b14", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
