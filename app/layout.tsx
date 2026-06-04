import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "QR Life",
  description:
    "Bring any QR code to life as a vivid Conway's Game of Life seed.",
  icons: {
    apple: [{ url: "/favicon/apple-touch-icon.png", sizes: "180x180" }],
    icon: [
      {
        url: "/favicon/favicon-32x32.png",
        type: "image/png",
        sizes: "32x32",
      },
      {
        url: "/favicon/favicon-16x16.png",
        type: "image/png",
        sizes: "16x16",
      },
    ],
  },
  manifest: "/favicon/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark`}
      style={{ colorScheme: "dark" }}
    >
      <body className="relative z-0 min-h-dvh overflow-x-hidden bg-background font-sans antialiased">
        <Analytics />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.2),transparent_28%),radial-gradient(circle_at_top_right,rgba(217,70,239,0.16),transparent_24%),radial-gradient(circle_at_80%_80%,rgba(249,115,22,0.14),transparent_20%),linear-gradient(180deg,#040816_0%,#060b17_52%,#03050d_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-size-[72px_72px] mask-[radial-gradient(circle_at_center,black,transparent_84%)]" />
          <div className="absolute left-[8%] top-16 h-44 w-44 animate-pulse rounded-full bg-cyan-400/18 blur-3xl [animation-delay:160ms] animation-duration-[11s]" />
          <div className="absolute right-[12%] bottom-[10%] h-52 w-52 animate-pulse rounded-full bg-fuchsia-500/16 blur-3xl [animation-delay:1.6s] animation-duration-[14s]" />
        </div>

        {children}
      </body>
    </html>
  );
}
