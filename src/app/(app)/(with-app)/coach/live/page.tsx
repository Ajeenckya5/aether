import { Suspense } from "react";
import { LiveClient } from "@/components/LiveClient";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Live" };

export default function LivePage() {
  return (
    <Suspense fallback={<p className="px-5 pt-16 text-sm text-muted">Opening live track…</p>}>
      <LiveClient />
    </Suspense>
  );
}
