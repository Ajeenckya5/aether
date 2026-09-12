# Aether

Aether is an original recovery companion for a WHOOP band. It is **not** a clone of the WHOOP app: it does not copy WHOOP’s interface, branding, or workout video catalog.

**Live site (install this on the phone):** [ajeenckya5.github.io/aether](https://ajeenckya5.github.io/aether)

Your strap still syncs through the official WHOOP app. A self-hosted copy can then read recovery, strain, sleep, and workouts with WHOOP’s public OAuth API. The public GitHub Pages site has no server and no user database.

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

Live Bluetooth heart-rate straps do not work in iPhone Safari. Use **Practice pulse**, and keep the WHOOP band in the WHOOP app.

### Android

1. On the phone, open [https://ajeenckya5.github.io/aether](https://ajeenckya5.github.io/aether) in **Chrome**.
2. Tap **Install** / Chrome menu → **Install app** or **Add to Home screen**.
3. Tap the **Aether** icon.
4. Open **Download** or **Settings** → **Pair live HR strap**.
5. Wear a Polar, Garmin, or Wahoo strap (not the WHOOP band). Pick it in the list. BPM updates in real time.

### Live Bluetooth

The WHOOP band cannot stream to Aether. Path for the band:

**WHOOP band → official WHOOP app (Bluetooth) → WHOOP cloud → your self-hosted Aether (OAuth)**

Live bpm inside Aether is a standard Bluetooth Heart Rate strap on Android Chrome or laptop Chrome, from the home-screen app (secure context).

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

WHOOP does not publish a third-party Bluetooth API. The supported path is:

**WHOOP band → official WHOOP app (Bluetooth) → WHOOP cloud → Aether (OAuth)**

## Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Demo data loads immediately.

## Connect your band

WHOOP Connect is **not** on the public GitHub Pages site (no server, so your tokens are never mixed with anyone else’s). Run your own copy:

1. Create an app at [developer.whoop.com](https://developer.whoop.com).
2. Redirect URI: `http://localhost:3000/api/auth/callback`
3. Scopes: `read:recovery`, `read:cycles`, `read:sleep`, `read:workout`, `read:profile`, `read:body_measurement`, `offline`
4. Copy `.env.example` to `.env.local` and add your client id and secret.
5. Restart the app and tap **Connect WHOOP** in Settings.

WHOOP apps start in a sandbox with a member cap until they approve production access.

## Privacy

The public website is a static app. GitHub Pages cannot store journal, GPS, heart-rate, or WHOOP tokens. Those stay in **this browser’s** storage, isolated from every other visitor.

Weather requests go from your phone to Open-Meteo with a rounded lat/lon (~1 km). Aether does not look up your IP, and it does not include ads or analytics. Settings → Erase private data clears the phone copy.

Self-hosted WHOOP tokens are httpOnly cookies on that host only.
