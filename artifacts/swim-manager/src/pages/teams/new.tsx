import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation } from "wouter";
import { useCreateTeam } from "@/lib/local-store";
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
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const teamSchema = z.object({
  name: z.string().min(2, "Team name is required"),
  abbreviation: z.string().optional(),
  shortName: z.string().optional(),
  lsc: z.string().optional(),
  coachName: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email address").or(z.literal("")),
});

type TeamFormValues = z.infer<typeof teamSchema>;

export default function NewTeam() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createTeam = useCreateTeam();

  const form = useForm<TeamFormValues>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      name: "",
      abbreviation: "",
      shortName: "",
      lsc: "",
      coachName: "",
      email: "",
    },
  });

  function onSubmit(data: TeamFormValues) {
    createTeam.mutate(
      { data },
      {
        onSuccess: (team) => {
          toast({
            title: "Team created",
            description: "Successfully created the new team.",
          });
          setLocation(`/teams`);
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to create team.",
            variant: "destructive",
          });
        },
      }
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Add New Team</h1>
        <p className="text-muted-foreground">Register a new club or school.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Team Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Full Team Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Aquatic Club" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="shortName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Short Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Aquatics" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="abbreviation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Abbreviation (max 5 chars)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. AC" maxLength={5} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lsc"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>LSC</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. PC" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="coachName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Head Coach</FormLabel>
                    <FormControl>
                      <Input placeholder="Coach Name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => setLocation("/teams")}>
              Cancel
            </Button>
            <Button type="submit" disabled={createTeam.isPending}>
              {createTeam.isPending ? "Creating..." : "Create Team"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
