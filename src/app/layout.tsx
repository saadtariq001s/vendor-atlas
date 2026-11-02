import type { Metadata, Viewport } from "next";
import { Alegreya, IBM_Plex_Sans_Arabic, Plus_Jakarta_Sans } from "next/font/google";
import { APP_NAME } from "@/lib/brand";
import "./globals.css";

// Alegreya sets the headlines and the search term; its italic carries the
// one accented word on each page. Plus Jakarta Sans is everything read at
// length. Plex Sans Arabic covers Arabic company names and is fetched only
// when one appears.
const alegreya = Alegreya({
  variable: "--font-alegreya",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600"],
  preload: false,
});

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
  description: "Search, compare and maintain your vendor network.",
  applicationName: APP_NAME,
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#f7f3ea",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Runs before first paint so "Hide contacts" never flashes the details.
const PREFS_SCRIPT = `try{if(localStorage.getItem("atlas-private")==="on")document.documentElement.dataset.private="on"}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${alegreya.variable} ${jakarta.variable} ${plexArabic.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFS_SCRIPT }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
