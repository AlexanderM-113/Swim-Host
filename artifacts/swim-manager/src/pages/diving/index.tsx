import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trophy, Users, BarChart2, Pencil, Trash2, ArrowUpDown, X, ChevronDown, ChevronUp
} from "lucide-react";
import { cn } from "@/lib/utils";

const STORE_KEY = "swimmanager_diving";

interface DivingMeet {
  id: number;
  name: string;
  date: string;
  venue: string;
  status: "draft" | "active" | "completed";
  createdAt: string;
}

interface DivingAthlete {
  id: number;
  meetId: number;
  firstName: string;
  lastName: string;
  team: string;
  gender: "M" | "F";
  ageGroup: string;
  category: string;
}

interface DivingDive {
  id: number;
  athleteId: number;
  meetId: number;
  diveNumber: number;
  diveCode: string;
  position: "A" | "B" | "C" | "D";
  dd: number;
  scores: number[];
}

interface DivingStore {
  meets: DivingMeet[];
  athletes: DivingAthlete[];
  dives: DivingDive[];
}

function readDiving(): DivingStore {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}"); } catch { return { meets: [], athletes: [], dives: [] }; }
}
function writeDiving(d: DivingStore) { localStorage.setItem(STORE_KEY, JSON.stringify(d)); }
function nextId(arr: { id: number }[]) { return arr.length === 0 ? 1 : Math.max(...arr.map(a => a.id)) + 1; }

const AGE_GROUPS = ["10 & Under", "11-12", "13-14", "15-16", "17-18", "Open"];
const CATEGORIES = ["Platform", "Springboard 1m", "Springboard 3m"];
const POSITIONS: { value: "A" | "B" | "C" | "D"; label: string }[] = [
  { value: "A", label: "A — Straight" },
  { value: "B", label: "B — Pike" },
  { value: "C", label: "C — Tuck" },
  { value: "D", label: "D — Free" },
];

function calcNetScore(scores: number[], dd: number): number {
  if (scores.length === 0) return 0;
  const sorted = [...scores].sort((a, b) => a - b);
  let net = scores;
  if (scores.length >= 5) net = sorted.slice(1, -1);
  return net.reduce((s, x) => s + x, 0) * dd;
}

function formatScore(n: number) { return n.toFixed(2); }

type MeetForm = { name: string; date: string; venue: string; status: "draft" | "active" | "completed" };
type AthleteForm = { firstName: string; lastName: string; team: string; gender: "M" | "F"; ageGroup: string; category: string };

const BLANK_MEET: MeetForm = { name: "", date: "", venue: "", status: "draft" };
const BLANK_ATHLETE: AthleteForm = { firstName: "", lastName: "", team: "", gender: "M", ageGroup: "Open", category: "Springboard 1m" };

