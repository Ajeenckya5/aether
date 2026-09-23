import { CoachView } from "@/components/CoachView";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Coach" };

export default function CoachPage() {
  return <CoachView />;
}
