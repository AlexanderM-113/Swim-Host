import { useListTeams } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function Teams() {
  const { data: teams, isLoading } = useListTeams();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teams & Schools</h1>
          <p className="text-muted-foreground">Manage participating organizations and clubs.</p>
        </div>
        <Link href="/teams/new" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
          <Plus className="mr-2 h-4 w-4" />
          Add Team
        </Link>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Search teams..." className="pl-8" />
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team Name</TableHead>
              <TableHead>Abbreviation</TableHead>
              <TableHead>LSC</TableHead>
              <TableHead>Coach</TableHead>
              <TableHead className="text-right">Athletes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">Loading...</TableCell>
              </TableRow>
            ) : teams?.map((team) => (
              <TableRow key={team.id}>
                <TableCell className="font-medium">
                  <Link href={`/teams/${team.id}`} className="text-primary hover:underline">
                    {team.name}
                  </Link>
                </TableCell>
                <TableCell><Badge variant="outline">{team.abbreviation || "-"}</Badge></TableCell>
                <TableCell>{team.lsc || "-"}</TableCell>
                <TableCell>{team.coachName || "-"}</TableCell>
                <TableCell className="text-right font-medium">{team.athleteCount || 0}</TableCell>
              </TableRow>
            ))}
            {!isLoading && (!teams || teams.length === 0) && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No teams found. Add one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
