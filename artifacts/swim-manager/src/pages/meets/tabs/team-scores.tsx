import { useGetMeetTeamScores, getGetMeetTeamScoresQueryKey } from "@/lib/local-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function MeetTeamScores({ meetId }: { meetId: number }) {
  const { data: scores, isLoading } = useGetMeetTeamScores(meetId, {
    query: { enabled: !!meetId, queryKey: getGetMeetTeamScoresQueryKey(meetId) }
  });

  if (isLoading) return <div>Loading scores...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Scores</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Place</TableHead>
              <TableHead>Team</TableHead>
              <TableHead className="text-right">Points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scores?.map(score => (
              <TableRow key={score.teamId}>
                <TableCell className="font-bold">{(score as any).place ?? (scores?.indexOf(score) ?? 0) + 1}</TableCell>
                <TableCell className="font-medium">
                  {score.teamName} {(score as any).teamAbbreviation && <span className="text-muted-foreground ml-2 text-sm">({(score as any).teamAbbreviation})</span>}
                </TableCell>
                <TableCell className="text-right font-mono font-bold text-lg text-primary">{(score as any).points ?? score.score}</TableCell>
              </TableRow>
            ))}
            {(!scores || scores.length === 0) && (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                  No scores available yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
