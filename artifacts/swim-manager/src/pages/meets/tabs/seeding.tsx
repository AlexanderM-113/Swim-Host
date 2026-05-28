import { useListEvents, useSeedEvent, getListEventsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function MeetSeeding({ meetId }: { meetId: number }) {
  const { data: events, isLoading } = useListEvents(meetId, {
    query: { enabled: !!meetId, queryKey: getListEventsQueryKey(meetId) }
  });
  const seedEvent = useSeedEvent();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSeed = (eventId: number) => {
    seedEvent.mutate({
      data: { lanes: 8, heatOrder: "Slow-to-Fast" }
    }, {
      onSuccess: () => {
        toast({ title: "Event seeded successfully" });
        queryClient.invalidateQueries({ queryKey: getListEventsQueryKey(meetId) });
      },
      onError: () => {
        toast({ title: "Seeding failed", variant: "destructive" });
      }
    });
  };

  if (isLoading) return <div>Loading events...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Seeding Management</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Entries</TableHead>
              <TableHead>Heats</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events?.map(event => (
              <TableRow key={event.id}>
                <TableCell className="font-medium">
                  Event {event.eventNumber}: {event.gender} {event.ageGroup} {event.distance} {event.stroke}
                </TableCell>
                <TableCell>{event.entryCount || 0}</TableCell>
                <TableCell>{event.heatCount || 0}</TableCell>
                <TableCell>
                  <Badge variant={event.status === 'seeded' ? 'default' : 'outline'}>
                    {event.status || 'unseeded'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button 
                    size="sm" 
                    variant={event.status === 'seeded' ? "outline" : "default"}
                    onClick={() => handleSeed(event.id)}
                    disabled={seedEvent.isPending || (event.entryCount || 0) === 0}
                  >
                    {event.status === 'seeded' ? 'Re-seed' : 'Seed Event'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
