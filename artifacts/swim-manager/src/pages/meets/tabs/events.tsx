import { useState } from "react";
import { useListEvents, useCreateEvent, getListEventsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const eventSchema = z.object({
  eventNumber: z.coerce.number().min(1),
  gender: z.string().min(1),
  ageGroup: z.string().optional(),
  distance: z.coerce.number().min(25),
  stroke: z.string().min(1),
  eventType: z.string().default("Standard"),
  heatOrder: z.string().default("Slow-to-Fast"),
  isRelay: z.boolean().default(false),
});

export default function MeetEvents({ meetId }: { meetId: number }) {
  const { data: events, isLoading } = useListEvents(meetId, {
    query: { enabled: !!meetId, queryKey: getListEventsQueryKey(meetId) }
  });
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const createEvent = useCreateEvent();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof eventSchema>>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      eventNumber: (events?.length || 0) + 1,
      gender: "M",
      distance: 50,
      stroke: "Freestyle",
      eventType: "Standard",
      heatOrder: "Slow-to-Fast",
      isRelay: false,
    }
  });

  function onSubmit(data: z.infer<typeof eventSchema>) {
    createEvent.mutate(
      { data: { ...data, meetId } },
      {
        onSuccess: () => {
          toast({ title: "Event created" });
          setIsDialogOpen(false);
          form.reset({
            eventNumber: data.eventNumber + 1,
            gender: data.gender,
            distance: data.distance,
            stroke: data.stroke,
            eventType: data.eventType,
            heatOrder: data.heatOrder,
            isRelay: data.isRelay,
          });
          queryClient.invalidateQueries({ queryKey: getListEventsQueryKey(meetId) });
        },
        onError: (error: any) => {
          const errorMessage = error?.response?.data?.error || error?.message || "Failed to create event";
          console.error("Event creation error:", error);
          toast({ title: "Failed to create event", description: errorMessage, variant: "destructive" });
        }
      }
    );
  }

  if (isLoading) return <div>Loading events...</div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Events</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add Event</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Event</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="eventNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Event #</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
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
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="M">Men</SelectItem>
                            <SelectItem value="F">Women</SelectItem>
                            <SelectItem value="Mixed">Mixed</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="distance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Distance</FormLabel>
                        <FormControl><Input type="number" step="25" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="stroke"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stroke</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="Freestyle">Freestyle</SelectItem>
                            <SelectItem value="Backstroke">Backstroke</SelectItem>
                            <SelectItem value="Breaststroke">Breaststroke</SelectItem>
                            <SelectItem value="Butterfly">Butterfly</SelectItem>
                            <SelectItem value="Individual Medley">Individual Medley</SelectItem>
                            <SelectItem value="Freestyle Relay">Freestyle Relay</SelectItem>
                            <SelectItem value="Medley Relay">Medley Relay</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ageGroup"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Age Group</FormLabel>
                        <FormControl><Input placeholder="e.g. 13-14, Open" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={createEvent.isPending}>Add Event</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event #</TableHead>
              <TableHead>Age Group</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Distance</TableHead>
              <TableHead>Stroke</TableHead>
              <TableHead>Entries</TableHead>
              <TableHead>Heats</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events?.map(event => (
              <TableRow key={event.id}>
                <TableCell className="font-medium">{event.eventNumber}</TableCell>
                <TableCell>{event.ageGroup || "Open"}</TableCell>
                <TableCell>{event.gender === 'M' ? 'Men' : event.gender === 'F' ? 'Women' : 'Mixed'}</TableCell>
                <TableCell>{event.distance}</TableCell>
                <TableCell>{event.stroke}</TableCell>
                <TableCell>{event.entryCount || 0}</TableCell>
                <TableCell>{event.heatCount || 0}</TableCell>
                <TableCell>
                  <Badge variant="outline">{event.status || 'pending'}</Badge>
                </TableCell>
              </TableRow>
            ))}
            {(!events || events.length === 0) && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-4 text-muted-foreground">
                  No events added yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
