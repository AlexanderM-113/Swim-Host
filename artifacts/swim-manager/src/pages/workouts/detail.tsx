import { useRoute } from "wouter";
import { useGetWorkout, getGetWorkoutQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export default function WorkoutDetail() {
  const [, params] = useRoute("/workouts/:id");
  const workoutId = params?.id ? parseInt(params.id, 10) : 0;

  const { data: workout, isLoading } = useGetWorkout(workoutId, {
    query: { enabled: !!workoutId, queryKey: getGetWorkoutQueryKey(workoutId) }
  });

  if (isLoading) return <div className="p-8">Loading workout...</div>;
  if (!workout) return <div className="p-8">Workout not found</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{workout.title}</h1>
        <p className="text-muted-foreground mt-1">
          {workout.date ? format(new Date(workout.date), "EEEE, MMMM d, yyyy") : "No Date"} 
          {" • "}{workout.teamName || "General Group"}
          {" • "}<span className="font-mono text-primary font-bold">{workout.totalDistance} {workout.course}</span>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workout Sets</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Set</TableHead>
                <TableHead className="w-24 text-right">Count</TableHead>
                <TableHead className="w-24 text-right">Distance</TableHead>
                <TableHead className="w-32">Stroke</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-32">Interval</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workout.sets?.map((set, index) => (
                <TableRow key={set.id}>
                  <TableCell className="font-bold text-muted-foreground">{index + 1}</TableCell>
                  <TableCell className="text-right font-mono">{set.repetitions} x</TableCell>
                  <TableCell className="text-right font-mono">{set.distance}</TableCell>
                  <TableCell>{set.stroke || "-"}</TableCell>
                  <TableCell className="font-medium">{set.description}</TableCell>
                  <TableCell className="font-mono text-primary">{set.restInterval || "-"}</TableCell>
                </TableRow>
              ))}
              {(!workout.sets || workout.sets.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No sets found in this workout.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
