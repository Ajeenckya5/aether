import { StrainView } from "@/components/StrainView";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Strain" };

export default function StrainPage() {
  return <StrainView />;
}
