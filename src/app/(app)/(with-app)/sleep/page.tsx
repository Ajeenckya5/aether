import { SleepView } from "@/components/SleepView";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sleep" };

export default function SleepPage() {
  return <SleepView />;
}
