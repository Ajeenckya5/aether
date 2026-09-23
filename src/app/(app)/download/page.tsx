import { DownloadView } from "@/components/DownloadView";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Download" };

export default function DownloadPage() {
  return <DownloadView />;
}
