import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useListEvents, useListEntries, useUpdateEntry, getListEntriesQueryKey } from "@/lib/local-store";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, CheckCircle2, XCircle, AlertCircle, Search } from "lucide-react";
import { formatTime } from "@/lib/format-time";

export default function MeetDeclarations({ meetId }: { meetId: number }) {
  const [selectedEvent, setSelectedEvent] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const [search, setSearch] = useState("");
  const { data: events = [], isLoading: eventsLoading } = useListEvents(meetId, { query: { enabled: !!meetId } });
  const { data: entries = [], isLoading: entriesLoading } = useListEntries(
    selectedEvent ? parseInt(selectedEvent) : 0,
    { query: { enabled: !!selectedEvent } }
  );
  const updateEntry = useUpdateEntry();
  const { toast } = useToast();
  const qc = useQueryClient();

  const teams = [...new Set((entries as any[]).map((e: any) => e.teamName).filter(Boolean))].sort();

  const filtered = (entries as any[]).filter(e => {
    if (teamFilter !== "all" && e.teamName !== teamFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!`${e.firstName} ${e.lastName}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const declared = filtered.filter(e => !e.scratched);
  const scratched = filtered.filter(e => e.scratched);

  async function toggleScratch(entryId: number, currentScratched: boolean) {
    try {
      await updateEntry.mutateAsync({ id: entryId, data: { scratched: !currentScratched } });
      qc.invalidateQueries({ queryKey: getListEntriesQueryKey(parseInt(selectedEvent)) });
      toast({ title: !currentScratched ? "Entry scratched" : "Scratch withdrawn" });
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  }

  async function scratchAll() {
    for (const e of declared) {
      await updateEntry.mutateAsync({ id: e.id, data: { scratched: true } });
    }
    qc.invalidateQueries({ queryKey: getListEntriesQueryKey(parseInt(selectedEvent)) });
    toast({ title: `Scratched ${declared.length} entries` });
  }

  async function declareAll() {
    for (const e of scratched) {
      await updateEntry.mutateAsync({ id: e.id, data: { scratched: false } });
    }
    qc.invalidateQueries({ queryKey: getListEntriesQueryKey(parseInt(selectedEvent)) });
    toast({ title: `Declared ${scratched.length} entries` });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Entry Declarations & Scratches</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs mb-1 block">Event</Label>
          <Select value={selectedEvent} onValueChange={setSelectedEvent}>
            <SelectTrigger><SelectValue placeholder="Select event..." /></SelectTrigger>
            <SelectContent>
              {(events as any[]).map((e: any) => (
                <SelectItem key={e.id} value={String(e.id)}>
                  #{e.eventNumber} — {e.distance}{e.stroke} {e.gender}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1 block">Filter by Team</Label>
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger><SelectValue placeholder="All teams" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All teams</SelectItem>
              {teams.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1 block">Search Athlete</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name..." className="pl-8" />
          </div>
        </div>
      </div>

      {!selectedEvent && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>Select an event to manage declarations and scratches.</p>
          </CardContent>
        </Card>
      )}

      {selectedEvent && (
        <>
          <div className="flex items-center gap-3">
            <div className="flex gap-2 text-sm text-muted-foreground">
              <span className="text-green-500 font-semibold">{declared.length} declared</span>
              <span>·</span>
              <span className="text-red-400 font-semibold">{scratched.length} scratched</span>
              <span>·</span>
              <span>{filtered.length} total entries</span>
            </div>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" onClick={declareAll} disabled={scratched.length === 0}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Declare All
              </Button>
              <Button size="sm" variant="outline" onClick={scratchAll} disabled={declared.length === 0}
                className="text-red-500 border-red-300 hover:bg-red-50">
                <XCircle className="h-3.5 w-3.5 mr-1" />Scratch All
              </Button>
            </div>
          </div>

          {entriesLoading && <div className="py-8 text-center text-muted-foreground">Loading entries...</div>}

          {!entriesLoading && filtered.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground">No entries for this event.</CardContent>
            </Card>
          )}

          {!entriesLoading && filtered.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Athlete</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-right">Seed Time</TableHead>
                      <TableHead className="text-right">Heat / Lane</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((e: any) => (
                      <TableRow key={e.id} className={e.scratched ? "opacity-50" : ""}>
                        <TableCell className="font-semibold">
                          {e.firstName} {e.lastName}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{e.teamName || "—"}</TableCell>
                        <TableCell className="text-right font-mono">
                          {e.seedTime ? formatTime(e.seedTime) : "NT"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-muted-foreground">
                          {e.heat && e.lane ? `H${e.heat} L${e.lane}` : "Not seeded"}
                        </TableCell>
                        <TableCell>
                          {e.scratched
                            ? <Badge variant="outline" className="text-red-400 border-red-400/40 bg-red-950/20"><XCircle className="h-3 w-3 mr-1" />Scratched</Badge>
                            : <Badge variant="outline" className="text-green-500 border-green-500/40 bg-green-950/20"><CheckCircle2 className="h-3 w-3 mr-1" />Declared</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant={e.scratched ? "outline" : "outline"}
                            onClick={() => toggleScratch(e.id, e.scratched)}
                            className={e.scratched
                              ? "text-green-600 border-green-500/40 hover:bg-green-50 text-xs"
                              : "text-red-500 border-red-400/40 hover:bg-red-50 text-xs"}
                          >
                            {e.scratched ? "Restore" : "Scratch"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
