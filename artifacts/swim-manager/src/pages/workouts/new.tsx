import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation } from "wouter";
import { useCreateWorkout, useListTeams } from "@/lib/local-store";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";

const workoutSetSchema = z.object({
  setOrder: z.number(),
  repetitions: z.coerce.number().min(1).optional(),
  distance: z.coerce.number().min(1).optional(),
  stroke: z.string().optional(),
  restInterval: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  intensity: z.string().optional()
});

const workoutSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  teamId: z.coerce.number().optional(),
  date: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  course: z.string().optional(),
  sets: z.array(workoutSetSchema).default([])
});

type WorkoutFormValues = z.infer<typeof workoutSchema>;

export default function NewWorkout() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createWorkout = useCreateWorkout();
  const { data: teams } = useListTeams();

  const form = useForm<WorkoutFormValues>({
    resolver: zodResolver(workoutSchema),
    defaultValues: {
      title: "",
      course: "SCY",
      sets: [
        { setOrder: 1, repetitions: 1, distance: 200, stroke: "Choice", description: "Warmup" }
      ]
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "sets"
  });

  function onSubmit(data: WorkoutFormValues) {
    const totalDistance = data.sets.reduce((acc, set) => {
      return acc + ((set.repetitions || 1) * (set.distance || 0));
    }, 0);

    createWorkout.mutate(
      { data: { ...data, totalDistance } },
      {
        onSuccess: (workout) => {
          toast({
            title: "Workout created",
            description: "Successfully built the workout.",
          });
          setLocation(`/workouts/${workout.id}`);
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to create workout.",
            variant: "destructive",
          });
        },
      }
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Workout</h1>
        <p className="text-muted-foreground">Build a new training session with sets and intervals.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Workout Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="col-span-3 md:col-span-2">
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Aerobic Threshold" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="course"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Course</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Course" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="SCY">SCY</SelectItem>
                        <SelectItem value="SCM">SCM</SelectItem>
                        <SelectItem value="LCM">LCM</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="teamId"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Team/Group</FormLabel>
                    <Select onValueChange={(val) => field.onChange(Number(val))} defaultValue={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select team (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {teams?.map((t) => (
                          <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Sets Builder</CardTitle>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => append({ setOrder: fields.length + 1, repetitions: 1, distance: 100, stroke: "", description: "" })}
              >
                <Plus className="h-4 w-4 mr-2" /> Add Set
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-4 items-start p-4 border rounded-md bg-muted/20">
                  <div className="font-mono font-bold mt-2 w-6 text-center text-muted-foreground">{index + 1}</div>
                  
                  <FormField
                    control={form.control}
                    name={`sets.${index}.repetitions`}
                    render={({ field }) => (
                      <FormItem className="w-20">
                        <FormLabel>Reps</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <div className="mt-8 font-bold text-muted-foreground">x</div>
                  <FormField
                    control={form.control}
                    name={`sets.${index}.distance`}
                    render={({ field }) => (
                      <FormItem className="w-24">
                        <FormLabel>Dist</FormLabel>
                        <FormControl>
                          <Input type="number" step="25" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`sets.${index}.stroke`}
                    render={({ field }) => (
                      <FormItem className="w-32">
                        <FormLabel>Stroke</FormLabel>
                        <FormControl>
                          <Input placeholder="Free" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`sets.${index}.restInterval`}
                    render={({ field }) => (
                      <FormItem className="w-32">
                        <FormLabel>Interval/Rest</FormLabel>
                        <FormControl>
                          <Input placeholder="@ 1:30" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`sets.${index}.description`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Descend 1-4" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {fields.length === 0 && (
                <div className="text-center py-8 text-muted-foreground border border-dashed rounded-md">
                  No sets added. Click "Add Set" to begin building the workout.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => setLocation("/workouts")}>
              Cancel
            </Button>
            <Button type="submit" disabled={createWorkout.isPending}>
              {createWorkout.isPending ? "Saving..." : "Save Workout"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
