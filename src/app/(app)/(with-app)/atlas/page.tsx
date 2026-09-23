import { AtlasView } from "@/components/AtlasView";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Lab" };

export default function AtlasPage() {
  return <AtlasView />;
}