export default function DivingPage() {
  const [data, setData] = useState<DivingStore>(() => {
    const d = readDiving();
    return { meets: d.meets ?? [], athletes: d.athletes ?? [], dives: d.dives ?? [] };
  });

  const [activeMeet, setActiveMeet] = useState<DivingMeet | null>(null);
  const [meetDialog, setMeetDialog] = useState(false);
  const [editMeetId, setEditMeetId] = useState<number | null>(null);
  const [meetForm, setMeetForm] = useState<MeetForm>(BLANK_MEET);

  const [athleteDialog, setAthleteDialog] = useState(false);
  const [editAthleteId, setEditAthleteId] = useState<number | null>(null);
  const [athleteForm, setAthleteForm] = useState<AthleteForm>(BLANK_ATHLETE);

  const [scoringAthlete, setScoringAthlete] = useState<DivingAthlete | null>(null);
  const [diveDialog, setDiveDialog] = useState(false);
  const [diveForm, setDiveForm] = useState({ diveCode: "", position: "C" as "A"|"B"|"C"|"D", dd: "1.0", scores: "" });

  const { toast } = useToast();

  function save(d: DivingStore) { setData(d); writeDiving(d); }

  function submitMeet() {
    if (!meetForm.name) { toast({ title: "Name required", variant: "destructive" }); return; }
    const meet: DivingMeet = { id: editMeetId ?? nextId(data.meets), ...meetForm, createdAt: new Date().toISOString() };
    const meets = editMeetId ? data.meets.map(m => m.id === editMeetId ? meet : m) : [...data.meets, meet];
    save({ ...data, meets });
    setMeetDialog(false);
    toast({ title: editMeetId ? "Meet updated" : "Meet created" });
  }

  function submitAthlete() {
    if (!athleteForm.firstName || !activeMeet) { toast({ title: "Name required", variant: "destructive" }); return; }
    const ath: DivingAthlete = { id: editAthleteId ?? nextId(data.athletes), meetId: activeMeet.id, ...athleteForm };
    const athletes = editAthleteId ? data.athletes.map(a => a.id === editAthleteId ? ath : a) : [...data.athletes, ath];
    save({ ...data, athletes });
    setAthleteDialog(false);
    toast({ title: editAthleteId ? "Athlete updated" : "Athlete added" });
  }

  function submitDive() {
    if (!scoringAthlete || !activeMeet) return;
    const scores = diveForm.scores.split(",").map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    const dives = data.dives.filter(d => d.athleteId === scoringAthlete.id && d.meetId === activeMeet.id);
    const dive: DivingDive = {
      id: nextId(data.dives), athleteId: scoringAthlete.id, meetId: activeMeet.id,
      diveNumber: dives.length + 1, diveCode: diveForm.diveCode,
      position: diveForm.position, dd: parseFloat(diveForm.dd), scores,
    };
    save({ ...data, dives: [...data.dives, dive] });
    setDiveForm({ diveCode: "", position: "C", dd: "1.0", scores: "" });
    toast({ title: "Dive recorded" });
  }

  const meetAthletes = data.athletes.filter(a => a.meetId === activeMeet?.id);

  function getAthleteTotals(a: DivingAthlete) {
    const dives = data.dives.filter(d => d.athleteId === a.id && d.meetId === activeMeet?.id);
    const total = dives.reduce((s, d) => s + calcNetScore(d.scores, d.dd), 0);
    return { dives, total };
  }

  const standings = meetAthletes.map(a => ({ ...a, ...getAthleteTotals(a) })).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Diving Manager</h1>
          <p className="text-muted-foreground text-sm">Manage diving meets, athletes, dives, and scoring</p>
        </div>
        <Button onClick={() => { setEditMeetId(null); setMeetForm(BLANK_MEET); setMeetDialog(true); }}>
          <Plus className="h-4 w-4 mr-2" />New Diving Meet
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Meet list */}
        <div className="space-y-3">
          {data.meets.length === 0 && (
            <Card className="border-dashed"><CardContent className="py-8 text-center text-muted-foreground text-sm">No diving meets yet.</CardContent></Card>
          )}
          {data.meets.map(m => (
            <Card key={m.id}
              className={cn("cursor-pointer hover:shadow-md transition-all", activeMeet?.id === m.id ? "ring-2 ring-primary" : "")}
              onClick={() => setActiveMeet(m)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-sm">{m.name}</div>
                    <div className="text-xs text-muted-foreground">{m.date} · {m.venue || "No venue"}</div>
                  </div>
                  <Badge className={cn("text-[10px]", m.status === "active" ? "bg-green-600" : m.status === "completed" ? "bg-blue-600" : "bg-slate-500")} variant="default">
                    {m.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Meet detail */}
        {activeMeet ? (
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">{activeMeet.name}</h2>
                <p className="text-sm text-muted-foreground">{activeMeet.date} · {activeMeet.venue || "No venue"}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => {
                  setEditMeetId(activeMeet.id);
                  setMeetForm({ name: activeMeet.name, date: activeMeet.date, venue: activeMeet.venue, status: activeMeet.status });
                  setMeetDialog(true);
                }}><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>
                <Button size="sm" variant="destructive" onClick={() => {
                  const meets = data.meets.filter(m => m.id !== activeMeet.id);
                  const athletes = data.athletes.filter(a => a.meetId !== activeMeet.id);
                  const dives = data.dives.filter(d => d.meetId !== activeMeet.id);
                  save({ meets, athletes, dives });
                  setActiveMeet(null);
                  toast({ title: "Meet deleted" });
                }}><Trash2 className="h-3.5 w-3.5 mr-1" />Delete</Button>
              </div>
            </div>

            <Tabs defaultValue="athletes">
              <TabsList>
                <TabsTrigger value="athletes"><Users className="h-3.5 w-3.5 mr-1" />Athletes ({meetAthletes.length})</TabsTrigger>
                <TabsTrigger value="scoring"><ArrowUpDown className="h-3.5 w-3.5 mr-1" />Scoring</TabsTrigger>
                <TabsTrigger value="results"><Trophy className="h-3.5 w-3.5 mr-1" />Results</TabsTrigger>
              </TabsList>

              <TabsContent value="athletes" className="mt-4 space-y-3">
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => { setEditAthleteId(null); setAthleteForm(BLANK_ATHLETE); setAthleteDialog(true); }}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Add Athlete
                  </Button>
                </div>
                {meetAthletes.length === 0 ? (
                  <Card className="border-dashed"><CardContent className="py-8 text-center text-muted-foreground text-sm">No athletes in this meet.</CardContent></Card>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Gender</TableHead>
                        <TableHead>Age Group</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {meetAthletes.map(a => {
                        const { total } = getAthleteTotals(a);
                        return (
                          <TableRow key={a.id}>
                            <TableCell className="font-semibold">{a.lastName}, {a.firstName}</TableCell>
                            <TableCell>{a.gender}</TableCell>
                            <TableCell className="text-sm">{a.ageGroup}</TableCell>
                            <TableCell className="text-sm">{a.category}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{a.team}</TableCell>
                            <TableCell className="text-right font-mono font-bold">{total > 0 ? formatScore(total) : "—"}</TableCell>
                            <TableCell>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                                onClick={() => {
                                  save({ ...data, athletes: data.athletes.filter(x => x.id !== a.id), dives: data.dives.filter(d => d.athleteId !== a.id) });
                                }}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="scoring" className="mt-4 space-y-4">
                <div className="space-y-3">
                  {meetAthletes.map(a => {
                    const { dives, total } = getAthleteTotals(a);
                    const isActive = scoringAthlete?.id === a.id;
                    return (
                      <Card key={a.id} className={isActive ? "ring-2 ring-primary" : ""}>
                        <CardHeader className="py-3 px-4 cursor-pointer" onClick={() => setScoringAthlete(isActive ? null : a)}>
                          <div className="flex items-center justify-between">
                            <div className="font-semibold text-sm">{a.lastName}, {a.firstName} — {a.category}</div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-lg">{total > 0 ? formatScore(total) : "0.00"}</span>
                              {isActive ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </div>
                          </div>
                        </CardHeader>
                        {isActive && (
                          <CardContent className="pt-0 space-y-3">
                            {dives.length > 0 && (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-10">#</TableHead>
                                    <TableHead>Dive</TableHead>
                                    <TableHead>Pos</TableHead>
                                    <TableHead>DD</TableHead>
                                    <TableHead>Scores</TableHead>
                                    <TableHead className="text-right">Net</TableHead>
                                    <TableHead className="w-10" />
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {dives.map(d => (
                                    <TableRow key={d.id}>
                                      <TableCell className="font-bold">{d.diveNumber}</TableCell>
                                      <TableCell className="font-mono text-sm">{d.diveCode}</TableCell>
                                      <TableCell>{d.position}</TableCell>
                                      <TableCell className="font-mono">{d.dd.toFixed(1)}</TableCell>
                                      <TableCell className="font-mono text-sm">{d.scores.join(", ")}</TableCell>
                                      <TableCell className="text-right font-mono font-bold">{formatScore(calcNetScore(d.scores, d.dd))}</TableCell>
                                      <TableCell>
                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                                          onClick={() => save({ ...data, dives: data.dives.filter(x => x.id !== d.id) })}>
                                          <X className="h-3.5 w-3.5" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                            <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
                              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add Dive</div>
                              <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1"><Label className="text-xs">Dive Code</Label>
                                  <Input placeholder="e.g. 101" value={diveForm.diveCode} onChange={e => setDiveForm(f => ({ ...f, diveCode: e.target.value }))} className="h-8 text-sm" />
                                </div>
                                <div className="space-y-1"><Label className="text-xs">Position</Label>
                                  <Select value={diveForm.position} onValueChange={v => setDiveForm(f => ({ ...f, position: v as any }))}>
                                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                    <SelectContent>{POSITIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1"><Label className="text-xs">Degree of Difficulty</Label>
                                  <Input placeholder="e.g. 1.6" value={diveForm.dd} onChange={e => setDiveForm(f => ({ ...f, dd: e.target.value }))} className="h-8 text-sm font-mono" />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Judge Scores (comma-separated)</Label>
                                <Input placeholder="e.g. 6.5, 7.0, 6.5, 7.5, 7.0" value={diveForm.scores} onChange={e => setDiveForm(f => ({ ...f, scores: e.target.value }))} className="h-8 text-sm font-mono" />
                              </div>
                              <Button size="sm" onClick={submitDive}>Record Dive</Button>
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                  {meetAthletes.length === 0 && (
                    <Card className="border-dashed"><CardContent className="py-8 text-center text-muted-foreground text-sm">Add athletes first from the Athletes tab.</CardContent></Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="results" className="mt-4">
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Trophy className="h-4 w-4" />Final Standings</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    {standings.length === 0 ? (
                      <div className="py-8 text-center text-muted-foreground text-sm">No results yet.</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="pl-4 w-12">Place</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Team</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-center">Dives</TableHead>
                            <TableHead className="text-right pr-4">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {standings.map((s, i) => (
                            <TableRow key={s.id} className={i < 3 ? "bg-amber-50/50 dark:bg-amber-900/10" : ""}>
                              <TableCell className="pl-4 font-black text-xl">{i + 1}</TableCell>
                              <TableCell className="font-semibold">{s.lastName}, {s.firstName}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{s.team}</TableCell>
                              <TableCell className="text-sm">{s.category}</TableCell>
                              <TableCell className="text-center text-sm">{s.dives.length}</TableCell>
                              <TableCell className="text-right pr-4 font-mono font-bold text-lg">{formatScore(s.total)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="lg:col-span-2 flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl min-h-[300px]">
            <div className="text-center"><Trophy className="h-10 w-10 mx-auto mb-2 opacity-20" /><p>Select a diving meet to manage it</p></div>
          </div>
        )}
      </div>

      {/* Meet dialog */}
      <Dialog open={meetDialog} onOpenChange={setMeetDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editMeetId ? "Edit Diving Meet" : "New Diving Meet"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Meet Name *</Label><Input value={meetForm.name} onChange={e => setMeetForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Date</Label><Input type="date" value={meetForm.date} onChange={e => setMeetForm(f => ({ ...f, date: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Status</Label>
                <Select value={meetForm.status} onValueChange={v => setMeetForm(f => ({ ...f, status: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1"><Label>Venue</Label><Input value={meetForm.venue} onChange={e => setMeetForm(f => ({ ...f, venue: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMeetDialog(false)}>Cancel</Button>
            <Button onClick={submitMeet}>{editMeetId ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Athlete dialog */}
      <Dialog open={athleteDialog} onOpenChange={setAthleteDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editAthleteId ? "Edit Diver" : "Add Diver"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>First Name *</Label><Input value={athleteForm.firstName} onChange={e => setAthleteForm(f => ({ ...f, firstName: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Last Name</Label><Input value={athleteForm.lastName} onChange={e => setAthleteForm(f => ({ ...f, lastName: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Team</Label><Input value={athleteForm.team} onChange={e => setAthleteForm(f => ({ ...f, team: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Gender</Label>
                <Select value={athleteForm.gender} onValueChange={v => setAthleteForm(f => ({ ...f, gender: v as "M"|"F" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="M">Male</SelectItem><SelectItem value="F">Female</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Age Group</Label>
                <Select value={athleteForm.ageGroup} onValueChange={v => setAthleteForm(f => ({ ...f, ageGroup: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{AGE_GROUPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Category</Label>
                <Select value={athleteForm.category} onValueChange={v => setAthleteForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAthleteDialog(false)}>Cancel</Button>
            <Button onClick={submitAthlete}>{editAthleteId ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
