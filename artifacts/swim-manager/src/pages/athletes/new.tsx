import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation } from "wouter";
import { useCreateAthlete, useListTeams } from "@/lib/local-store";
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
import { Textarea } from "@/components/ui/textarea";

const TRAINING_GROUPS = [
  "Elite", "Senior", "Junior", "Age Group A", "Age Group B",
  "Developmental", "Recreational", "Masters",
];

const athleteSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  gender: z.string().min(1, "Gender is required"),
  dateOfBirth: z.string().optional(),
  teamId: z.coerce.number().optional(),
  idNumber: z.string().optional(),
  idFormat: z.string().optional(),
  trainingGroup: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").or(z.literal("")).optional(),
  website: z.string().url("Invalid URL — include https://").or(z.literal("")).optional(),
  parentName: z.string().optional(),
  parentPhone: z.string().optional(),
  parentEmail: z.string().email("Invalid email").or(z.literal("")).optional(),
  healthNotes: z.string().optional(),
  notes: z.string().optional(),
});

type AthleteFormValues = z.infer<typeof athleteSchema>;

export default function NewAthlete() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createAthlete = useCreateAthlete();
  const { data: teams } = useListTeams();

  const form = useForm<AthleteFormValues>({
    resolver: zodResolver(athleteSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      gender: "M",
      email: "",
      website: "",
      parentEmail: "",
    },
  });

  function onSubmit(data: AthleteFormValues) {
    const payload: any = {
      ...data,
      active: true,
      teamId: data.teamId && data.teamId > 0 ? data.teamId : undefined,
    };
    createAthlete.mutate(
      { data: payload },
      {
        onSuccess: () => {
          toast({
            title: "Athlete created",
            description: "Successfully added the new athlete.",
          });
          setLocation(`/athletes`);
        },
        onError: (err) => {
          console.error("Create athlete error:", err);
          toast({
            title: "Error",
            description: "Failed to create athlete.",
            variant: "destructive",
          });
        },
      }
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Add New Athlete</h1>
        <p className="text-muted-foreground">Register a new swimmer to the system.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Personal Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="M">Male</SelectItem>
                        <SelectItem value="F">Female</SelectItem>
                        <SelectItem value="X">Mixed/Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth</FormLabel>
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
                  <FormItem>
                    <FormLabel>Team <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(val === "0" ? undefined : Number(val))}
                      defaultValue={field.value?.toString() ?? "0"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="No team / Unattached" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0">— No team / Unattached —</SelectItem>
                        {teams?.map((t) => (
                          <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="trainingGroup"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Training Group</FormLabel>
                    <Select onValueChange={(val) => field.onChange(val === "none" ? undefined : val)} value={field.value ?? "none"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select group (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">— None —</SelectItem>
                        {TRAINING_GROUPS.map((g) => (
                          <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="idNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Registration ID</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. USA Swimming ID" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+1 555-000-0000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="athlete@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Personal Website (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://athleteprofile.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="md:col-span-2 border-t pt-4">
                <p className="text-sm font-semibold text-muted-foreground mb-4">Parent / Guardian</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="parentName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parent / Guardian Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Jane Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="parentPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parent Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="+1 555-000-0001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="parentEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parent Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="parent@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Medical & Notes</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-6">
              <FormField
                control={form.control}
                name="healthNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Health Notes / Allergies</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Any medical conditions, allergies, or emergency information..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>General Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Any additional notes about this athlete..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => setLocation("/athletes")}>
              Cancel
            </Button>
            <Button type="submit" disabled={createAthlete.isPending}>
              {createAthlete.isPending ? "Adding..." : "Add Athlete"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
