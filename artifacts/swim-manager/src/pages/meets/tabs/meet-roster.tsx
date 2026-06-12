import { useState, useMemo, useEffect } from "react";
import {
  useListMeetRosterAthletes,
  useAddMeetRosterAthlete,
  useImportAthletesFromTeamManager,
  useDeleteMeetRosterAthlete,
  useListAthletes,
  useListTeams,
  useCreateTeam,
  useGetMeet,
  useListEvents,
  useCreateEntry,
  useUpdateEntry,
  useDeleteEntry,
  readStore,
  type Athlete,
  type Event,
} from "@/lib/local-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Users, Building2, Plus, Trash2, UserPlus, Download, FileUp, Search, ListChecks, AlertCircle } from "lucide-react";
import { parseTime, formatTime } from "@/lib/format-time";

// ─── Quick Entry Dialog ────────────────────────────────────────────────────────

interface EventRowState {
  checked: boolean;
  seedTime: string;
  entryId: number | null;
}

function AthleteQuickEntryDialog({
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

  // Per-event state: keyed by eventId
  const [rows, setRows] = useState<Record<number, EventRowState>>({});
  const [saving, setSaving] = useState(false);

  // Initialise rows from existing entries for this athlete in this meet
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

  function toggleEvent(eventId: number) {
    setRows((prev) => {
      const cur = prev[eventId];
      if (!cur) return prev;
      // Check limit before enabling
      if (!cur.checked && meet?.maxIndividualEvents != null) {
        const indivEvents = events.filter((e) => !e.isRelay);
        const checkedIndiv = indivEvents.filter(
          (e) => !e.isRelay && prev[e.id]?.checked
        ).length;
        if (checkedIndiv >= meet.maxIndividualEvents) {
          toast({
            title: "Entry limit reached",
            description: `This meet allows at most ${meet.maxIndividualEvents} individual event${meet.maxIndividualEvents === 1 ? "" : "s"} per athlete.`,
            variant: "destructive",
          });
          return prev;
        }
      }
      return { ...prev, [eventId]: { ...cur, checked: !cur.checked } };
    });
  }

  function setSeedTime(eventId: number, val: string) {
    setRows((prev) => ({
      ...prev,
      [eventId]: { ...prev[eventId], seedTime: val },
    }));
  }

  const individualCount = useMemo(() => {
    return events.filter((e) => !e.isRelay && rows[e.id]?.checked).length;
  }, [rows, events]);

  async function save() {
    setSaving(true);
    try {
      for (const evt of events) {
        const row = rows[evt.id];
        if (!row) continue;
        const seedSecs = row.seedTime.trim() ? parseTime(row.seedTime.trim()) : null;

        if (row.checked && row.entryId == null) {
          // New entry
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
          // Update seed time
          await updateEntry.mutateAsync({
            id: row.entryId,
            data: { seedTime: seedSecs ?? undefined },
          });
        } else if (!row.checked && row.entryId != null) {
          // Remove entry
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

  const indivLimit = meet?.maxIndividualEvents;
  const atLimit = indivLimit != null && individualCount >= indivLimit;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-cyan-500" />
            Enter {athlete.firstName} {athlete.lastName}
          </DialogTitle>
          <DialogDescription>
            Tick the events this athlete will swim. Type a seed time (MM:SS.ss or S.ss) or leave blank for NT.
          </DialogDescription>
        </DialogHeader>

        {/* Entry counter */}
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
            No events have been added to this meet yet. Add events in the Events tab first.
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
                  const isRelay = (evt as any).isRelay;
                  const wouldExceedLimit =
                    !isRelay &&
                    indivLimit != null &&
                    individualCount >= indivLimit &&
                    !row?.checked;
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
                      <TableCell className="font-mono text-muted-foreground">
                        {(evt as any).eventNumber ?? evt.id}
                      </TableCell>
                      <TableCell className="font-medium">
                        {(evt as any).distance} {(evt as any).stroke}
                        {isRelay && <Badge variant="outline" className="ml-2 text-xs">Relay</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {(evt as any).gender ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {(evt as any).ageGroup ?? "Open"}
                      </TableCell>
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
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save Entries"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function MeetRoster({ meetId }: { meetId: number }) {
  const { toast } = useToast();
  const { data: rosterAthletes = [] } = useListMeetRosterAthletes(meetId);
  const { data: clubAthletes = [] } = useListAthletes();
  const { data: teams = [] } = useListTeams();
  const addAthlete = useAddMeetRosterAthlete();
  const importFromTM = useImportAthletesFromTeamManager();
  const deleteAthlete = useDeleteMeetRosterAthlete();
  const createTeam = useCreateTeam();

  const [addAthleteOpen, setAddAthleteOpen] = useState(false);
  const [addTeamOpen, setAddTeamOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importSearch, setImportSearch] = useState("");
  const [importSelected, setImportSelected] = useState<Set<number>>(new Set());
  const [quickEntryAthlete, setQuickEntryAthlete] = useState<Athlete | null>(null);

  const [newAthlete, setNewAthlete] = useState({ firstName: "", lastName: "", gender: "M", teamCode: "", dob: "" });
  const [newTeam, setNewTeam] = useState({ code: "", name: "", lsc: "" });

  // Count entries per roster athlete so the table reflects actual meet entries.
  const entryCountByAthlete = useMemo(() => {
    const store = readStore();
    const counts = new Map<number, number>();
    for (const e of store.entries) {
      if (e.meetId === meetId && !e.scratched) counts.set(e.athleteId, (counts.get(e.athleteId) ?? 0) + 1);
    }
    return counts;
  }, [meetId, rosterAthletes]);

  // Teams that actually appear in this meet's roster.
  const rosterTeams = useMemo(() => {
    const ids = new Set(rosterAthletes.map((a) => a.teamId).filter((x): x is number => x != null));
    return teams.filter((t) => ids.has(t.id));
  }, [rosterAthletes, teams]);

  function findOrCreateTeamId(code: string): Promise<number | undefined> | number | undefined {
    const clean = code.trim();
    if (!clean) return undefined;
    const existing = teams.find(
      (t) => t.abbreviation?.toUpperCase() === clean.toUpperCase() || t.name.toUpperCase() === clean.toUpperCase()
    );
    if (existing) return existing.id;
    return createTeam
      .mutateAsync({ data: { name: clean, abbreviation: clean.toUpperCase().slice(0, 6) } })
      .then((t) => t.id);
  }

  async function saveAthlete() {
    if (!newAthlete.firstName.trim() || !newAthlete.lastName.trim()) {
      toast({ title: "Name required", description: "Enter first and last name.", variant: "destructive" });
      return;
    }
    const teamId = await findOrCreateTeamId(newAthlete.teamCode);
    await addAthlete.mutateAsync({
      meetId,
      data: {
        firstName: newAthlete.firstName.trim(),
        lastName: newAthlete.lastName.trim(),
        gender: newAthlete.gender,
        teamId,
        dateOfBirth: newAthlete.dob || undefined,
        active: true,
      },
    });
    setNewAthlete({ firstName: "", lastName: "", gender: "M", teamCode: "", dob: "" });
    setAddAthleteOpen(false);
    toast({ title: "Athlete added to meet roster" });
  }

  async function saveTeam() {
    if (!newTeam.code.trim() || !newTeam.name.trim()) {
      toast({ title: "Code and name required", variant: "destructive" });
      return;
    }
    await createTeam.mutateAsync({
      data: {
        name: newTeam.name.trim(),
        abbreviation: newTeam.code.trim().toUpperCase().substring(0, 6),
        lsc: newTeam.lsc.trim() || undefined,
      },
    });
    setNewTeam({ code: "", name: "", lsc: "" });
    setAddTeamOpen(false);
    toast({ title: "Team added" });
  }

  function toggleImport(id: number) {
    setImportSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const filteredClub = useMemo(() => {
    const q = importSearch.trim().toLowerCase();
    if (!q) return clubAthletes;
    return clubAthletes.filter((a) =>
      `${a.firstName} ${a.lastName} ${a.teamName ?? ""}`.toLowerCase().includes(q)
    );
  }, [clubAthletes, importSearch]);

  async function runImport() {
    if (importSelected.size === 0) {
      toast({ title: "Select at least one athlete", variant: "destructive" });
      return;
    }
    const res = await importFromTM.mutateAsync({ meetId, athleteIds: [...importSelected] });
    setImportOpen(false);
    setImportSelected(new Set());
    setImportSearch("");
    toast({
      title: "Imported from Team Manager",
      description: `${res?.imported ?? 0} athlete(s) added to the meet roster.`,
    });
  }

  function removeAthlete(a: Athlete) {
    if (!confirm(`Remove ${a.firstName} ${a.lastName} from the meet roster? Their entries in this meet will also be removed.`)) return;
    deleteAthlete.mutate(
      { meetId, athleteId: a.id },
      { onSuccess: () => toast({ title: "Removed from roster" }) }
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Users className="h-5 w-5 text-cyan-500" />
          Meet Roster
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          The roster is the entry pool for this hosted meet — kept separate from the global Team Manager.
          Add athletes directly, import an <Link href="/sdif" className="text-cyan-500 underline">.sd3 file</Link>,
          or pull selected athletes in from Team Manager.{" "}
          <span className="font-medium">Click an athlete's name</span> to enter them in events.
        </p>
      </div>

      <Tabs defaultValue="athletes">
        <TabsList>
          <TabsTrigger value="athletes">
            <Users className="h-3.5 w-3.5 mr-1.5" />
            Athletes ({rosterAthletes.length})
          </TabsTrigger>
          <TabsTrigger value="teams">
            <Building2 className="h-3.5 w-3.5 mr-1.5" />
            Teams ({rosterTeams.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="athletes" className="mt-4 space-y-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Download className="h-4 w-4 mr-2" />
              Import from Team Manager
            </Button>
            <Link href="/sdif">
              <Button variant="outline" size="sm">
                <FileUp className="h-4 w-4 mr-2" />
                Import .sd3
              </Button>
            </Link>
            <Button onClick={() => setAddAthleteOpen(true)} size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Athlete
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Name</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead>Birth Date</TableHead>
                    <TableHead className="text-center">Entries</TableHead>
                    <TableHead className="text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rosterAthletes.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="pl-6 font-medium">
                        <button
                          className="text-primary hover:underline font-medium text-left"
                          onClick={() => setQuickEntryAthlete(a)}
                        >
                          {a.lastName}, {a.firstName}
                        </button>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">{a.teamName ?? "UNAT"}</Badge>
                      </TableCell>
                      <TableCell>{a.gender}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.dateOfBirth || "—"}</TableCell>
                      <TableCell className="text-center">
                        <button
                          className="hover:text-primary transition-colors"
                          onClick={() => setQuickEntryAthlete(a)}
                          title="Click to manage entries"
                        >
                          {entryCountByAthlete.get(a.id) ?? 0}
                        </button>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => removeAthlete(a)}
                          className="text-destructive hover:text-destructive h-7 w-7 p-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rosterAthletes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No athletes in the roster yet. Add one, import a .sd3 file, or import from Team Manager.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="teams" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setAddTeamOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Team
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Code</TableHead>
                    <TableHead>Team Name</TableHead>
                    <TableHead>LSC</TableHead>
                    <TableHead className="text-center">Athletes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rosterTeams.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="pl-6 font-mono font-bold">{t.abbreviation ?? "—"}</TableCell>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="text-muted-foreground">{t.lsc || "—"}</TableCell>
                      <TableCell className="text-center">
                        {rosterAthletes.filter((a) => a.teamId === t.id).length}
                      </TableCell>
                    </TableRow>
                  ))}
                  {rosterTeams.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No teams represented in the roster yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Entry Dialog */}
      {quickEntryAthlete && (
        <AthleteQuickEntryDialog
          meetId={meetId}
          athlete={quickEntryAthlete}
          onClose={() => setQuickEntryAthlete(null)}
        />
      )}

      {/* Add Athlete Dialog */}
      <Dialog open={addAthleteOpen} onOpenChange={setAddAthleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Athlete to Meet Roster</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Name</Label>
                <Input value={newAthlete.firstName} onChange={(e) => setNewAthlete({ ...newAthlete, firstName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name</Label>
                <Input value={newAthlete.lastName} onChange={(e) => setNewAthlete({ ...newAthlete, lastName: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Gender</Label>
                <Select value={newAthlete.gender} onValueChange={(v) => setNewAthlete({ ...newAthlete, gender: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">M</SelectItem>
                    <SelectItem value="F">F</SelectItem>
                    <SelectItem value="X">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Team Code</Label>
                <Input value={newAthlete.teamCode} onChange={(e) => setNewAthlete({ ...newAthlete, teamCode: e.target.value })} placeholder="UNAT" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Birth Date (optional)</Label>
              <Input type="date" value={newAthlete.dob} onChange={(e) => setNewAthlete({ ...newAthlete, dob: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddAthleteOpen(false)}>Cancel</Button>
            <Button onClick={saveAthlete} disabled={addAthlete.isPending}>Add Athlete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Team Dialog */}
      <Dialog open={addTeamOpen} onOpenChange={setAddTeamOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Team</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Team Code</Label>
              <Input value={newTeam.code} onChange={(e) => setNewTeam({ ...newTeam, code: e.target.value })} placeholder="LAC" />
            </div>
            <div className="space-y-1.5">
              <Label>Team Name</Label>
              <Input value={newTeam.name} onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })} placeholder="Lincoln Aquatic Club" />
            </div>
            <div className="space-y-1.5">
              <Label>LSC (optional)</Label>
              <Input value={newTeam.lsc} onChange={(e) => setNewTeam({ ...newTeam, lsc: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTeamOpen(false)}>Cancel</Button>
            <Button onClick={saveTeam} disabled={createTeam.isPending}>Add Team</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import from Team Manager Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Athletes from Team Manager</DialogTitle>
            <DialogDescription>
              Copy selected club athletes into this meet's roster. Originals stay in Team Manager.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search athletes…" value={importSearch} onChange={(e) => setImportSearch(e.target.value)} />
          </div>
          <div className="max-h-80 overflow-y-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Name</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Gender</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClub.map((a) => (
                  <TableRow key={a.id} className="cursor-pointer" onClick={() => toggleImport(a.id)}>
                    <TableCell><Checkbox checked={importSelected.has(a.id)} onCheckedChange={() => toggleImport(a.id)} /></TableCell>
                    <TableCell className="font-medium">{a.lastName}, {a.firstName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.teamName ?? "—"}</TableCell>
                    <TableCell>{a.gender}</TableCell>
                  </TableRow>
                ))}
                {filteredClub.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      {clubAthletes.length === 0 ? "No Team Manager athletes yet." : "No matches."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <span className="text-sm text-muted-foreground mr-auto self-center">{importSelected.size} selected</span>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button onClick={runImport} disabled={importFromTM.isPending}>Import Selected</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
