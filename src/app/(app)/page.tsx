import { TodayStatic } from "@/components/TodayStatic";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Today" };

export default function TodayPage() {
  return <TodayStatic />;
}
