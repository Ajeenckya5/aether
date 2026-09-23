import { Suspense } from "react";
import { BuildClient } from "@/components/BuildClient";

export default function BuildPage() {
  return (
    <Suspense fallback={<p className="px-5 pt-16 text-sm text-muted">Opening builder…</p>}>
      <BuildClient />
    </Suspense>
  );
}
