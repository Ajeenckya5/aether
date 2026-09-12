import { notFound } from "next/navigation";
import { CoachPlayer } from "@/components/CoachPlayer";
import { coachBySlug } from "@/lib/coach";

export default async function CoachPlayerPage({
  params,
}: PageProps<"/coach/[slug]">) {
  const { slug } = await params;
  const session = coachBySlug(slug);
  if (!session) notFound();
  return <CoachPlayer session={session} liveHref={`/coach/live?kind=coach&id=${slug}`} />;
}
