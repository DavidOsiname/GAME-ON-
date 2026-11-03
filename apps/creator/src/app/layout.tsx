import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Game ON Creator — Developer Studio", description: "Publish and manage your games on Game ON.", applicationName: "Game ON Creator", robots: { index: false, follow: false, noarchive: true } };
export const viewport: Viewport = { themeColor: "#080d15", width: "device-width", initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
