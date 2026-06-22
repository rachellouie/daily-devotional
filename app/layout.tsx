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

/**
 * Flash-prevention script. Rendered as the FIRST child of <body> (NOT in a
 * manual <head> — authoring our own <head> in the App Router suppresses Next's
 * automatic stylesheet/font injection and the whole app loses its CSS). A
 * synchronous inline script at the top of <body> still runs before the body
 * content below it paints, so there's no flash of the wrong theme.
 *
 * It is the SINGLE source of truth for the pre-paint class: the server can't
 * resolve "system", so it never sets `.dark`, and React renders <html> without
 * a theme class (hence suppressHydrationWarning below — this script legitimately
 * mutates the class the server didn't write). The fallback logic mirrors
 * parseThemePref: anything but light/dark/system, including no cookie, resolves
 * as "system". After hydration, ThemeToggle owns subsequent changes.
 */
const THEME_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )theme=([^;]*)/);var v=m?m[1]:"system";if(v!=="light"&&v!=="dark"&&v!=="system")v="system";var d=v==="dark"||(v==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  // `React.ReactNode` is the widest "anything renderable" type: elements,
  // strings, arrays, null. Correct type for a `children` prop.
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${lora.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen font-sans antialiased">
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}
