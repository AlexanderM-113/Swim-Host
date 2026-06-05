import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Users, Building2, Plus, Trash2, UserPlus } from "lucide-react";
import { formatTime } from "@/lib/format-time";

const ROSTER_KEY = (meetId: number) => `swimmanager_meet_roster_${meetId}`;
const TEAMS_KEY = (meetId: number) => `swimmanager_meet_teams_${meetId}`;

interface MeetAthlete {
  id: number;
  firstName: string;
  lastName: string;
  gender: string;
  teamCode: string;
  seedTime?: number;
  seedCourse?: string;
  event?: string;
}

interface MeetTeam {
  id: number;
  code: string;
  name: string;
  lsc?: string;
}

function readRoster(meetId: number): MeetAthlete[] {
  try {
    const raw = localStorage.getItem(ROSTER_KEY(meetId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function writeRoster(meetId: number, data: MeetAthlete[]) {
  localStorage.setItem(ROSTER_KEY(meetId), JSON.stringify(data));
}

function readTeams(meetId: number): MeetTeam[] {
  try {
    const raw = localStorage.getItem(TEAMS_KEY(meetId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function writeTeams(meetId: number, data: MeetTeam[]) {
  localStorage.setItem(TEAMS_KEY(meetId), JSON.stringify(data));
}

export default function MeetRoster({ meetId }: { meetId: number }) {
  const { toast } = useToast();
  const [athletes, setAthletes] = useState<MeetAthlete[]>(() => readRoster(meetId));
  const [teams, setTeams] = useState<MeetTeam[]>(() => readTeams(meetId));

  const [addAthleteOpen, setAddAthleteOpen] = useState(false);
  const [addTeamOpen, setAddTeamOpen] = useState(false);

  const [newAthlete, setNewAthlete] = useState({
    firstName: "", lastName: "", gender: "M",
    teamCode: "", seedTime: "", seedCourse: "SCY", event: "",
  });
  const [newTeam, setNewTeam] = useState({ code: "", name: "", lsc: "" });

  function saveAthlete() {
    if (!newAthlete.firstName.trim() || !newAthlete.lastName.trim()) {
      toast({ title: "Name required", description: "Please enter first and last name.", variant: "destructive" });
      return;
    }
    const athlete: MeetAthlete = {
      id: Date.now(),
      firstName: newAthlete.firstName.trim(),
      lastName: newAthlete.lastName.trim(),
      gender: newAthlete.gender,
      teamCode: newAthlete.teamCode.trim() || "UNAT",
      seedTime: newAthlete.seedTime ? parseTimeInput(newAthlete.seedTime) : undefined,
      seedCourse: newAthlete.seedCourse || "SCY",
      event: newAthlete.event.trim() || undefined,
    };
    const updated = [...athletes, athlete];
    setAthletes(updated);
    writeRoster(meetId, updated);
    setNewAthlete({ firstName: "", lastName: "", gender: "M", teamCode: "", seedTime: "", seedCourse: "SCY", event: "" });
    setAddAthleteOpen(false);
    toast({ title: "Athlete added to meet roster" });
  }

  function saveTeam() {
    if (!newTeam.code.trim() || !newTeam.name.trim()) {
      toast({ title: "Code and name required", variant: "destructive" });
      return;
    }
    const team: MeetTeam = {
      id: Date.now(),
      code: newTeam.code.trim().toUpperCase().substring(0, 6),
      name: newTeam.name.trim(),
      lsc: newTeam.lsc.trim() || undefined,
    };
    const updated = [...teams, team];
    setTeams(updated);
    writeTeams(meetId, updated);
    setNewTeam({ code: "", name: "", lsc: "" });
    setAddTeamOpen(false);
    toast({ title: "Team added to meet" });
  }

  function removeAthlete(id: number) {
    const updated = athletes.filter(a => a.id !== id);
    setAthletes(updated);
    writeRoster(meetId, updated);
  }

  function removeTeam(id: number) {
    const updated = teams.filter(t => t.id !== id);
    setTeams(updated);
    writeTeams(meetId, updated);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Users className="h-5 w-5 text-cyan-500" />
          Meet Roster
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Athletes and teams scoped to this meet only — separate from the global Team Manager.
          Use this for quick on-site entry management.
        </p>
      </div>

      <Tabs defaultValue="athletes">
        <TabsList>
          <TabsTrigger value="athletes">
            <Users className="h-3.5 w-3.5 mr-1.5" />
            Athletes ({athletes.length})
          </TabsTrigger>
          <TabsTrigger value="teams">
            <Building2 className="h-3.5 w-3.5 mr-1.5" />
            Teams ({teams.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="athletes" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setAddAthleteOpen(true)} size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              Quick-Add Athlete
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
                    <TableHead>Event</TableHead>
                    <TableHead className="font-mono">Seed Time</TableHead>
                    <TableHead className="text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {athletes.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="pl-6 font-medium">{a.lastName}, {a.firstName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">{a.teamCode}</Badge>
                      </TableCell>
                      <TableCell>{a.gender}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.event || "—"}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {a.seedTime ? `${formatTime(a.seedTime)} ${a.seedCourse}` : "NT"}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => removeAthlete(a.id)}
                          className="text-destructive hover:text-destructive h-7 w-7 p-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {athletes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No athletes added yet. Use Quick-Add to add athletes to this meet.
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
                    <TableHead className="text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teams.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="pl-6 font-mono font-bold">{t.code}</TableCell>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="text-muted-foreground">{t.lsc || "—"}</TableCell>
                      <TableCell className="text-right pr-6">
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => removeTeam(t.id)}
                          className="text-destructive hover:text-destructive h-7 w-7 p-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {teams.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No teams added yet.
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
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Quick-Add Athlete</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Name *</Label>
                <Input value={newAthlete.firstName} onChange={e => setNewAthlete(p => ({ ...p, firstName: e.target.value }))} placeholder="Jane" />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name *</Label>
                <Input value={newAthlete.lastName} onChange={e => setNewAthlete(p => ({ ...p, lastName: e.target.value }))} placeholder="Doe" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Gender</Label>
                <Select value={newAthlete.gender} onValueChange={v => setNewAthlete(p => ({ ...p, gender: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Male</SelectItem>
                    <SelectItem value="F">Female</SelectItem>
                    <SelectItem value="X">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Team Code</Label>
                <Input
                  value={newAthlete.teamCode}
                  onChange={e => setNewAthlete(p => ({ ...p, teamCode: e.target.value.toUpperCase() }))}
                  placeholder="UNAT"
                  maxLength={6}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Event (optional)</Label>
              <Input value={newAthlete.event} onChange={e => setNewAthlete(p => ({ ...p, event: e.target.value }))} placeholder="e.g. 200 Freestyle" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Seed Time (optional)</Label>
                <Input
                  value={newAthlete.seedTime}
                  onChange={e => setNewAthlete(p => ({ ...p, seedTime: e.target.value }))}
                  placeholder="1:52.34"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Course</Label>
                <Select value={newAthlete.seedCourse} onValueChange={v => setNewAthlete(p => ({ ...p, seedCourse: v }))}>
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
            <Button variant="outline" onClick={() => setAddAthleteOpen(false)}>Cancel</Button>
            <Button onClick={saveAthlete}>Add to Roster</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Team Dialog */}
      <Dialog open={addTeamOpen} onOpenChange={setAddTeamOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Team to Meet</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Team Code * (up to 6 chars)</Label>
              <Input
                value={newTeam.code}
                onChange={e => setNewTeam(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                placeholder="BEST"
                maxLength={6}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Team Name *</Label>
              <Input value={newTeam.name} onChange={e => setNewTeam(p => ({ ...p, name: e.target.value }))} placeholder="Best Swim Club" />
            </div>
            <div className="space-y-1.5">
              <Label>LSC (optional)</Label>
              <Input value={newTeam.lsc} onChange={e => setNewTeam(p => ({ ...p, lsc: e.target.value }))} placeholder="e.g. FL" maxLength={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTeamOpen(false)}>Cancel</Button>
            <Button onClick={saveTeam}>Add Team</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function parseTimeInput(s: string): number | undefined {
  if (!s.trim()) return undefined;
  const clean = s.trim().replace(":", "");
  const dotIdx = clean.lastIndexOf(".");
  if (dotIdx === -1) {
    const n = parseFloat(clean);
    return isNaN(n) ? undefined : n;
  }
  const whole = clean.substring(0, dotIdx);
  const frac = clean.substring(dotIdx + 1);
  const hundredths = parseInt(frac.padEnd(2, "0").substring(0, 2)) / 100;
  const wholeNum = parseInt(whole) || 0;
  if (wholeNum >= 100) {
    const mins = Math.floor(wholeNum / 100);
    const secs = wholeNum % 100;
    return mins * 60 + secs + hundredths;
  }
  return wholeNum + hundredths;
}
