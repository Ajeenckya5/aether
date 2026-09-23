"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronLeft, Download, FlaskConical, House, Moon, PlayCircle, Settings, Watch } from "lucide-react";
import { DataProvider } from "./DataProvider";
import { HeartRateSlot } from "./heart-rate-context";
import { InstallBanner, useDevice } from "./DeviceChrome";
import { preferPhoneShell } from "@/lib/device";
import { appPath } from "@/lib/site";
import { startMonitoring } from "@/lib/monitor";

const NAV = [
  { href: "/", label: "Today", icon: House },
  { href: "/lab", label: "Lab", icon: FlaskConical },
  { href: "/sleep", label: "Sleep", icon: Moon },
  { href: "/workouts", label: "Workouts", icon: Watch },
  { href: "/coach", label: "Coach", icon: PlayCircle },
];

export function AppShell({
  children,
  hideNav = false,
}: {
  children: React.ReactNode;
  hideNav?: boolean;
}) {
  const pathname = usePathname();
  const device = useDevice();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  useEffect(() => {
    startMonitoring();
    if (navigator.storage?.persist) void navigator.storage.persist();
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register(appPath("/sw.js"), {
      scope: appPath("/") || "/",
    });
  }, []);
  const phoneApp = !ready || preferPhoneShell(device);
  const backTo = backHref(pathname);
  const hideMobileNav = hideNav || Boolean(backTo && pathname !== "/settings");

  return (
    <DataProvider>
      <HeartRateSlot active={pathname !== "/"}>
        <div className={`min-h-dvh bg-[#070706] ${phoneApp ? "" : "lg:flex"}`}>
          <aside
            className={`h-dvh w-60 shrink-0 flex-col border-r border-white/8 bg-ink px-4 py-6 sticky top-0 ${
              phoneApp ? "hidden" : "hidden lg:flex"
            }`}
          >
            <p className="font-display px-2 text-2xl tracking-tight">Aether</p>
            <p className="mt-1 px-2 text-[11px] uppercase tracking-widest text-muted">
              Phone app
            </p>
            <nav className="mt-8 flex flex-1 flex-col gap-1">
              {NAV.map((item) => (
                <SideLink key={item.href} item={item} pathname={pathname} />
              ))}
            </nav>
            <div className="space-y-3 px-1">
              <InstallBanner />
              <SideLink
                item={{ href: "/download", label: "Download", icon: Download }}
                pathname={pathname}
              />
              <SideLink
                item={{ href: "/settings", label: "Settings", icon: Settings }}
                pathname={pathname}
              />
            </div>
          </aside>

          <div className="relative mx-auto flex min-h-dvh w-full min-w-0 flex-1 flex-col bg-ink">
            <div className="pointer-events-none absolute inset-0 grain" />
            {backTo && (
              <div
                className={`absolute left-3 z-30 ${phoneApp ? "" : "lg:left-5"}`}
                style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
              >
                <Link
                  href={backTo}
                  aria-label="Back"
                  className="grid h-11 w-11 place-items-center rounded-full bg-black/45 text-paper backdrop-blur"
                >
                  <ChevronLeft size={18} />
                </Link>
              </div>
            )}
            <div
              tabIndex={0}
              aria-label="Page content"
              className={`relative flex-1 overflow-y-auto no-scrollbar ${
                hideMobileNav
                  ? "pb-4"
                  : "pb-[calc(5.5rem+env(safe-area-inset-bottom))]"
              } ${phoneApp || hideMobileNav ? "" : "lg:pb-8"}`}
              style={{ paddingTop: "env(safe-area-inset-top)" }}
            >
              <div
                className={`mx-auto w-full ${
                  phoneApp ? "max-w-lg" : "max-w-3xl xl:max-w-5xl"
                }`}
              >
                {children}
              </div>
            </div>
            {!hideMobileNav && (
              <nav
                className={`absolute inset-x-0 bottom-0 z-20 border-t border-white/8 bg-ink/92 px-2 pt-1 backdrop-blur-xl ${
                  phoneApp ? "" : "lg:hidden"
                }`}
                style={{ paddingBottom: "max(0.4rem, env(safe-area-inset-bottom))" }}
              >
                <ul className="grid grid-cols-5">
                  {NAV.map((item) => {
                    const active =
                      item.href === "/"
                        ? pathname === "/"
                        : pathname.startsWith(item.href);
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[10px] tracking-wide ${
                            active ? "text-lime" : "text-muted"
                          }`}
                        >
                          <Icon size={20} strokeWidth={active ? 2.4 : 1.7} />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            )}
          </div>
        </div>
      </HeartRateSlot>
    </DataProvider>
  );
}

function SideLink({
  item,
  pathname,
}: {
  item: { href: string; label: string; icon: typeof House };
  pathname: string;
}) {
  const active =
    item.href === "/"
      ? pathname === "/"
      : pathname.startsWith(item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm ${
        active ? "bg-white/8 text-lime" : "text-muted hover:bg-white/5 hover:text-paper"
      }`}
    >
      <Icon size={18} strokeWidth={active ? 2.4 : 1.7} />
      {item.label}
    </Link>
  );
}

function backHref(pathname: string): string | null {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (path.startsWith("/workouts/")) return "/workouts";
  if (path.startsWith("/coach/")) return "/coach";
  if (path.startsWith("/sleep/")) return "/sleep";
  if (path === "/download") return "/settings";
  if (path === "/privacy") return "/settings";
  return null;
}
