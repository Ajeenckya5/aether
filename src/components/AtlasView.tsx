"use client";

import { AgeCard } from "./AgeCard";
import { AtlasPanel } from "./AtlasPanel";
import { SourceBanner } from "./SourceBanner";
import { useAtlas } from "./useAtlas";
import { useLab } from "./useLab";

export function AtlasView() {
  const { data, journal, athlete, bioAge } = useLab();
  const atlas = useAtlas(data, journal, athlete);
  return (
    <div className="px-5 pt-6 pb-8">
      <SourceBanner />
      <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-lime">
        Published algorithms
      </p>
      <h1 className="font-display mt-2 text-4xl">Atlas</h1>
      <p className="mt-2 text-sm text-muted">
        Every formula this band, journal, and body stats can drive, with
        citations. Metrics that need ECG, GPS, power, or blood are listed as
        unavailable instead of guessed. Age, height, weight, and HRmax live in Settings.
        Biological age is Klemera–Doubal from those plus the band — not WHOOP Healthspan.
      </p>
      <div className="mt-6 space-y-4">
        <AgeCard report={bioAge} />
        <AtlasPanel atlas={atlas} />
      </div>
    </div>
  );
}
