import { Suspense } from "react";
import { SleepViewClient } from "@/components/SleepViewClient";

export default function SleepViewPage() {
  return (
    <Suspense fallback={<p className="px-5 pt-16 text-sm text-muted">Loading night…</p>}>
      <SleepViewClient />
    </Suspense>
  );
}
