import { Suspense } from "react";
import { CustomPlayer } from "@/components/CustomPlayer";

export default function CustomWorkoutPage() {
  return (
    <Suspense fallback={<p className="px-5 pt-16 text-sm text-muted">Loading…</p>}>
      <CustomPlayer />
    </Suspense>
  );
}
