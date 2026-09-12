"use client";

import { AtlasPanel } from "./AtlasPanel";
import { SourceBanner } from "./SourceBanner";
import { useLab } from "./useLab";

export function AtlasView() {
  const { atlas } = useLab();
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
        unavailable instead of guessed. Age and HRmax live in Settings.
      </p>
      <div className="mt-6">
        <AtlasPanel atlas={atlas} />
      </div>
    </div>
  );
}
