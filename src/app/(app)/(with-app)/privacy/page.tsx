import { PrivacyView } from "@/components/PrivacyView";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return <PrivacyView />;
}
