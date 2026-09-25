import { appPath, siteHref } from "@/lib/site";
import {
  DownloadIcon,
  FlaskIcon,
  HouseIcon,
  MoonIcon,
  PlayIcon,
  SettingsIcon,
  WatchIcon,
} from "./nav-icons";

const NAV = [
  { href: "/", label: "Today", icon: HouseIcon },
  { href: "/lab", label: "Lab", icon: FlaskIcon },
  { href: "/sleep", label: "Sleep", icon: MoonIcon },
  { href: "/workouts", label: "Workouts", icon: WatchIcon },
  { href: "/coach", label: "Coach", icon: PlayIcon },
] as const;

const swScript = `if("serviceWorker"in navigator){navigator.serviceWorker.register(${JSON.stringify(appPath("/sw.js"))},{scope:${JSON.stringify(appPath("/") || "/")}})}`;

export function HomeFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-ink lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-white/8 bg-ink px-4 py-6 lg:flex">
        <p className="font-display px-2 text-2xl tracking-tight">Aether</p>
        <p className="mt-1 px-2 text-[11px] uppercase tracking-widest text-muted">Phone app</p>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <SideAnchor key={item.href} href={item.href} label={item.label} icon={item.icon} active={item.href === "/"} />
          ))}
        </nav>
        <div className="space-y-3 px-1">
          <p className="rounded-2xl border border-white/10 px-3 py-2 text-xs text-muted">
            Install the Aether APK from GitHub (not Play Store) so Bluetooth can stay up overnight.
            Chrome Install app is the website-only fallback.{" "}
            <a href={siteHref("/download#android-apk")} className="text-lime underline underline-offset-2">
              Put it on the phone
            </a>
          </p>
          <SideAnchor href="/download" label="Download" icon={DownloadIcon} />
          <SideAnchor href="/settings" label="Settings" icon={SettingsIcon} />
        </div>
      </aside>

      <div className="relative mx-auto flex min-h-dvh w-full min-w-0 flex-1 flex-col bg-ink">
        <div
          tabIndex={0}
          aria-label="Page content"
          className="relative flex-1 overflow-y-auto no-scrollbar pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-8"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="mx-auto w-full max-w-3xl xl:max-w-5xl">{children}</div>
        </div>
        <nav
          className="absolute inset-x-0 bottom-0 z-20 border-t border-white/8 bg-ink/92 px-2 pt-1 backdrop-blur-xl lg:hidden"
          style={{ paddingBottom: "max(0.4rem, env(safe-area-inset-bottom))" }}
        >
          <ul className="grid grid-cols-5">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = item.href === "/";
              return (
                <li key={item.href}>
                  <a
                    href={siteHref(item.href)}
                    className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[10px] tracking-wide ${
                      active ? "text-lime" : "text-muted"
                    }`}
                  >
                    <Icon size={20} strokeWidth={active ? 2.4 : 1.7} />
                    {item.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
      {process.env.NODE_ENV === "production" ? (
        <script dangerouslySetInnerHTML={{ __html: swScript }} />
      ) : null}
    </div>
  );
}

function SideAnchor({
  href,
  label,
  icon: Icon,
  active = false,
}: {
  href: string;
  label: string;
  icon: typeof HouseIcon;
  active?: boolean;
}) {
  return (
    <a
      href={siteHref(href)}
      className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm ${
        active ? "bg-white/8 text-lime" : "text-muted hover:bg-white/5 hover:text-paper"
      }`}
    >
      <Icon size={18} strokeWidth={active ? 2.4 : 1.7} />
      {label}
    </a>
  );
}
