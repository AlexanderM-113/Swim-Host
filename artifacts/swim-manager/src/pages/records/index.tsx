import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatTime, parseTime } from "@/lib/format-time";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trophy, Pencil, Trash2, Star } from "lucide-react";

const STROKES = ["Freestyle", "Backstroke", "Breaststroke", "Butterfly", "IM"];
const DISTANCES_SCY = [25, 50, 100, 200, 400, 500, 1000, 1650];
const DISTANCES_SCM = [50, 100, 200, 400, 800, 1500];
const DISTANCES_LCM = [50, 100, 200, 400, 800, 1500];
const COURSES = ["SCY", "SCM", "LCM"];
const GENDERS = [{ value: "M", label: "Boys / Male" }, { value: "F", label: "Girls / Female" }];
const AGE_GROUPS = ["8U", "9-10", "11-12", "13-14", "15-16", "17-18", "Open", "Senior"];
const RECORD_TYPES = ["Club", "Team", "LSC", "National"];

interface RecordForm {
  stroke: string;
  distance: string;
  course: string;
  gender: string;
  ageGroup: string;
  recordTime: string;
  athleteName: string;
  teamName: string;
  meetName: string;
  meetDate: string;
  recordType: string;
}

const BLANK: RecordForm = {
  stroke: "Freestyle", distance: "100", course: "SCY", gender: "M",
  ageGroup: "Open", recordTime: "", athleteName: "", teamName: "",
  meetName: "", meetDate: "", recordType: "Club",
};

function fetchRecords(params: Record<string, string>) {
  const q = new URLSearchParams(params).toString();
  return fetch(`/api/records${q ? "?" + q : ""}`).then(r => r.json());
}

export default function RecordsPage() {
  const [courseFilter, setCourseFilter] = useState("SCY");
  const [genderFilter, setGenderFilter] = useState("all");
  const [strokeFilter, setStrokeFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<RecordForm>(BLANK);
  const { toast } = useToast();
  const qc = useQueryClient();

  const params: Record<string, string> = { course: courseFilter };
  if (genderFilter !== "all") params.gender = genderFilter;
  if (strokeFilter !== "all") params.stroke = strokeFilter;

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["records", params],
    queryFn: () => fetchRecords(params),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => fetch("/api/records", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
    }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["records"] }); setDialogOpen(false); toast({ title: "Record saved" }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => fetch(`/api/records/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
    }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["records"] }); setDialogOpen(false); toast({ title: "Record updated" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/records/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["records"] }); toast({ title: "Record deleted" }); },
  });

  function openAdd() {
    setEditId(null);
    setForm(BLANK);
    setDialogOpen(true);
  }

  function openEdit(r: any) {
    setEditId(r.id);
    setForm({
      stroke: r.stroke,
      distance: String(r.distance),
      course: r.course,
      gender: r.gender,
      ageGroup: r.ageGroup,
      recordTime: r.recordTime ? formatTime(r.recordTime) : "",
      athleteName: r.athleteName || "",
      teamName: r.teamName || "",
      meetName: r.meetName || "",
      meetDate: r.meetDate || "",
      recordType: r.recordType || "Club",
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    const time = parseTime(form.recordTime);
    if (!time) { toast({ title: "Invalid time format", description: "Use MM:SS.ss or SS.ss", variant: "destructive" }); return; }
    const payload = {
      stroke: form.stroke,
      distance: parseInt(form.distance),
      course: form.course,
      gender: form.gender,
      ageGroup: form.ageGroup,
      recordTime: time,
      athleteName: form.athleteName,
      teamName: form.teamName,
      meetName: form.meetName,
      meetDate: form.meetDate,
      recordType: form.recordType,
    };
    if (editId) updateMutation.mutate({ id: editId, data: payload });
    else createMutation.mutate(payload);
  }

  const distances = courseFilter === "LCM" ? DISTANCES_LCM : courseFilter === "SCM" ? DISTANCES_SCM : DISTANCES_SCY;

  const grouped = STROKES.reduce((acc, stroke) => {
    const filtered = records.filter((r: any) =>
      (strokeFilter === "all" || r.stroke === strokeFilter) && r.stroke === stroke
    );
    if (filtered.length > 0) acc[stroke] = filtered;
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" /> Club Records
          </h1>
          <p className="text-muted-foreground text-sm">All-time best times by stroke, distance, and age group</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add Record</Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={courseFilter} onValueChange={setCourseFilter}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>{COURSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={genderFilter} onValueChange={setGenderFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Genders" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Genders</SelectItem>
            {GENDERS.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={strokeFilter} onValueChange={setStrokeFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All Strokes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Strokes</SelectItem>
            {STROKES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground">{records.length} record{records.length !== 1 ? "s" : ""}</div>
      </div>

      {isLoading && <Card><CardContent className="py-8 text-center text-muted-foreground">Loading records...</CardContent></Card>}

      {!isLoading && records.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center text-muted-foreground">
            <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>No records yet. Add your first club record!</p>
          </CardContent>
        </Card>
      )}

      {Object.entries(grouped).map(([stroke, recs]) => (
        <Card key={stroke}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{stroke}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Distance</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Age Group</TableHead>
                  <TableHead className="font-mono">Time</TableHead>
                  <TableHead>Athlete</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Meet / Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(recs as any[]).sort((a, b) => a.distance - b.distance || a.gender.localeCompare(b.gender) || a.ageGroup.localeCompare(b.ageGroup)).map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono font-semibold">{r.distance}m</TableCell>
                    <TableCell>{r.gender === "M" ? "Male" : "Female"}</TableCell>
                    <TableCell>{r.ageGroup}</TableCell>
                    <TableCell className="font-mono text-primary font-bold flex items-center gap-1.5">
                      <Star className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                      {formatTime(r.recordTime)}
                    </TableCell>
                    <TableCell className="font-semibold">{r.athleteName}</TableCell>
                    <TableCell className="text-muted-foreground">{r.teamName || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{r.meetName || "—"}{r.meetDate ? ` (${r.meetDate})` : ""}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{r.recordType}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? "Edit Record" : "Add Club Record"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Course</Label>
                <Select value={form.course} onValueChange={v => setForm(f => ({ ...f, course: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{COURSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Gender</Label>
                <Select value={form.gender} onValueChange={v => setForm(f => ({ ...f, gender: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{GENDERS.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Age Group</Label>
                <Select value={form.ageGroup} onValueChange={v => setForm(f => ({ ...f, ageGroup: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{AGE_GROUPS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Stroke</Label>
                <Select value={form.stroke} onValueChange={v => setForm(f => ({ ...f, stroke: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STROKES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Distance (m)</Label>
                <Input value={form.distance} onChange={e => setForm(f => ({ ...f, distance: e.target.value }))} placeholder="100" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Record Time</Label>
                <Input value={form.recordTime} onChange={e => setForm(f => ({ ...f, recordTime: e.target.value }))} placeholder="1:23.45" />
              </div>
              <div className="space-y-1">
                <Label>Record Type</Label>
                <Select value={form.recordType} onValueChange={v => setForm(f => ({ ...f, recordType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{RECORD_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Athlete Name</Label>
                <Input value={form.athleteName} onChange={e => setForm(f => ({ ...f, athleteName: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Team</Label>
                <Input value={form.teamName} onChange={e => setForm(f => ({ ...f, teamName: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Meet Name</Label>
                <Input value={form.meetName} onChange={e => setForm(f => ({ ...f, meetName: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" value={form.meetDate} onChange={e => setForm(f => ({ ...f, meetDate: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>{editId ? "Update" : "Add Record"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
