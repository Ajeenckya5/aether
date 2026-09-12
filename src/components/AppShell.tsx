"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, Download, FlaskConical, House, Moon, PlayCircle, Settings, Watch } from "lucide-react";
import { DataProvider } from "./DataProvider";
import { HeartRateProvider } from "./LiveHeartRate";
import { InstallBanner } from "./DeviceChrome";

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
  const backTo = backHref(pathname);
  const hideMobileNav = hideNav || Boolean(backTo && pathname !== "/settings");

  return (
    <DataProvider>
      <HeartRateProvider>
        <div className="min-h-dvh bg-[#070706] lg:flex">
          <aside className="hidden lg:flex lg:h-dvh lg:w-60 lg:shrink-0 lg:flex-col lg:border-r lg:border-white/8 lg:bg-ink lg:px-4 lg:py-6 lg:sticky lg:top-0">
            <p className="font-display px-2 text-2xl tracking-tight">Aether</p>
            <p className="mt-1 px-2 text-[11px] uppercase tracking-widest text-muted">
              Phone and laptop
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
              <div className="absolute left-3 z-30 lg:left-5" style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}>
                <Link
                  href={backTo}
                  className="grid h-11 w-11 place-items-center rounded-full bg-black/45 text-paper backdrop-blur"
                >
                  <ChevronLeft size={18} />
                </Link>
              </div>
            )}
            <div
              className={`relative flex-1 overflow-y-auto no-scrollbar ${
                hideMobileNav
                  ? "pb-4 lg:pb-8"
                  : "pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-8"
              }`}
              style={{ paddingTop: "env(safe-area-inset-top)" }}
            >
              <div className="mx-auto w-full max-w-3xl xl:max-w-5xl">{children}</div>
            </div>
            {!hideMobileNav && (
              <nav className="absolute inset-x-0 bottom-0 z-20 border-t border-white/8 bg-ink/92 px-2 pt-1 backdrop-blur-xl lg:hidden" style={{ paddingBottom: "max(0.4rem, env(safe-area-inset-bottom))" }}>
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
      </HeartRateProvider>
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
  if (pathname.startsWith("/workouts/")) return "/workouts";
  if (pathname.startsWith("/coach/")) return "/coach";
  if (pathname.startsWith("/sleep/")) return "/sleep";
  if (pathname === "/download") return "/settings";
  return null;
}
