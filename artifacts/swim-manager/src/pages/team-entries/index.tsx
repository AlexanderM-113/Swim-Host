import { useState, useMemo, useEffect } from "react";
import {
  useListMeets,
  useListAthletes,
  useGetMeet,
  useListEvents,
  useCreateEntry,
  useUpdateEntry,
  useDeleteEntry,
  readStore,
  type Athlete,
} from "@/lib/local-store";
import { buildSDIFExportData, generateSDIF } from "@/lib/sdif";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { ListChecks, Download, Search, AlertCircle, Users, Trophy } from "lucide-react";
import { parseTime, formatTime } from "@/lib/format-time";

// ─── Per-athlete entry dialog (mirrors the Meet Roster "Enter" workflow) ────────

interface EventRowState {
  checked: boolean;
  seedTime: string;
  entryId: number | null;
}

function AthleteEntryDialog({
  meetId,
  athlete,
  onClose,
}: {
  meetId: number;
  athlete: Athlete;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { data: meet } = useGetMeet(meetId);
  const { data: events = [] } = useListEvents(meetId);
  const createEntry = useCreateEntry();
  const updateEntry = useUpdateEntry();
  const deleteEntry = useDeleteEntry();

  const [rows, setRows] = useState<Record<number, EventRowState>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!events.length) return;
    const store = readStore();
    const initial: Record<number, EventRowState> = {};
    for (const evt of events) {
      const existing = store.entries.find(
        (e) => e.eventId === evt.id && e.athleteId === athlete.id && !e.scratched
      );
      initial[evt.id] = {
        checked: !!existing,
        seedTime: existing?.seedTime != null ? formatTime(existing.seedTime) : "",
        entryId: existing?.id ?? null,
      };
    }
    setRows(initial);
  }, [events, athlete.id]);

  const individualCount = useMemo(
    () => events.filter((e) => !e.isRelay && rows[e.id]?.checked).length,
    [rows, events]
  );
  const indivLimit = meet?.maxIndividualEvents;
  const atLimit = indivLimit != null && individualCount >= indivLimit;

  function toggleEvent(eventId: number) {
    setRows((prev) => {
      const cur = prev[eventId];
      if (!cur) return prev;
      const isRelay = events.find((e) => e.id === eventId)?.isRelay;
      if (!cur.checked && !isRelay && indivLimit != null) {
        const checkedIndiv = events.filter((e) => !e.isRelay && prev[e.id]?.checked).length;
        if (checkedIndiv >= indivLimit) {
          toast({
            title: "Entry limit reached",
            description: `This meet allows at most ${indivLimit} individual event${indivLimit === 1 ? "" : "s"} per athlete.`,
            variant: "destructive",
          });
          return prev;
        }
      }
      return { ...prev, [eventId]: { ...cur, checked: !cur.checked } };
    });
  }

  function setSeedTime(eventId: number, val: string) {
    setRows((prev) => ({ ...prev, [eventId]: { ...prev[eventId], seedTime: val } }));
  }

  async function save() {
    setSaving(true);
    try {
      for (const evt of events) {
        const row = rows[evt.id];
        if (!row) continue;
        const seedSecs = row.seedTime.trim() ? parseTime(row.seedTime.trim()) : null;
        if (row.checked && row.entryId == null) {
          await createEntry.mutateAsync({
            data: {
              eventId: evt.id,
              athleteId: athlete.id,
              meetId,
              seedTime: seedSecs ?? undefined,
              seedCourse: meet?.course ?? "SCY",
            },
          });
        } else if (row.checked && row.entryId != null) {
          await updateEntry.mutateAsync({ id: row.entryId, data: { seedTime: seedSecs ?? undefined } });
        } else if (!row.checked && row.entryId != null) {
          await deleteEntry.mutateAsync({ id: row.entryId });
        }
      }
      toast({ title: "Entries saved", description: `Updated entries for ${athlete.firstName} ${athlete.lastName}.` });
      onClose();
    } catch {
      toast({ title: "Error saving entries", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-indigo-500" />
            Enter {athlete.firstName} {athlete.lastName}
          </DialogTitle>
          <DialogDescription>
            Tick the events this athlete will swim. Type a seed time (MM:SS.ss or S.ss) or leave blank for NT.
          </DialogDescription>
        </DialogHeader>

        {indivLimit != null && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${atLimit ? "bg-destructive/10 text-destructive border border-destructive/20" : "bg-muted/50"}`}>
            {atLimit && <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>
              <span className="font-bold">{individualCount}</span> / {indivLimit} individual event{indivLimit === 1 ? "" : "s"} entered
              {atLimit && " — limit reached"}
            </span>
          </div>
        )}

        {events.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            This meet has no events yet. Add events in the Meet Manager Events tab (or import the meet's .ev3 file) first.
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>#</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Seed Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((evt) => {
                  const row = rows[evt.id];
                  const isRelay = evt.isRelay;
                  const wouldExceedLimit =
                    !isRelay && indivLimit != null && individualCount >= indivLimit && !row?.checked;
                  return (
                    <TableRow
                      key={evt.id}
                      className={`cursor-pointer ${row?.checked ? "bg-primary/5" : ""}`}
                      onClick={() => !wouldExceedLimit && toggleEvent(evt.id)}
                    >
                      <TableCell>
                        <Checkbox
                          checked={row?.checked ?? false}
                          disabled={wouldExceedLimit}
                          onCheckedChange={() => toggleEvent(evt.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">{evt.eventNumber}</TableCell>
                      <TableCell className="font-medium">
                        {evt.distance} {evt.stroke}
                        {isRelay && <Badge variant="outline" className="ml-2 text-xs">Relay</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{evt.gender ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{evt.ageGroup ?? "Open"}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {row?.checked ? (
                          <Input
                            className="h-7 w-28 font-mono text-sm"
                            placeholder="NT"
                            value={row.seedTime}
                            onChange={(e) => setSeedTime(evt.id, e.target.value)}
                          />
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || events.length === 0}>
            {saving ? "Saving…" : "Save Entries"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────────

export default function TeamEntries() {
  const { toast } = useToast();
  const { data: meets = [] } = useListMeets();
  const { data: athletes = [] } = useListAthletes();

  const [meetIdStr, setMeetIdStr] = useState<string>("");
  const [search, setSearch] = useState("");
  const [entryAthlete, setEntryAthlete] = useState<Athlete | null>(null);
  const [exporting, setExporting] = useState(false);

  const meetId = meetIdStr ? parseInt(meetIdStr, 10) : 0;
  const { data: events = [] } = useListEvents(meetId);
  const meet = useMemo(() => meets.find((m) => m.id === meetId), [meets, meetId]);

  // Entry counts per club athlete for the selected meet.
  const entryCountByAthlete = useMemo(() => {
    const store = readStore();
    const counts = new Map<number, number>();
    if (!meetId) return counts;
    for (const e of store.entries) {
      if (e.meetId === meetId && !e.scratched) {
        counts.set(e.athleteId, (counts.get(e.athleteId) ?? 0) + 1);
      }
    }
    return counts;
  }, [meetId, entryAthlete]);

  const totalEntered = useMemo(
    () => athletes.reduce((sum, a) => sum + (entryCountByAthlete.get(a.id) ?? 0), 0),
    [athletes, entryCountByAthlete]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...athletes].sort((a, b) => a.lastName.localeCompare(b.lastName));
    if (!q) return sorted;
    return sorted.filter((a) =>
      `${a.firstName} ${a.lastName} ${a.teamName ?? ""}`.toLowerCase().includes(q)
    );
  }, [athletes, search]);

  function exportSd3() {
    if (!meet) {
      toast({ title: "Select a meet first", variant: "destructive" });
      return;
    }
    setExporting(true);
    try {
      const store = readStore();
      const clubAthleteIds = new Set(store.athletes.filter((a) => a.meetId == null).map((a) => a.id));
      const meetEvents = store.events.filter((e) => e.meetId === meetId);

      const allEntries = store.entries
        .filter((e) => e.meetId === meetId && !e.scratched && clubAthleteIds.has(e.athleteId))
        .map((entry) => {
          const athlete = store.athletes.find((a) => a.id === entry.athleteId);
          const team = athlete?.teamId ? store.teams.find((t) => t.id === athlete.teamId) : null;
          return {
            ...entry,
            athleteFirstName: athlete?.firstName ?? "",
            athleteLastName: athlete?.lastName ?? "",
            gender: athlete?.gender ?? "",
            dateOfBirth: athlete?.dateOfBirth,
            ussNumber: athlete?.idNumber,
            teamName: team?.name,
            teamCode: team?.abbreviation ?? team?.name?.substring(0, 4) ?? "UNAT",
          };
        });

      if (allEntries.length === 0) {
        toast({ title: "No entries to export", description: "Enter at least one athlete into an event first.", variant: "destructive" });
        return;
      }

      const exportData = buildSDIFExportData(meet, meetEvents, allEntries);
      const sdifText = generateSDIF(exportData, {
        type: "entries",
        programName: "SWMP",
        softwareVersion: "SwimManager Pro 1.0",
      });

      const blob = new Blob([sdifText], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeName = meet.name.replace(/[^a-zA-Z0-9]/g, "_");
      a.href = url;
      a.download = `${safeName}_entries.sd3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "Entries exported", description: `${allEntries.length} entries exported as .sd3 for ${meet.name}.` });
    } catch (err) {
      toast({ title: "Export failed", description: err instanceof Error ? err.message : "Could not build the .sd3 file.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meet Entries</h1>
          <p className="text-muted-foreground mt-1">
            Declare your club's entries for a meet, then export an <span className="font-medium text-foreground">.sd3</span> entries file to send to the host. Same workflow as the Meet Manager <Link href="/meets" className="text-indigo-500 underline">Meet Roster</Link> tab.
          </p>
        </div>
        <Button onClick={exportSd3} disabled={!meet || exporting}>
          <Download className="h-4 w-4 mr-2" />
          {exporting ? "Exporting…" : "Export .sd3"}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-indigo-500" /> Select Meet
          </CardTitle>
          <CardDescription>Choose the meet you are entering. Its events come from the Meet Manager (add them directly or import the meet's .ev3 file).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Select value={meetIdStr} onValueChange={setMeetIdStr}>
            <SelectTrigger className="max-w-md"><SelectValue placeholder="Select a meet…" /></SelectTrigger>
            <SelectContent>
              {meets.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">No meets yet — create one in Meet Manager.</div>
              ) : (
                meets.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    {m.name} {m.startDate ? `· ${m.startDate}` : ""}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {meet && (
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground pt-1">
              <Badge variant="outline">{events.length} event{events.length === 1 ? "" : "s"}</Badge>
              <Badge variant="outline">{meet.course ?? "—"}</Badge>
              {meet.maxIndividualEvents != null && (
                <Badge variant="outline">Max {meet.maxIndividualEvents} individual / athlete</Badge>
              )}
              <Badge variant="secondary">{totalEntered} total entries</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {meet && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-500" /> Club Athletes
              </CardTitle>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-8 pl-8 w-56"
                  placeholder="Search athletes…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {events.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                This meet has no events yet. Add events in the Meet Manager Events tab, or import the meet's .ev3 file, before entering athletes.
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {athletes.length === 0 ? (
                  <>No club athletes yet. Add athletes in <Link href="/athletes" className="text-indigo-500 underline">Athletes</Link>.</>
                ) : (
                  "No athletes match your search."
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Athlete</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead className="text-center">Entries</TableHead>
                    <TableHead className="text-right pr-6">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => {
                    const count = entryCountByAthlete.get(a.id) ?? 0;
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="pl-6 font-medium">{a.lastName}, {a.firstName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{a.teamName ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{a.gender}</TableCell>
                        <TableCell className="text-center">
                          {count > 0 ? <Badge variant="secondary">{count}</Badge> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Button variant="outline" size="sm" onClick={() => setEntryAthlete(a)}>
                            <ListChecks className="h-4 w-4 mr-2" /> Enter Events
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {entryAthlete && meet && (
        <AthleteEntryDialog meetId={meetId} athlete={entryAthlete} onClose={() => setEntryAthlete(null)} />
      )}
    </div>
  );
}
