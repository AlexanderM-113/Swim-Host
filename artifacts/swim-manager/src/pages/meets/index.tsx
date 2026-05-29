import { useListMeets } from "@/lib/local-store";
import { format } from "date-fns";
import { Link } from "wouter";
import { Plus, Search, Calendar, MapPin } from "lucide-react";
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

export default function Meets() {
  const { data: meets, isLoading } = useListMeets();

  if (isLoading) {
    return <div className="p-8">Loading meets...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meet Manager</h1>
          <p className="text-muted-foreground">Manage upcoming and historical swim meets.</p>
        </div>
        <Link href="/meets/new" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
          <Plus className="mr-2 h-4 w-4" />
          Create Meet
        </Link>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Search meets..." className="pl-8" />
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Meet Name</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {meets?.map((meet) => (
              <TableRow key={meet.id}>
                <TableCell className="font-medium">
                  <Link href={`/meets/${meet.id}`} className="text-primary hover:underline">
                    {meet.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="mr-2 h-3 w-3" />
                    {format(new Date(meet.startDate), "MMM d, yyyy")}
                    {meet.endDate && ` - ${format(new Date(meet.endDate), "MMM d, yyyy")}`}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <MapPin className="mr-2 h-3 w-3" />
                    {meet.facility ? `${meet.facility}, ${meet.city}` : "TBA"}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{meet.course}</Badge>
                </TableCell>
                <TableCell>
                  <Badge 
                    variant={
                      meet.status === 'upcoming' ? 'secondary' : 
                      meet.status === 'active' ? 'default' : 
                      'outline'
                    }
                  >
                    {meet.status?.toUpperCase() || 'UPCOMING'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {(!meets || meets.length === 0) && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No meets found. Create one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
