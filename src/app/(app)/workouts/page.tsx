import { WorkoutsView } from "@/components/WorkoutsView";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Workouts" };

export default function WorkoutsPage() {
  return <WorkoutsView />;
}
