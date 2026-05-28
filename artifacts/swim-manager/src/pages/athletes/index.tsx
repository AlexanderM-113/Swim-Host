import { useListAthletes, useListTeams } from "@workspace/api-client-react";
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
import { useState } from "react";

export default function Athletes() {
  const [search, setSearch] = useState("");
  const { data: athletes, isLoading } = useListAthletes({ search: search || undefined });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Roster</h1>
          <p className="text-muted-foreground">Manage athlete profiles, medical information, and records.</p>
        </div>
        <Link href="/athletes/new" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
          <Plus className="mr-2 h-4 w-4" />
          Add Athlete
        </Link>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            type="search" 
            placeholder="Search athletes by name..." 
            className="pl-8" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Age / DOB</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>ID Number</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">Loading...</TableCell>
              </TableRow>
            ) : athletes?.map((athlete) => (
              <TableRow key={athlete.id}>
                <TableCell className="font-medium">
                  <Link href={`/athletes/${athlete.id}`} className="text-primary hover:underline">
                    {athlete.lastName}, {athlete.firstName}
                  </Link>
                </TableCell>
                <TableCell>{athlete.gender}</TableCell>
                <TableCell>
                  {athlete.age ? athlete.age : "-"} 
                  {athlete.dateOfBirth && <span className="text-muted-foreground text-xs ml-2">({athlete.dateOfBirth})</span>}
                </TableCell>
                <TableCell>{athlete.teamName || "Unattached"}</TableCell>
                <TableCell className="font-mono text-xs">{athlete.idNumber || "-"}</TableCell>
              </TableRow>
            ))}
            {!isLoading && (!athletes || athletes.length === 0) && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No athletes found. Add one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
