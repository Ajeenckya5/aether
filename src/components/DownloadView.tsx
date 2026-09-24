"use client";

import { Apple, Download, FolderGit2, Smartphone } from "lucide-react";
import { publicDownloadUrls, storeListed } from "@/lib/downloads";
import { preferPhoneShell } from "@/lib/device";
import { PUBLIC_SITE } from "@/lib/site";
import { InstallBanner, PhoneInstallCard, useDevice } from "./DeviceChrome";
import { BluetoothPanel } from "./LiveHeartRate";

export function DownloadView() {
  const urls = publicDownloadUrls();
  const device = useDevice();
  const onPhone = preferPhoneShell(device);
  const onPlay = storeListed("android", urls);
  const onAppStore = storeListed("ios", urls);

  return (
    <div className="px-5 pt-6 pb-8 lg:px-2">
      <p className="text-[11px] uppercase tracking-[0.18em] text-lime">Phone app</p>
      <h1 className="font-display mt-2 text-4xl">Install Aether on this phone</h1>
      <p className="mt-3 max-w-xl text-sm text-muted">
        After install, open the home-screen icon. That is the website app.
        Pair any heart-rate strap for live bpm. Compatible devices: Polar,
        Garmin, Wahoo, and WHOOP (public Heart Rate only). On Android, sideload
        the Aether APK (not Play Store) so overnight Bluetooth can stay up.
        Safari and Chrome on iPhone cannot do Bluetooth — install the Aether
        iPhone app (below) or use Bluefy.
      </p>

      {device.standalone && (
        <p className="mt-4 rounded-[24px] border border-lime/30 bg-lime/10 px-4 py-3 text-sm text-paper">
          This copy is already the phone app. Use the home-screen icon next time.
          Connect over Bluetooth below.
        </p>
      )}

      <section id="install" className="mt-6">
        <PhoneInstallCard />
      </section>

      <div className="mt-5">
        <InstallBanner />
      </div>

      {(onPlay || onAppStore) && (
        <section className="mt-4 grid gap-2">
          {onPlay && (
            <a
              href={urls.playStoreUrl}
              className="rounded-full bg-lime px-4 py-3 text-center text-sm font-medium text-ink"
            >
              Get it on Google Play
            </a>
          )}
          {onAppStore && (
            <a
              href={urls.appStoreUrl}
              className="rounded-full bg-lime px-4 py-3 text-center text-sm font-medium text-ink"
            >
              Download on the App Store
            </a>
          )}
        </section>
      )}

      <section
        id="ios"
        className="mt-4 rounded-[28px] border border-white/8 bg-panel p-5"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/8">
            <Apple size={20} />
          </span>
          <div>
            <h2 className="font-display text-xl">iPhone — the app</h2>
            <p className="text-xs uppercase tracking-widest text-muted">
              Home screen · not the App Store
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">
          There is no App Store listing. Safari or Chrome → Add to Home Screen
          is how iPhone gets the Aether app.
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-4 text-sm text-paper/80">
          <li>On the iPhone, open this page in <strong className="font-medium text-paper">Safari</strong>.</li>
          <li>Tap the Share button (square with an arrow). On compact Safari, tap More first.</li>
          <li>Scroll and tap <strong className="font-medium text-paper">Add to Home Screen</strong>, then Add. Leave Open as Web App on if you see it.</li>
          <li>Leave Safari. Tap the <strong className="font-medium text-paper">Aether</strong> icon on the home screen.</li>
          <li>It opens as a phone app (no browser bar, no laptop sidebar).</li>
        </ol>
        {!onPhone && (
          <p className="mt-3 text-sm text-muted">
            You are on a computer. Pick up the iPhone, type the address below in
            Safari or Chrome, then do the steps.
          </p>
        )}
      </section>

      <section
        id="ios-chrome"
        className={`mt-4 rounded-[28px] border bg-panel p-5 ${
          device.ios && device.browser === "chrome" ? "border-lime/40" : "border-white/8"
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/8">
            <Apple size={20} />
          </span>
          <div>
            <h2 className="font-display text-xl">iPhone — Chrome</h2>
            <p className="text-xs uppercase tracking-widest text-muted">
              Share next to the address · not the App Store
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">
          Chrome on iPhone can install the website app too. Bluetooth still
          cannot run in Chrome — use the Aether iPhone app (Xcode) or Bluefy.
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-4 text-sm text-paper/80">
          <li>On the iPhone, open this page in <strong className="font-medium text-paper">Chrome</strong>.</li>
          <li>Tap <strong className="font-medium text-paper">Share</strong> next to the address bar.</li>
          <li>Tap <strong className="font-medium text-paper">Add to Home Screen</strong>, then Add.</li>
          <li>Tap the <strong className="font-medium text-paper">Aether</strong> icon. That is the app.</li>
        </ol>
      </section>

      <section
        id="ios-native"
        className={`mt-4 rounded-[28px] border bg-panel p-5 ${
          device.ios ? "border-lime/40" : "border-white/8"
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/8">
            <Apple size={20} />
          </span>
          <div>
            <h2 className="font-display text-xl">iPhone — Aether Bluetooth app</h2>
            <p className="text-xs uppercase tracking-widest text-muted">
              Our app · Core Bluetooth · not Safari
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">
          Apple does not allow Bluetooth in Safari or Chrome. There is no
          browser loophole. This is our own iPhone app: it talks to a heart-rate
          strap with iOS Core Bluetooth (public Heart Rate only), then shows Aether
          inside that app. It is not on the App Store.
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-4 text-sm text-paper/80">
          <li>On a Mac, install Xcode from the Mac App Store (free).</li>
          <li>
            Open{" "}
            <a className="font-medium text-lime" href={`${urls.repoUrl}/tree/master/native/ios/AetherBand`}>
              native/ios/AetherBand/AetherBand.xcodeproj
            </a>{" "}
            from this GitHub repo.
          </li>
          <li>Plug in the iPhone. Unlock it. Trust the computer if asked.</li>
          <li>In Xcode pick the iPhone, then the Team = your Apple ID (Signing &amp; Capabilities).</li>
          <li>Press Run. On the iPhone: Settings → General → VPN &amp; Device Management → Trust your Apple ID.</li>
          <li>Open the Aether icon. Allow Bluetooth. Disconnect the strap’s own app, then tap Connect a heart-rate strap.</li>
        </ol>
        <p className="mt-3 text-xs text-muted">
          A free Apple ID install lasts 7 days, then press Run again. It has no
          push notifications. A paid Apple Developer account lasts a year.
          Bluefy remains the path if you do not have a Mac.
        </p>
      </section>

      <section
        id="ios-whoop"
        className="mt-4 rounded-[28px] border border-white/8 bg-panel p-5"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/8">
            <Apple size={20} />
          </span>
          <div>
            <h2 className="font-display text-xl">iPhone — Bluefy fallback</h2>
            <p className="text-xs uppercase tracking-widest text-muted">
              No Mac · Web BLE browser
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">
          If you cannot install Xcode, Bluefy is a free App Store browser with
          Web Bluetooth. Aether itself is not on the App Store — Bluefy is only
          the Bluetooth browser.
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-4 text-sm text-paper/80">
          <li>
            Install{" "}
            <a
              className="font-medium text-lime"
              href="https://apps.apple.com/us/app/bluefy-web-ble-browser/id1492822055"
            >
              Bluefy – Web BLE Browser
            </a>{" "}
            (free).
          </li>
          <li>Open Bluefy. Go to {PUBLIC_SITE.replace("https://", "")}.</li>
          <li>Disconnect the strap’s own app so the band is free.</li>
          <li>Tap Connect a heart-rate strap and pick the band.</li>
          <li>Leave Aether open in Bluefy. It reconnects if the link drops. Tap Disconnect only when you want it off.</li>
        </ol>
      </section>

      <section
        id="android-apk"
        className={`mt-4 rounded-[28px] border bg-panel p-5 ${
          !device.ios ? "border-lime/40" : "border-white/8"
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/8">
            <Smartphone size={20} />
          </span>
          <div>
            <h2 className="font-display text-xl">Android — Aether APK</h2>
            <p className="text-xs uppercase tracking-widest text-muted">
              Sideload · native Bluetooth · not Play Store
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">
          There is no Play Store listing. This is our own Android app: native
          Bluetooth GATT talks to the strap (public Heart Rate only), then
          shows Aether inside that app. Leave it connected overnight for Aether
          sleep. Chrome Install app still works for live bpm, but the WebView
          can pause — the APK keeps a foreground keep-alive.
        </p>
        <a
          href={urls.apkUrl}
          className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-full bg-lime px-4 py-3 text-sm font-medium text-ink"
        >
          <Download size={16} />
          Get aether.apk
        </a>
        <a href={urls.apkChecksumUrl} className="mt-3 block text-sm text-lime">
          SHA-256 checksum
        </a>
        <p className="mt-3 text-xs text-muted">
          Obtainium can track this repo. The release file name stays{" "}
          <span className="text-paper">aether.apk</span> on tag v1.0.0.
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-4 text-sm text-paper/80">
          <li>On the Android phone, tap <strong className="font-medium text-paper">Get aether.apk</strong> (GitHub Release v1.0.0, not Google Play).</li>
          <li>If Chrome or Files blocks it, allow the download, then allow install from that app in Settings.</li>
          <li>Open the <strong className="font-medium text-paper">Aether</strong> icon. Allow Bluetooth. Allow notifications if you want overnight keep-alive.</li>
          <li>Disconnect the strap’s own app, then tap Connect a heart-rate strap.</li>
        </ol>
        <p className="mt-3 text-xs text-muted">
          Play Protect may warn because this is a sideload build, not a store
          listing. The APK is built by GitHub Actions from this repo. Uninstall
          any older Aether sideload first if Android refuses to update.
        </p>
      </section>

      <section
        id="android"
        className="mt-4 rounded-[28px] border border-white/8 bg-panel p-5"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/8">
            <Smartphone size={20} />
          </span>
          <div>
            <h2 className="font-display text-xl">Android — Chrome website app</h2>
            <p className="text-xs uppercase tracking-widest text-muted">
              Chrome Install app · not Play Store
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">
          There is no Play Store listing. Chrome&apos;s <strong className="font-medium text-paper">Install app</strong> puts the website on the home screen. Live bpm works in Chrome. For overnight Aether sleep, prefer the APK above so Bluetooth is not paused with the tab.
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-4 text-sm text-paper/80">
          <li>On the Android phone, open this page in <strong className="font-medium text-paper">Chrome</strong>.</li>
          <li>Tap <strong className="font-medium text-paper">Install</strong> when Chrome offers it, or Chrome menu → <strong className="font-medium text-paper">Install app</strong> / Add to Home screen.</li>
          <li>Tap the <strong className="font-medium text-paper">Aether</strong> icon. That is the app on the device.</li>
          <li>Scroll to Connect over Bluetooth and pick the strap (Polar, Garmin, Wahoo, or WHOOP).</li>
        </ol>
      </section>

      <section
        id="android-safari"
        className={`mt-4 rounded-[28px] border bg-panel p-5 ${
          !device.ios && device.browser === "safari" ? "border-lime/40" : "border-white/8"
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/8">
            <Smartphone size={20} />
          </span>
          <div>
            <h2 className="font-display text-xl">Android — Safari-like browsers</h2>
            <p className="text-xs uppercase tracking-widest text-muted">
              Add to Home Screen · not Play Store
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">
          Apple does not ship Safari on Android. Do not install a fake Safari
          APK. If you use Firefox, Edge, Samsung Internet, or a Safari-named
          browser: menu → Add to Home Screen. Live strap bpm needs a browser
          with Web Bluetooth (Chrome or Edge).
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-4 text-sm text-paper/80">
          <li>Open this page in that browser.</li>
          <li>Menu or Share → <strong className="font-medium text-paper">Add to Home Screen</strong> / Install.</li>
          <li>Tap the <strong className="font-medium text-paper">Aether</strong> icon, then Connect over Bluetooth.</li>
        </ol>
      </section>

      <section className="mt-4 rounded-[28px] border border-white/8 p-5">
        <h2 className="font-display text-lg text-paper">One-time address</h2>
        <p className="mt-2 text-sm text-muted">
          Open this once on the phone to install. After that, only use the icon.
        </p>
        <a
          href={PUBLIC_SITE}
          className="mt-3 block break-all font-mono text-sm text-lime"
        >
          {PUBLIC_SITE}
        </a>
      </section>

      <div className="mt-4">
        <BluetoothPanel />
      </div>

      <section className="mt-4 rounded-[28px] border border-white/8 p-5 text-sm text-muted">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/8 text-paper">
            <FolderGit2 size={20} />
          </span>
          <div>
            <h2 className="font-display text-lg text-paper">Source on GitHub</h2>
            <p className="text-xs uppercase tracking-widest">Only if you need the files</p>
          </div>
        </div>
        <p className="mt-3">
          You do not need GitHub to use Aether on the phone. GitHub is the
          source download if you want to run or change the project.
        </p>
        <ol className="mt-3 list-decimal space-y-1.5 pl-4">
          <li>
            Open{" "}
            <a className="text-lime" href={urls.repoUrl} target="_blank" rel="noreferrer">
              {urls.repoUrl.replace("https://", "")}
            </a>
          </li>
          <li>Click Code → Download ZIP, or copy the clone command below.</li>
          <li>That is source, not the phone icon. Put the running app on the phone with the steps above.</li>
        </ol>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <a
            href={urls.zipUrl}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-3 text-sm text-paper"
          >
            <Download size={16} />
            Download ZIP
          </a>
          <a
            href={urls.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="flex flex-1 items-center justify-center rounded-full border border-white/15 px-4 py-3 text-sm"
          >
            Open GitHub
          </a>
        </div>
        <p className="mt-3 font-mono text-[11px] leading-relaxed">
          git clone {urls.cloneUrl}
        </p>
      </section>
    </div>
  );
}
