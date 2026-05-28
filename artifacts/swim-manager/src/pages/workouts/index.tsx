import { useListWorkouts } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Plus, Search, Calendar, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function Workouts() {
  const { data: workouts, isLoading } = useListWorkouts();

  if (isLoading) {
    return <div className="p-8">Loading workouts...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workout Manager</h1>
          <p className="text-muted-foreground">Plan and track training sessions.</p>
        </div>
        <Link href="/workouts/new" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
          <Plus className="mr-2 h-4 w-4" />
          Create Workout
        </Link>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Search workouts..." className="pl-8" />
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Distance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workouts?.map((workout) => (
              <TableRow key={workout.id}>
                <TableCell className="font-medium">
                  <Link href={`/workouts/${workout.id}`} className="text-primary hover:underline">
                    {workout.title}
                  </Link>
                </TableCell>
                <TableCell>
                  {workout.date ? format(new Date(workout.date), "MMM d, yyyy") : "-"}
                </TableCell>
                <TableCell>{workout.teamName || "General"}</TableCell>
                <TableCell className="font-mono">{workout.totalDistance || 0} {workout.course}</TableCell>
              </TableRow>
            ))}
            {(!workouts || workouts.length === 0) && (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  No workouts found. Create one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
