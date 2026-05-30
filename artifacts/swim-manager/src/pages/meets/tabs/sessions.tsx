import { useListSessions, getListSessionsQueryKey } from "@/lib/local-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export default function MeetSessions({ meetId }: { meetId: number }) {
  const { data: sessions, isLoading } = useListSessions(meetId, {
    query: { enabled: !!meetId, queryKey: getListSessionsQueryKey(meetId) }
  });

  if (isLoading) return <div>Loading sessions...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sessions</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Warmup</TableHead>
              <TableHead>Start Time</TableHead>
              <TableHead>Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions?.map(session => (
              <TableRow key={session.id}>
                <TableCell>{(session as any).sessionNumber}</TableCell>
                <TableCell className="font-medium">{session.name}</TableCell>
                <TableCell>{session.date ? format(new Date(session.date), "MMM d, yyyy") : "-"}</TableCell>
                <TableCell>{session.warmupTime || "-"}</TableCell>
                <TableCell>{session.startTime || "-"}</TableCell>
                <TableCell>{(session as any).sessionType || "-"}</TableCell>
              </TableRow>
            ))}
            {(!sessions || sessions.length === 0) && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                  No sessions defined for this meet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
