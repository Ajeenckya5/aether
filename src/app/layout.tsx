import type { Metadata, Viewport } from "next";
import { Manrope, Syne } from "next/font/google";
import { BASE_PATH, PUBLIC_SITE } from "@/lib/site";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  display: "swap",
});

const metadataOrigin = BASE_PATH ? "https://ajeenckya5.github.io" : "http://127.0.0.1:3000";

export const metadata: Metadata = {
  metadataBase: new URL(metadataOrigin),
  title: {
    default: "Aether",
    template: "%s · Aether",
  },
  description:
    "Aether reads a heart-rate strap on this phone. Journal and live workouts stay on this device.",
  applicationName: "Aether",
  alternates: { canonical: PUBLIC_SITE },
  openGraph: {
    title: "Aether",
    description:
      "Aether reads a heart-rate strap on this phone. Journal and live workouts stay on this device.",
    url: PUBLIC_SITE,
    siteName: "Aether",
    images: [{ url: `${BASE_PATH}/og.png`, width: 1200, height: 630 }],
    type: "website",
  },
  icons: {
    icon: [
      { url: `${BASE_PATH}/icons/icon-192.png`, sizes: "192x192", type: "image/png" },
      { url: `${BASE_PATH}/icons/icon-512.png`, sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: `${BASE_PATH}/icons/apple-touch-icon.png`, sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Aether",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0e0d0b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${syne.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#070706] text-paper">{children}</body>
    </html>
  );
}
