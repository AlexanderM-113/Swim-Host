import { useState } from "react";
import {
  useListEvents, useListEntries, useListAthletes, useListTeams,
  useCreateEntry, useUpdateEntry, useDeleteEntry,
  getListEntriesQueryKey,
} from "@/lib/local-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatTime, parseTime } from "@/lib/format-time";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, MoreHorizontal, Trash2, Scissors, RotateCcw } from "lucide-react";

export default function MeetAthletes({ meetId }: { meetId: number }) {
  const { data: events } = useListEvents(meetId);
  const { data: athletes } = useListAthletes();
  const { data: teams } = useListTeams();
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [addOpen, setAddOpen] = useState(false);
  const [scratchOpen, setScratchOpen] = useState(false);
  const [scratchEntry, setScratchEntry] = useState<any>(null);
  const [scratchReason, setScratchReason] = useState("");
  const [newAthleteId, setNewAthleteId] = useState("");
  const [newSeedTime, setNewSeedTime] = useState("");
  const [newSeedCourse, setNewSeedCourse] = useState("SCY");

  const { data: entries, isLoading } = useListEntries(
    selectedEvent ? parseInt(selectedEvent, 10) : 0,
    { query: { enabled: !!selectedEvent, queryKey: getListEntriesQueryKey(parseInt(selectedEvent, 10)) } }
  );

  const createEntry = useCreateEntry();
  const updateEntry = useUpdateEntry();
  const deleteEntry = useDeleteEntry();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey(parseInt(selectedEvent)) });
  }

  function handleAddEntry() {
    if (!newAthleteId || !selectedEvent) return;
    const athlete = athletes?.find((a) => a.id === parseInt(newAthleteId));
    const seedTimeSec = newSeedTime ? parseTime(newSeedTime) : undefined;

    createEntry.mutate(
      {
        data: {
          eventId: parseInt(selectedEvent),
          athleteId: parseInt(newAthleteId),
          seedTime: seedTimeSec ?? undefined,
          seedCourse: newSeedCourse,
          scratched: false,
        } as any,
      },
      {
        onSuccess: () => {
          toast({ title: "Entry added" });
          setAddOpen(false);
          setNewAthleteId("");
          setNewSeedTime("");
          invalidate();
        },
        onError: (err: any) => {
          toast({ title: "Failed to add entry", description: err?.response?.data?.error ?? err?.message, variant: "destructive" });
        },
      }
    );
  }

  function handleScratch() {
    if (!scratchEntry) return;
    updateEntry.mutate(
      { id: scratchEntry.id, data: { scratched: true } },
      {
        onSuccess: () => {
          toast({ title: "Entry scratched" });
          setScratchOpen(false);
          setScratchEntry(null);
          setScratchReason("");
          invalidate();
        },
        onError: () => toast({ title: "Failed to scratch", variant: "destructive" }),
      }
    );
  }

  function handleUnscratch(entry: any) {
    updateEntry.mutate(
      { id: entry.id, data: { scratched: false } },
      {
        onSuccess: () => { toast({ title: "Scratch removed" }); invalidate(); },
        onError: () => toast({ title: "Failed to remove scratch", variant: "destructive" }),
      }
    );
  }

  function handleDelete(entryId: number) {
    if (!confirm("Delete this entry? This cannot be undone.")) return;
    deleteEntry.mutate(
      { id: entryId },
      {
        onSuccess: () => { toast({ title: "Entry deleted" }); invalidate(); },
        onError: () => toast({ title: "Failed to delete entry", variant: "destructive" }),
      }
    );
  }

  const selectedEventObj = events?.find((e) => String(e.id) === selectedEvent);

  // Filter out athletes already entered
  const enteredAthleteIds = new Set(entries?.map((e) => e.athleteId) ?? []);
  const availableAthletes = athletes?.filter((a) => !enteredAthleteIds.has(a.id)) ?? [];

  const activeCount = entries?.filter((e) => !e.scratched).length ?? 0;
  const scratchedCount = entries?.filter((e) => e.scratched).length ?? 0;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Athletes &amp; Entries</CardTitle>
            {selectedEvent && (
              <p className="text-sm text-muted-foreground mt-1">
                {activeCount} active{scratchedCount > 0 ? `, ${scratchedCount} scratched` : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedEvent} onValueChange={setSelectedEvent}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Select Event" />
              </SelectTrigger>
              <SelectContent>
                {events?.map((event) => (
                  <SelectItem key={event.id} value={event.id.toString()}>
                    Event {event.eventNumber}: {event.gender} {event.ageGroup} {event.distance} {event.stroke}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedEvent && (
              <Button size="sm" onClick={() => setAddOpen(true)} disabled={availableAthletes.length === 0}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Entry
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!selectedEvent ? (
            <div className="text-center py-12 text-muted-foreground">
              Select an event above to view and manage entries.
            </div>
          ) : isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading entries…</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Athlete</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead className="font-mono">Seed Time</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead className="text-center">Heat</TableHead>
                  <TableHead className="text-center">Lane</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries?.map((entry) => (
                  <TableRow key={entry.id} className={entry.scratched ? "opacity-50" : ""}>
                    <TableCell className="pl-6 font-medium">{entry.athleteName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{entry.teamName || "Unattached"}</TableCell>
                    <TableCell className="font-mono">{entry.seedTime ? formatTime(entry.seedTime) : "NT"}</TableCell>
                    <TableCell className="text-sm">{entry.seedCourse || "—"}</TableCell>
                    <TableCell className="text-center">{entry.heat || "—"}</TableCell>
                    <TableCell className="text-center">{entry.lane || "—"}</TableCell>
                    <TableCell>
                      {entry.scratched
                        ? <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200">SCR</Badge>
                        : <Badge variant="outline" className="text-green-700 border-green-300">Active</Badge>}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!entry.scratched ? (
                            <DropdownMenuItem onClick={() => { setScratchEntry(entry); setScratchOpen(true); }}>
                              <Scissors className="h-4 w-4 mr-2" /> Scratch
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleUnscratch(entry)}>
                              <RotateCcw className="h-4 w-4 mr-2" /> Remove Scratch
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(entry.id)}>
                            <Trash2 className="h-4 w-4 mr-2" /> Delete Entry
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {(!entries || entries.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No entries for this event. Click "Add Entry" to add athletes.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Entry Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Entry</DialogTitle>
          </DialogHeader>
          {selectedEventObj && (
            <p className="text-sm text-muted-foreground">
              Event {selectedEventObj.eventNumber}: {selectedEventObj.gender} {selectedEventObj.distance} {selectedEventObj.stroke}
            </p>
          )}
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Athlete</Label>
              <Select value={newAthleteId} onValueChange={setNewAthleteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select athlete…" />
                </SelectTrigger>
                <SelectContent>
                  {availableAthletes.map((a) => {
                    const team = teams?.find((t) => t.id === a.teamId);
                    return (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.firstName} {a.lastName}
                        {team ? ` · ${team.abbreviation ?? team.name}` : ""}
                      </SelectItem>
                    );
                  })}
                  {availableAthletes.length === 0 && (
                    <SelectItem value="none" disabled>All athletes already entered</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Seed Time</Label>
                <Input
                  placeholder="e.g. 52.34 or NT"
                  value={newSeedTime}
                  onChange={(e) => setNewSeedTime(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">Leave blank for NT</p>
              </div>
              <div className="space-y-1.5">
                <Label>Seed Course</Label>
                <Select value={newSeedCourse} onValueChange={setNewSeedCourse}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SCY">SCY</SelectItem>
                    <SelectItem value="SCM">SCM</SelectItem>
                    <SelectItem value="LCM">LCM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddEntry} disabled={!newAthleteId || createEntry.isPending}>
              {createEntry.isPending ? "Adding…" : "Add Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scratch Dialog */}
      <Dialog open={scratchOpen} onOpenChange={setScratchOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Scratch Entry</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Scratch <strong>{scratchEntry?.athleteName}</strong> from this event?
          </p>
          <div className="space-y-1.5 py-2">
            <Label>Reason (optional)</Label>
            <Input
              placeholder="e.g. Injury, No show, Voluntary scratch"
              value={scratchReason}
              onChange={(e) => setScratchReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScratchOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleScratch} disabled={updateEntry.isPending}>
              {updateEntry.isPending ? "Scratching…" : "Scratch Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
