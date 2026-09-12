import { SleepDetailView } from "@/components/SleepDetailView";

export default async function SleepDetailPage({
  params,
}: PageProps<"/sleep/[id]">) {
  const { id } = await params;
  return <SleepDetailView id={id} />;
}
