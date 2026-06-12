import { useState, useRef } from "react";
import {
  useListAthletes, useListTeams,
  useListTimeTrialSessions, useCreateTimeTrialSession,
  useUpdateTimeTrialSession, useDeleteTimeTrialSession,
  readStore,
} from "@/lib/local-store";
import type { TimeTrialSession, TimeTrialEvent, TimeTrialResult } from "@/lib/local-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Plus, Trash2, ChevronDown, ChevronUp, Printer, ClipboardList,
  Users, Timer, FileText, Save, AlertTriangle, Trophy,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { formatTime } from "@/lib/format-time";

// ─── Constants ────────────────────────────────────────────────────────────────

const STROKES = ["Freestyle", "Backstroke", "Breaststroke", "Butterfly", "Individual Medley"];
const DISTANCES = [25, 50, 100, 150, 200, 400, 500, 800, 1000, 1500, 1650];
const COURSES = ["SCY", "SCM", "LCM"];

const ALL_GROUPS = ["Elite", "Senior", "Age Group", "Junior", "Developmental", "Masters", "Novice"];

// ─── Time parsing/formatting ──────────────────────────────────────────────────

function parseTimeInput(val: string): number | null {
  val = val.trim();
  if (!val) return null;
  const colonIdx = val.indexOf(":");
  if (colonIdx >= 0) {
    const mins = parseFloat(val.substring(0, colonIdx));
    const secs = parseFloat(val.substring(colonIdx + 1));
    if (isNaN(mins) || isNaN(secs)) return null;
    return mins * 60 + secs;
  }
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

// ─── Report component (print-friendly) ───────────────────────────────────────

function TimeTrialReport({ session, onClose }: { session: TimeTrialSession; onClose: () => void }) {
  const store = readStore();

  const athleteMap = new Map(store.athletes.map((a) => [a.id, a]));
  const teamMap = new Map(store.teams.map((t) => [t.id, t]));

  function getResult(athleteId: number, eventIndex: number): TimeTrialResult | undefined {
    return session.results.find((r) => r.athleteId === athleteId && r.eventIndex === eventIndex);
  }

  function athleteName(id: number) {
    const a = athleteMap.get(id);
    return a ? `${a.lastName}, ${a.firstName}` : `Athlete #${id}`;
  }

  function teamName(id: number) {
    const a = athleteMap.get(id);
    if (!a?.teamId) return "";
    return teamMap.get(a.teamId)?.abbreviation ?? "";
  }

  function rankForEvent(eventIndex: number): Array<{ athleteId: number; time: number | null; rank: number; dq: boolean; ns: boolean }> {
    const rows = session.athleteIds.map((athleteId) => {
      const r = getResult(athleteId, eventIndex);
      return { athleteId, time: r?.time ?? null, dq: r?.dq ?? false, ns: r?.ns ?? false, rank: 0 };
    });
    const timed = rows.filter((r) => r.time != null && !r.dq && !r.ns).sort((a, b) => a.time! - b.time!);
    timed.forEach((r, i) => { r.rank = i + 1; });
    return rows;
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-primary" />
            Time Trial Report — {session.title}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-6 min-h-0 print:overflow-visible" id="ttr-report">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>Date: <span className="font-medium text-foreground">{format(new Date(session.date), "MMMM d, yyyy")}</span></div>
            {session.groupName && <div>Group: <Badge variant="outline">{session.groupName}</Badge></div>}
            <div>{session.athleteIds.length} athletes · {session.events.length} event{session.events.length !== 1 ? "s" : ""}</div>
          </div>

          {session.workoutNotes && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <div className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-1">Workout / Test Set Notes</div>
              <p className="whitespace-pre-wrap">{session.workoutNotes}</p>
            </div>
          )}

          {session.events.map((ev, evIdx) => {
            const ranked = rankForEvent(evIdx);
            return (
              <div key={evIdx} className="space-y-2">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-base">{ev.distance} {ev.stroke}</h3>
                  <Badge variant="outline" className="text-xs">{ev.course}</Badge>
                </div>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4 w-12">Place</TableHead>
                        <TableHead>Athlete</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead className="font-mono text-right pr-4">Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ranked.map(({ athleteId, time, rank, dq, ns }) => (
                        <TableRow key={athleteId}>
                          <TableCell className="pl-4">
                            {dq ? <Badge className="bg-red-600 text-white text-[10px]">DQ</Badge>
                              : ns ? <Badge className="bg-slate-500 text-white text-[10px]">NS</Badge>
                              : time != null ? <span className="font-bold text-primary">{rank}</span>
                              : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="font-medium">{athleteName(athleteId)}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{teamName(athleteId)}</TableCell>
                          <TableCell className="text-right pr-4 font-mono">
                            {dq ? <span className="text-red-500">DQ</span>
                              : ns ? <span className="text-muted-foreground">NS</span>
                              : time != null ? <span className="text-green-400 font-semibold">{formatTime(time)}</span>
                              : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })}
        </div>
        <DialogFooter className="pt-2 border-t border-border">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
          <DialogClose asChild>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Session editor ───────────────────────────────────────────────────────────

interface SessionEditorProps {
  existingSession?: TimeTrialSession;
  onSaved: () => void;
  onCancel: () => void;
}

function SessionEditor({ existingSession, onSaved, onCancel }: SessionEditorProps) {
  const { data: allAthletes } = useListAthletes();
  const { data: teams } = useListTeams();

  const globalAthletes = (allAthletes ?? []).filter((a: any) => !a.meetId);

  const [title, setTitle] = useState(existingSession?.title ?? "");
  const [date, setDate] = useState(existingSession?.date ?? new Date().toISOString().split("T")[0]);
  const [groupName, setGroupName] = useState(existingSession?.groupName ?? "");
  const [workoutNotes, setWorkoutNotes] = useState(existingSession?.workoutNotes ?? "");
  const [events, setEvents] = useState<TimeTrialEvent[]>(existingSession?.events ?? [{ distance: 100, stroke: "Freestyle", course: "SCY" }]);
  const [athleteIds, setAthleteIds] = useState<number[]>(existingSession?.athleteIds ?? []);
  const [results, setResults] = useState<TimeTrialResult[]>(existingSession?.results ?? []);
  const [athleteSearch, setAthleteSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateTimeTrialSession();
  const updateMutation = useUpdateTimeTrialSession();
  const { toast } = useToast();

  const availableGroups = Array.from(new Set([
    ...ALL_GROUPS,
    ...globalAthletes.map((a: any) => a.trainingGroup).filter(Boolean),
  ]));

  const filteredAthletes = globalAthletes.filter((a: any) => {
    const q = athleteSearch.toLowerCase();
    const nameMatch = `${a.firstName} ${a.lastName}`.toLowerCase().includes(q);
    const groupMatch = !groupName || a.trainingGroup === groupName || groupName === "";
    return nameMatch && (q || groupMatch);
  });

  function selectAllFromGroup() {
    const inGroup = globalAthletes
      .filter((a: any) => !groupName || a.trainingGroup === groupName)
      .map((a: any) => a.id);
    setAthleteIds((prev) => Array.from(new Set([...prev, ...inGroup])));
  }

  function toggleAthlete(id: number) {
    setAthleteIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function addEvent() {
    setEvents((prev) => [...prev, { distance: 100, stroke: "Freestyle", course: "SCY" }]);
  }

  function removeEvent(idx: number) {
    setEvents((prev) => prev.filter((_, i) => i !== idx));
    setResults((prev) => prev.filter((r) => r.eventIndex !== idx).map((r) => ({
      ...r,
      eventIndex: r.eventIndex > idx ? r.eventIndex - 1 : r.eventIndex,
    })));
  }

  function updateEvent(idx: number, patch: Partial<TimeTrialEvent>) {
    setEvents((prev) => prev.map((ev, i) => i === idx ? { ...ev, ...patch } : ev));
  }

  function setResult(athleteId: number, eventIndex: number, patch: Partial<TimeTrialResult>) {
    setResults((prev) => {
      const existing = prev.find((r) => r.athleteId === athleteId && r.eventIndex === eventIndex);
      if (existing) {
        return prev.map((r) =>
          r.athleteId === athleteId && r.eventIndex === eventIndex ? { ...r, ...patch } : r
        );
      }
      return [...prev, { athleteId, eventIndex, ...patch }];
    });
  }

  function getResult(athleteId: number, eventIndex: number): TimeTrialResult | undefined {
    return results.find((r) => r.athleteId === athleteId && r.eventIndex === eventIndex);
  }

  function athleteName(id: number) {
    const a = globalAthletes.find((a: any) => a.id === id);
    return a ? `${a.lastName}, ${a.firstName}` : `#${id}`;
  }

  async function handleSave() {
    if (!title.trim()) { setError("Title is required"); return; }
    if (events.length === 0) { setError("Add at least one event/distance"); return; }
    setError(null);
    setSaving(true);
    try {
      const data = { title: title.trim(), date, groupName: groupName || undefined, workoutNotes: workoutNotes || undefined, events, athleteIds, results };
      if (existingSession) {
        await updateMutation.mutateAsync({ id: existingSession.id, data });
        toast({ title: "Session updated" });
      } else {
        await createMutation.mutateAsync({ data });
        toast({ title: "Time trial session saved" });
      }
      onSaved();
    } catch (err: any) {
      setError(err?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const teamMap = new Map((teams ?? []).map((t: any) => [t.id, t]));

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>Session Title *</Label>
          <Input placeholder="e.g. Season Opener Test Set" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Training Group</Label>
          <Select value={groupName} onValueChange={setGroupName}>
            <SelectTrigger><SelectValue placeholder="All / Any group" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">All groups</SelectItem>
              {availableGroups.map((g) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Workout notes */}
      <div className="space-y-1.5">
        <Label>Workout / Test Set Description</Label>
        <Textarea
          placeholder="Describe the workout or test set…&#10;e.g. 400 warm-up → 4×100 descend → 200 MAX effort → 200 easy"
          value={workoutNotes}
          onChange={(e) => setWorkoutNotes(e.target.value)}
          rows={3}
          className="text-sm"
        />
      </div>

      {/* Events */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Events / Distances to Time</Label>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addEvent}>
            <Plus className="h-3 w-3 mr-1" /> Add Event
          </Button>
        </div>
        <div className="space-y-2">
          {events.map((ev, idx) => (
            <div key={idx} className="flex items-center gap-2 rounded-lg border bg-card/50 p-2">
              <span className="text-xs text-muted-foreground w-6 text-right shrink-0">{idx + 1}.</span>
              <Select value={String(ev.distance)} onValueChange={(v) => updateEvent(idx, { distance: parseInt(v) })}>
                <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DISTANCES.map((d) => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={ev.stroke} onValueChange={(v) => updateEvent(idx, { stroke: v })}>
                <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STROKES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={ev.course} onValueChange={(v) => updateEvent(idx, { course: v })}>
                <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COURSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={() => removeEvent(idx)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {events.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No events added yet.</p>
          )}
        </div>
      </div>

      {/* Athlete selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">
            Select Athletes
            {athleteIds.length > 0 && <Badge variant="secondary" className="ml-2">{athleteIds.length} selected</Badge>}
          </Label>
          {groupName && groupName !== "any" && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={selectAllFromGroup}>
              Select all in {groupName}
            </Button>
          )}
        </div>
        <Input
          placeholder="Search athletes…"
          className="h-8 text-sm"
          value={athleteSearch}
          onChange={(e) => setAthleteSearch(e.target.value)}
        />
        <div className="border rounded-md max-h-48 overflow-y-auto">
          {filteredAthletes.length === 0 ? (
            <p className="text-center py-6 text-sm text-muted-foreground">
              {globalAthletes.length === 0
                ? "No athletes in Team Manager. Add athletes first."
                : "No athletes match search."}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {filteredAthletes.map((a: any) => {
                const team = a.teamId ? teamMap.get(a.teamId) : null;
                return (
                  <label key={a.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40 text-sm">
                    <Checkbox
                      checked={athleteIds.includes(a.id)}
                      onCheckedChange={() => toggleAthlete(a.id)}
                    />
                    <span className="flex-1 font-medium">{a.lastName}, {a.firstName}</span>
                    {a.trainingGroup && <Badge variant="outline" className="text-[10px]">{a.trainingGroup}</Badge>}
                    {team && <span className="font-mono text-xs text-muted-foreground">{(team as any).abbreviation}</span>}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Time entry grid */}
      {athleteIds.length > 0 && events.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-semibold flex items-center gap-2">
            <Timer className="h-4 w-4 text-cyan-500" /> Enter Times
          </Label>
          <p className="text-xs text-muted-foreground">Format: MM:SS.ss or SS.ss — e.g. 1:23.45 or 59.80</p>
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4 min-w-[140px]">Athlete</TableHead>
                  {events.map((ev, i) => (
                    <TableHead key={i} className="text-center min-w-[120px]">
                      <div>{ev.distance} {ev.stroke.split(" ")[0]}</div>
                      <div className="font-normal text-muted-foreground text-[10px]">{ev.course}</div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {athleteIds.map((athleteId) => (
                  <TableRow key={athleteId}>
                    <TableCell className="pl-4 font-medium text-sm">{athleteName(athleteId)}</TableCell>
                    {events.map((_, evIdx) => {
                      const r = getResult(athleteId, evIdx);
                      return (
                        <TableCell key={evIdx} className="py-1 px-2">
                          <div className="flex items-center gap-1">
                            <Input
                              className="h-7 w-24 text-xs font-mono text-center"
                              placeholder="—"
                              value={r?.time != null ? formatTime(r.time) : ""}
                              onChange={(e) => {
                                const parsed = parseTimeInput(e.target.value);
                                setResult(athleteId, evIdx, { time: parsed ?? undefined, dq: false, ns: false });
                              }}
                              disabled={r?.dq || r?.ns}
                            />
                            <Select
                              value={r?.dq ? "dq" : r?.ns ? "ns" : "ok"}
                              onValueChange={(v) => {
                                if (v === "dq") setResult(athleteId, evIdx, { dq: true, ns: false, time: undefined });
                                else if (v === "ns") setResult(athleteId, evIdx, { dq: false, ns: true, time: undefined });
                                else setResult(athleteId, evIdx, { dq: false, ns: false });
                              }}
                            >
                              <SelectTrigger className="h-7 w-14 text-[10px] px-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ok">OK</SelectItem>
                                <SelectItem value="dq">DQ</SelectItem>
                                <SelectItem value="ns">NS</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-1" />
          {saving ? "Saving…" : existingSession ? "Update Session" : "Save Session"}
        </Button>
      </div>
    </div>
  );
}

// ─── Sessions list ─────────────────────────────────────────────────────────────

function SessionCard({ session, onEdit, onReport, onDelete }: {
  session: TimeTrialSession;
  onEdit: () => void;
  onReport: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const store = readStore();
  const athleteMap = new Map(store.athletes.map((a) => [a.id, a]));

  const completedResultsCount = session.results.filter((r) => r.time != null || r.dq || r.ns).length;
  const totalPossible = session.athleteIds.length * session.events.length;

  return (
    <Card className="transition-all">
      <button type="button" className="w-full text-left" onClick={() => setOpen((v) => !v)}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">{session.title}</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {format(new Date(session.date), "MMM d, yyyy")}
                {session.groupName && <> · <span className="font-medium">{session.groupName}</span></>}
                {" · "}{session.athleteIds.length} athletes
                {" · "}{session.events.length} event{session.events.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {totalPossible > 0 && (
                <Badge variant={completedResultsCount === totalPossible ? "default" : "outline"} className="text-[10px]">
                  {completedResultsCount}/{totalPossible} times
                </Badge>
              )}
              {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>
        </CardHeader>
      </button>

      {open && (
        <CardContent className="pt-0 space-y-3">
          {session.workoutNotes && (
            <div className="rounded border border-border bg-muted/20 p-2 text-xs text-muted-foreground whitespace-pre-wrap">
              {session.workoutNotes}
            </div>
          )}

          <div className="flex flex-wrap gap-2 text-xs">
            {session.events.map((ev, i) => (
              <Badge key={i} variant="outline">{ev.distance} {ev.stroke} ({ev.course})</Badge>
            ))}
          </div>

          {session.athleteIds.length > 0 && (
            <div className="flex flex-wrap gap-1 text-xs">
              {session.athleteIds.slice(0, 8).map((id) => {
                const a = athleteMap.get(id);
                return a ? (
                  <span key={id} className="rounded border border-border bg-muted/30 px-1.5 py-0.5">
                    {a.firstName} {a.lastName}
                  </span>
                ) : null;
              })}
              {session.athleteIds.length > 8 && (
                <span className="text-muted-foreground">+{session.athleteIds.length - 8} more</span>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="default" className="h-7 text-xs" onClick={onReport}>
              <Trophy className="h-3 w-3 mr-1" /> View Report
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onEdit}>
              Edit / Enter Times
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive ml-auto" onClick={onDelete}>
              <Trash2 className="h-3 w-3 mr-1" /> Delete
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function TimeTrialsManager() {
  const { data: sessions, isLoading } = useListTimeTrialSessions();
  const deleteMutation = useDeleteTimeTrialSession();
  const { toast } = useToast();

  const [view, setView] = useState<"list" | "new" | "edit">("list");
  const [editing, setEditing] = useState<TimeTrialSession | undefined>();
  const [reportSession, setReportSession] = useState<TimeTrialSession | null>(null);

  function handleDelete(id: number) {
    if (!confirm("Delete this time trial session? This cannot be undone.")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => toast({ title: "Session deleted" }),
    });
  }

  if (view === "new" || view === "edit") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => { setView("list"); setEditing(undefined); }} className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to sessions
          </button>
          <h2 className="text-lg font-semibold">
            {view === "edit" ? "Edit Time Trial Session" : "New Time Trial Session"}
          </h2>
        </div>
        <SessionEditor
          existingSession={editing}
          onSaved={() => { setView("list"); setEditing(undefined); }}
          onCancel={() => { setView("list"); setEditing(undefined); }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Time Trials / Test Sets
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Select athletes, write a workout, record times, and generate a ranked report.
          </p>
        </div>
        <Button size="sm" onClick={() => setView("new")}>
          <Plus className="h-4 w-4 mr-1" /> New Session
        </Button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>
      ) : sessions && sessions.length > 0 ? (
        <div className="space-y-3">
          {sessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              onEdit={() => { setEditing(s); setView("edit"); }}
              onReport={() => setReportSession(s)}
              onDelete={() => handleDelete(s.id)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 space-y-3 text-muted-foreground">
          <ClipboardList className="h-12 w-12 mx-auto opacity-20" />
          <p className="text-sm">No time trial sessions yet.</p>
          <Button size="sm" onClick={() => setView("new")}>
            <Plus className="h-4 w-4 mr-1" /> Create your first session
          </Button>
        </div>
      )}

      {reportSession && (
        <TimeTrialReport session={reportSession} onClose={() => setReportSession(null)} />
      )}
    </div>
  );
}
