import { Suspense } from "react";
import { SettingsView } from "@/components/SettingsView";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="px-5 pt-8 text-sm text-muted">Loading…</p>}>
      <SettingsView />
    </Suspense>
  );
}
