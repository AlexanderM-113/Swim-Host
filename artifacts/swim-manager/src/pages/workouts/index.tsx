import { useState } from "react";
import { useListWorkouts } from "@/lib/local-store";
import { Link } from "wouter";
import { Plus, Search, Dumbbell, Waves, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import DryLandProgram from "./dryland";
import TimeTrialsManager from "./time-trials";

function SwimWorkouts() {
  const { data: workouts, isLoading } = useListWorkouts();
  const [search, setSearch] = useState("");

  const filtered = (workouts ?? []).filter((w) => {
    const q = search.toLowerCase();
    return !q || (w as any).title?.toLowerCase().includes(q) || w.name?.toLowerCase().includes(q);
  });

  if (isLoading) {
    return <div className="py-12 text-center text-muted-foreground">Loading workouts…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Waves className="h-5 w-5 text-cyan-500" />
            Swim Workouts
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">All pool training sessions</p>
        </div>
        <Link href="/workouts/new">
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Create Workout
          </Button>
        </Link>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search workouts…"
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
            {filtered.map((workout) => (
              <TableRow key={workout.id}>
                <TableCell className="font-medium">
                  <Link href={`/workouts/${workout.id}`} className="text-primary hover:underline">
                    {(workout as any).title || workout.name}
                  </Link>
                </TableCell>
                <TableCell>
                  {workout.date ? format(new Date(workout.date), "MMM d, yyyy") : "—"}
                </TableCell>
                <TableCell>{(workout as any).teamName || "General"}</TableCell>
                <TableCell className="font-mono">
                  {(workout as any).totalDistance || (workout as any).distance || 0} {(workout as any).course}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  {search ? "No workouts match your search." : "No workouts yet. Create one to get started."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function Workouts() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Workout Manager</h1>
        <p className="text-muted-foreground">Plan and track pool training and dry land sessions.</p>
      </div>

      <Tabs defaultValue="swim">
        <TabsList>
          <TabsTrigger value="swim">
            <Waves className="h-4 w-4 mr-1.5" />
            Swim Workouts
          </TabsTrigger>
          <TabsTrigger value="dryland">
            <Dumbbell className="h-4 w-4 mr-1.5" />
            Dry Land Program
          </TabsTrigger>
          <TabsTrigger value="timetrials">
            <ClipboardList className="h-4 w-4 mr-1.5" />
            Time Trials
          </TabsTrigger>
        </TabsList>

        <TabsContent value="swim" className="mt-4">
          <SwimWorkouts />
        </TabsContent>

        <TabsContent value="dryland" className="mt-4">
          <DryLandProgram />
        </TabsContent>

        <TabsContent value="timetrials" className="mt-4">
          <TimeTrialsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
