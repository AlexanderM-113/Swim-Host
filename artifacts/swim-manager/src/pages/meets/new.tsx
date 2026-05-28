import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation } from "wouter";
import { useCreateMeet } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
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
import { Textarea } from "@/components/ui/textarea";

const meetSchema = z.object({
  name: z.string().min(2, "Meet name is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  facility: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  course: z.string().min(1, "Course is required"),
  meetType: z.string().min(1, "Meet type is required"),
  meetStyle: z.string().min(1, "Meet style is required"),
  meetClass: z.string().optional(),
  idFormat: z.string().optional(),
  hostLsc: z.string().optional(),
  altitude: z.coerce.number().optional(),
  entryDeadline: z.string().optional(),
  ageUpDate: z.string().optional(),
  scoringRules: z.string().optional(),
  lanes: z.coerce.number().min(1, "Must have at least 1 lane").default(8),
  notes: z.string().optional(),
});

type MeetFormValues = z.infer<typeof meetSchema>;

export default function NewMeet() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createMeet = useCreateMeet();

  const form = useForm<MeetFormValues>({
    resolver: zodResolver(meetSchema),
    defaultValues: {
      name: "",
      startDate: new Date().toISOString().split("T")[0],
      course: "SCY",
      meetType: "Standard",
      meetStyle: "Standard",
      lanes: 8,
    },
  });

  function onSubmit(data: MeetFormValues) {
    createMeet.mutate(
      { data },
      {
        onSuccess: (meet) => {
          toast({
            title: "Meet created",
            description: "Successfully created the new meet.",
          });
          setLocation(`/meets/${meet.id}`);
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to create meet.",
            variant: "destructive",
          });
        },
      }
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create New Meet</h1>
        <p className="text-muted-foreground">Set up the parameters for a new competition.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Basic Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Meet Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 2025 Spring Invitational" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
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
                          <SelectValue placeholder="Select course" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="SCY">Short Course Yards (SCY)</SelectItem>
                        <SelectItem value="SCM">Short Course Meters (SCM)</SelectItem>
                        <SelectItem value="LCM">Long Course Meters (LCM)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lanes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Lanes</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={12} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Location</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="facility"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Facility Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Aquatic Center" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Main St" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input placeholder="City" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State/Province</FormLabel>
                    <FormControl>
                      <Input placeholder="State" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Meet Configuration</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="meetType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meet Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Standard">Standard</SelectItem>
                        <SelectItem value="Divisions by Event">Divisions by Event</SelectItem>
                        <SelectItem value="Divisions by Team">Divisions by Team</SelectItem>
                        <SelectItem value="Time Standards">Time Standards</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="meetStyle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meet Style</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select style" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Standard">Standard Invitational</SelectItem>
                        <SelectItem value="2-Team Dual">2-Team Dual</SelectItem>
                        <SelectItem value="3+ Team Dual">3+ Team Dual</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="entryDeadline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entry Deadline</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ageUpDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Age-Up Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Any additional meet information..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => setLocation("/meets")}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMeet.isPending}>
              {createMeet.isPending ? "Creating..." : "Create Meet"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
