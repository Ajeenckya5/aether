import { WorkoutDetailView } from "@/components/WorkoutDetailView";

export default async function WorkoutDetailPage({
  params,
}: PageProps<"/workouts/[id]">) {
  const { id } = await params;
  return <WorkoutDetailView id={id} />;
}
