/**
 * app/layout.tsx — the ROOT layout (App Router convention).
 *
 * Every route is rendered inside this layout's <html>/<body>. It's the App
 * Router replacement for the old `pages/_app.tsx` + `_document.tsx` pair — one
 * file now owns the document shell, fonts, and global metadata.
 *
 * Fonts are loaded via `next/font`, which self-hosts them at build time (no
 * network request to Google on the client) and exposes a CSS variable we wire
 * into Tailwind's font-family tokens.
 */
import type { Metadata } from "next";
import { Inter, Lora } from "next/font/google";
import "./globals.css";

// Sans for UI chrome; serif (Lora) for scripture body text.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const lora = Lora({ subsets: ["latin"], variable: "--font-serif" });

/**
 * `Metadata` is Next's typed object for <head> tags. Exporting it from a layout
 * or page is the App Router way to set <title>/<meta> — no next/head needed.
 */
export const metadata: Metadata = {
  title: "Daily Devotional — Morning Prayer",
  description:
    "Daily Office (Book of Common Prayer) readings with full scripture text.",
};

export default function RootLayout({
  children,
}: {
  // `React.ReactNode` is the widest "anything renderable" type: elements,
  // strings, arrays, null. Correct type for a `children` prop.
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${lora.variable}`}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
