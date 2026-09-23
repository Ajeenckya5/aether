import { HomeFrame } from "@/components/HomeFrame";
import { TodayStatic } from "@/components/TodayStatic";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Today" };

export default function TodayPage() {
  return (
    <HomeFrame>
      <TodayStatic />
    </HomeFrame>
  );
}
