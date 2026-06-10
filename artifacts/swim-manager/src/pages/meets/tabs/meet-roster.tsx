import { useState, useMemo } from "react";
import {
  useListMeetRosterAthletes,
  useAddMeetRosterAthlete,
  useImportAthletesFromTeamManager,
  useDeleteMeetRosterAthlete,
  useListAthletes,
  useListTeams,
  useCreateTeam,
  readStore,
  type Athlete,
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
import { Users, Building2, Plus, Trash2, UserPlus, Download, FileUp, Search } from "lucide-react";

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
          or pull selected athletes in from Team Manager. Entries (with seed times) are made on the
          <span className="font-medium"> Athletes &amp; Entries</span> tab.
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
                      <TableCell className="pl-6 font-medium">{a.lastName}, {a.firstName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">{a.teamName ?? "UNAT"}</Badge>
                      </TableCell>
                      <TableCell>{a.gender}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.dateOfBirth || "—"}</TableCell>
                      <TableCell className="text-center">{entryCountByAthlete.get(a.id) ?? 0}</TableCell>
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
