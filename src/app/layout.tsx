import type { Metadata, Viewport } from "next";
import { Manrope, Syne } from "next/font/google";
import { PUBLIC_SITE } from "@/lib/site";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_SITE),
  title: "Aether — Band companion",
  description:
    "Install Aether on your phone. Journal and live workouts stay on this device. No shared user database.",
  applicationName: "Aether",
  appleWebApp: {
    capable: true,
    title: "Aether",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0e0d0b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
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
