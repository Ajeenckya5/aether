import { Suspense } from "react";
import { LiveClient } from "@/components/LiveClient";

export default function LivePage() {
  return (
    <Suspense fallback={<p className="px-5 pt-16 text-sm text-muted">Opening live track…</p>}>
      <LiveClient />
    </Suspense>
  );
}
