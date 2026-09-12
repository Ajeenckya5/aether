# Aether

Aether is an original recovery companion for a WHOOP band. It is **not** a clone of the WHOOP app: it does not copy WHOOP’s interface, branding, or workout video catalog.

Aether is a **phone app** (home-screen install). It is not on the App Store or Play Store.

**Install the app:** [ajeenckya5.github.io/aether](https://ajeenckya5.github.io/aether) — open once on the phone, then always use the icon.

Your live connection is **Bluetooth on this phone**. Pick the WHOOP band (public Heart Rate service) or a Polar / Garmin / Wahoo strap.

## Download — put it on the phone

Aether is a **phone app**. After you install it, open the home-screen icon. Do not keep using it as a laptop dashboard.

**App:** [https://ajeenckya5.github.io/aether](https://ajeenckya5.github.io/aether)  
**Source (optional):** [github.com/Ajeenckya5/aether](https://github.com/Ajeenckya5/aether) · [ZIP](https://github.com/Ajeenckya5/aether/archive/refs/heads/master.zip)

### iPhone

**Safari or Chrome:**

1. On the iPhone, open [https://ajeenckya5.github.io/aether](https://ajeenckya5.github.io/aether).
2. Tap **Share** (Chrome: next to the address bar).
3. Tap **Add to Home Screen**, then **Add**.
4. Tap the **Aether** icon.

Live WHOOP Bluetooth does not work in iPhone browsers. Use **Practice pulse**, or pair in Chrome on Android or a laptop.

### Android

1. On the phone, open [https://ajeenckya5.github.io/aether](https://ajeenckya5.github.io/aether) in **Chrome**.
2. Tap **Install** / Chrome menu → **Install app** or **Add to Home screen**.
3. Tap the **Aether** icon.
4. Open **Download** or **Settings** → **Connect over Bluetooth**.
5. Wear the WHOOP band (or a Polar / Garmin / Wahoo strap). Pick it in the list. Live BPM uses the public Heart Rate service.

### Live Bluetooth

Aether connects over Bluetooth. Live bpm is the public Bluetooth Heart Rate profile (WHOOP, Polar, Garmin, Wahoo) on Android Chrome or laptop Chrome, from the home-screen app. Overnight recovery/sleep packets use WHOOP’s private radio — a native iOS companion can parse those; this website cannot.

### Run the source (only if you need files)

```bash
git clone https://github.com/Ajeenckya5/aether.git
cd aether
npm install
npm run dev
```

Then open the Network URL on the **phone** and install to the home screen. `localhost` on the laptop is not the phone app.

To publish the static site yourself: `npm run build:pages` and host the `out` folder. GitHub Actions deploys [ajeenckya5.github.io/aether](https://ajeenckya5.github.io/aether) from `master`.

## What you get

- Today: an Aether **call** (push / build / recover) with reasons, not just a WHOOP recovery number
- Lab: Banister CTL/ATL/TSB, Gabbett ACWR, HRV z-score, vital slope, stress load, polarized week, counterfactuals
- Same-day journal tags that immediately move the call (alcohol, caffeine, travel, illness, soreness)
- Trained open readiness model (`python3 scripts/train_readiness.py`) — 14k athlete-days, R² 0.94
- Sleep history, workout replay films, original Coach library

WHOOP 5.0 still does not expose fitness-fatigue or ACWR. Healthspan and Stress sit on paid tiers and stay opaque. Lab is the open version of those ideas.

## WHOOP Bluetooth

WHOOP exposes a **public** Heart Rate GATT service for live bpm. Aether uses that.

Overnight recovery, sleep, and strain history use a **private** encrypted WHOOP radio. Native iOS apps (CoreBluetooth + a custom parser) can talk to that. A website cannot, and Aether will not copy that unpublished protocol.

1. Install the phone app (home screen) or open Chrome on a laptop/Android.
2. Wear the WHOOP band.
3. Settings → **Connect over Bluetooth**, pick WHOOP.

If the band does not offer public Heart Rate in the picker, tap **Scan all devices**. iPhone Safari/Chrome have no Web Bluetooth — pair from Android Chrome or a laptop.

## Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Demo data loads immediately.

Optional overnight recovery from WHOOP’s **official** API: copy `.env.example` to `.env.local`, add a free app from [developer.whoop.com](https://developer.whoop.com), then Settings → Connect WHOOP account. The public github.io app has no server, so that sign-in is self-host only.

## Connect over Bluetooth

1. Install the phone app (home screen) or open Chrome on a laptop/Android.
2. Wear the WHOOP band (or Polar / Garmin / Wahoo).
3. Settings → **Connect over Bluetooth**, pick the band.

Live bpm uses public Heart Rate GATT. Private WHOOP history packets are not parsed here.

## Privacy

The public website is a static app. GitHub Pages cannot store journal, GPS, or heart-rate. Those stay in **this browser’s** storage, isolated from every other visitor.

Weather requests go from your phone to Open-Meteo with a rounded lat/lon (~1 km). Aether does not look up your IP, and it does not include ads or analytics. Settings → Erase private data clears the phone copy.
