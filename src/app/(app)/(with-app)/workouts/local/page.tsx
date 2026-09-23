import { Suspense } from "react";
import { LiveLogReview } from "@/components/LiveLogReview";

export default function LocalWorkoutPage() {
  return (
    <Suspense fallback={<p className="px-5 pt-16 text-sm text-muted">Loading…</p>}>
      <LiveLogReview />
    </Suspense>
  );
}
