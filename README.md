# Aether

Aether is an original recovery companion for a WHOOP band. It is **not** a clone of the WHOOP app: it does not copy WHOOP’s interface, branding, or workout video catalog.

Aether is a **phone app** (home-screen install). It is not on the App Store or Play Store.

**Install the app:** [ajeenckya5.github.io/aether](https://ajeenckya5.github.io/aether) — open once on the phone, then always use the icon.

Your live connection is **Bluetooth on this phone** — a Polar / Garmin / Wahoo heart-rate strap. Aether does not sign into WHOOP and does not use the WHOOP cloud.

## Download — put it on the phone

Aether is a **phone app**. After you install it, open the home-screen icon. Do not keep using it as a laptop dashboard.

**App:** [https://ajeenckya5.github.io/aether](https://ajeenckya5.github.io/aether)  
**Source (optional):** [github.com/Ajeenckya5/aether](https://github.com/Ajeenckya5/aether) · [ZIP](https://github.com/Ajeenckya5/aether/archive/refs/heads/master.zip)

### iPhone

1. On the iPhone, open [https://ajeenckya5.github.io/aether](https://ajeenckya5.github.io/aether) in **Safari**.
2. Tap **Share** (square with arrow).
3. Tap **Add to Home Screen**, then **Add**.
4. Leave Safari. Tap the **Aether** icon.
5. You are in the phone app (no browser bar).

Live Bluetooth heart-rate straps do not work in iPhone Safari. Use **Practice pulse**, or pair a strap in Chrome on Android or a laptop.

### Android

1. On the phone, open [https://ajeenckya5.github.io/aether](https://ajeenckya5.github.io/aether) in **Chrome**.
2. Tap **Install** / Chrome menu → **Install app** or **Add to Home screen**.
3. Tap the **Aether** icon.
4. Open **Download** or **Settings** → **Connect over Bluetooth**.
5. Wear a Polar, Garmin, or Wahoo strap (not the WHOOP band). Pick it in the list. BPM updates in real time.

### Live Bluetooth

Aether connects over Bluetooth only. The WHOOP band cannot stream here (closed radio, not reverse-engineered). Live bpm is a standard Bluetooth Heart Rate strap on Android Chrome or laptop Chrome, from the home-screen app (secure context).

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

## Why not Bluetooth to the WHOOP band?

WHOOP does not publish a third-party Bluetooth API. Aether will not reverse-engineer that radio and does not use WHOOP’s cloud OAuth. Pair a Polar, Garmin, or Wahoo strap instead.

## Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Demo data loads immediately.

## Connect over Bluetooth

Aether does **not** sign into WHOOP and does **not** use the WHOOP cloud.

1. Install the phone app (home screen) or open Chrome on a laptop/Android.
2. Wear a standard Bluetooth heart-rate strap (Polar, Garmin, Wahoo).
3. Settings → **Connect over Bluetooth**, pick the strap.

The WHOOP band uses a closed radio WHOOP does not publish. Aether will not reverse-engineer it, so that band cannot stream here.

## Privacy

The public website is a static app. GitHub Pages cannot store journal, GPS, or heart-rate. Those stay in **this browser’s** storage, isolated from every other visitor.

Weather requests go from your phone to Open-Meteo with a rounded lat/lon (~1 km). Aether does not look up your IP, and it does not include ads or analytics. Settings → Erase private data clears the phone copy.
