# Aether

Aether is an original recovery companion for a WHOOP band. It is **not** a clone of the WHOOP app: it does not copy WHOOP’s interface, branding, or workout video catalog.

Your strap still syncs through the official WHOOP app. Aether then reads recovery, strain, sleep, and workouts with WHOOP’s public OAuth API.

## Download

**You get Aether from GitHub.** That is the download. iPhone and Android both run the same project after you clone or unzip it.

| | Link |
| --- | --- |
| **GitHub (required)** | [github.com/Ajeenckya5/aether](https://github.com/Ajeenckya5/aether) |
| **ZIP** | [Download source ZIP](https://github.com/Ajeenckya5/aether/archive/refs/heads/master.zip) |
| **iPhone / iPad** | Available now as a home-screen app. There is no App Store listing yet. Open the running site in Safari → Share → Add to Home Screen. Source: [GitHub](https://github.com/Ajeenckya5/aether) |
| **Android** | Available now as an installed web app. There is no Play Store listing yet. Open the site in Chrome → Install app. Source: [GitHub](https://github.com/Ajeenckya5/aether) |

```bash
git clone https://github.com/Ajeenckya5/aether.git
cd aether
npm install
npm run dev
```

Play Store and App Store URLs appear in the app when you set `NEXT_PUBLIC_PLAY_STORE_URL` and `NEXT_PUBLIC_APP_STORE_URL` after those listings exist. Until then every Get-on-iOS / Get-on-Android button still opens GitHub.

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

1. Create an app at [developer.whoop.com](https://developer.whoop.com).
2. Redirect URI: `http://localhost:3000/api/auth/callback`
3. Scopes: `read:recovery`, `read:cycles`, `read:sleep`, `read:workout`, `read:profile`, `read:body_measurement`, `offline`
4. Copy `.env.example` to `.env.local` and add your client id and secret.
5. Restart the app and tap **Connect WHOOP** in Settings.

WHOOP apps start in a sandbox with a member cap until they approve production access.
