import { useState } from "react";
import { useListEvents, useListEntries, getListEntriesQueryKey, useCreateEntry } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatTime } from "@/lib/format-time";

export default function MeetAthletes({ meetId }: { meetId: number }) {
  const { data: events } = useListEvents(meetId);
  const [selectedEvent, setSelectedEvent] = useState<string>("");

  const { data: entries, isLoading } = useListEntries(
    selectedEvent ? parseInt(selectedEvent, 10) : 0, 
    { query: { enabled: !!selectedEvent, queryKey: getListEntriesQueryKey(parseInt(selectedEvent, 10)) } }
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Athletes & Entries</CardTitle>
        <div className="w-[300px]">
          <Select value={selectedEvent} onValueChange={setSelectedEvent}>
            <SelectTrigger>
              <SelectValue placeholder="Select Event" />
            </SelectTrigger>
            <SelectContent>
              {events?.map(event => (
                <SelectItem key={event.id} value={event.id.toString()}>
                  Event {event.eventNumber}: {event.gender} {event.ageGroup} {event.distance} {event.stroke}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {!selectedEvent ? (
          <div className="text-center py-8 text-muted-foreground">
            Please select an event to view entries.
          </div>
        ) : isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading entries...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Athlete</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Seed Time</TableHead>
                <TableHead>Heat</TableHead>
                <TableHead>Lane</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries?.map(entry => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{entry.athleteName}</TableCell>
                  <TableCell>{entry.teamName || "Unattached"}</TableCell>
                  <TableCell className="font-mono">{entry.seedTime ? formatTime(entry.seedTime) : "NT"}</TableCell>
                  <TableCell>{entry.heatNumber || "-"}</TableCell>
                  <TableCell>{entry.lane || "-"}</TableCell>
                  <TableCell>{entry.scratched ? <span className="text-destructive font-bold">SCR</span> : "Entered"}</TableCell>
                </TableRow>
              ))}
              {(!entries || entries.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No entries for this event.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
