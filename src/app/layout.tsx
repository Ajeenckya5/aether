import type { Metadata, Viewport } from "next";
import { Manrope, Syne } from "next/font/google";
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
  title: "Aether — Band companion",
  description:
    "Read recovery, strain, sleep, and workouts from your WHOOP band — on a phone or a laptop.",
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
