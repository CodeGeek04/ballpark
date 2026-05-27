import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-display",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://letsballpark.com"),
  title: "Ballpark — guess the weirdest number of the day",
  description:
    "A live guessing game for weird numerical questions. You get 60 seconds and a calculator. Closest guess wins. Play solo, free-for-all up to 8, or in teams. No signup.",
  openGraph: {
    title: "Ballpark — guess the weirdest number of the day",
    description:
      "Get a strange question with a number for an answer. 60 seconds, calculator allowed, closest guess wins. Solo or up to 8 friends. No signup.",
    url: "https://letsballpark.com",
    siteName: "Ballpark",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ballpark — guess the weirdest number of the day",
    description:
      "Get a strange question with a number for an answer. 60 seconds, calculator allowed, closest guess wins. Solo or up to 8 friends.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
