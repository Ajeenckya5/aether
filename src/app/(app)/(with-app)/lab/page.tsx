import { LabView } from "@/components/LabView";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Lab" };

export default function LabPage() {
  return <LabView />;
}
