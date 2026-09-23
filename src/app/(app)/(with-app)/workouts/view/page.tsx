import { Suspense } from "react";
import { WorkoutViewClient } from "@/components/WorkoutViewClient";

export default function WorkoutViewPage() {
  return (
    <Suspense fallback={<p className="px-5 pt-16 text-sm text-muted">Loading session…</p>}>
      <WorkoutViewClient />
    </Suspense>
  );
}
