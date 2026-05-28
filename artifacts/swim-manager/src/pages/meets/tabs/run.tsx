import { useState } from "react";
import { useListEvents, useListHeats, getListHeatsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatTime } from "@/lib/format-time";

export default function MeetRun({ meetId }: { meetId: number }) {
  const { data: events } = useListEvents(meetId);
  const [selectedEvent, setSelectedEvent] = useState<string>("");

  const { data: heats, isLoading } = useListHeats(
    selectedEvent ? parseInt(selectedEvent, 10) : 0, 
    { query: { enabled: !!selectedEvent, queryKey: getListHeatsQueryKey(parseInt(selectedEvent, 10)) } }
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Live Meet Running</CardTitle>
          <div className="w-[300px]">
            <Select value={selectedEvent} onValueChange={setSelectedEvent}>
              <SelectTrigger>
                <SelectValue placeholder="Select Event to Run" />
              </SelectTrigger>
              <SelectContent>
                {events?.filter(e => e.status === 'seeded' || e.status === 'completed').map(event => (
                  <SelectItem key={event.id} value={event.id.toString()}>
                    Event {event.eventNumber}: {event.gender} {event.distance} {event.stroke}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {selectedEvent && (
        <div className="space-y-6">
          {isLoading ? (
            <div className="text-center py-8">Loading heats...</div>
          ) : heats?.map(heat => (
            <Card key={heat.id}>
              <CardHeader>
                <CardTitle className="text-lg">Heat {heat.heatNumber}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Lane</TableHead>
                      <TableHead>Athlete</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Seed</TableHead>
                      <TableHead>Result Time</TableHead>
                      <TableHead className="w-24">Place</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {heat.lanes?.map(lane => (
                      <TableRow key={lane.lane}>
                        <TableCell className="font-bold">{lane.lane}</TableCell>
                        <TableCell className={lane.athleteId ? "font-medium" : "text-muted-foreground"}>
                          {lane.athleteName || "Empty"}
                        </TableCell>
                        <TableCell>{lane.teamName || "-"}</TableCell>
                        <TableCell className="font-mono">{lane.seedTime ? formatTime(lane.seedTime) : "NT"}</TableCell>
                        <TableCell className="font-mono">
                          {lane.finishTime ? formatTime(lane.finishTime) : "-"}
                        </TableCell>
                        <TableCell className="font-bold">{lane.place || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
          {(!heats || heats.length === 0) && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No heats found. Ensure the event is seeded.
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
