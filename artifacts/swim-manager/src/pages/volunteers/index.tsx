import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useListVolunteers, useCreateVolunteer, useUpdateVolunteer, useDeleteVolunteer,
  useListVolunteerShifts, useCreateVolunteerShift, useUpdateVolunteerShift, useDeleteVolunteerShift,
  useListMeets, type Volunteer,
} from "@/lib/local-store";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Pencil, Trash2, UserCheck, Clock, CalendarDays, Mail, Phone, X, CheckCircle2, XCircle
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL_ROLES = [
  "Timekeeper", "Stroke & Turn Judge", "Starter", "Admin / Results",
  "Hospitality", "Setup / Teardown", "Meet Director Assistant",
  "Deck Marshal", "Check-In", "Awards", "Announcer",
];

interface VolunteerForm { name: string; email: string; phone: string; roles: string[]; notes: string; }
const BLANK_V: VolunteerForm = { name: "", email: "", phone: "", roles: [], notes: "" };

interface ShiftForm {
  volunteerId: string; meetId: string; role: string;
  date: string; startTime: string; endTime: string;
}
const BLANK_SHIFT: ShiftForm = {
  volunteerId: "", meetId: "", role: "", date: format(new Date(), "yyyy-MM-dd"), startTime: "", endTime: "",
};

export default function VolunteersPage() {
  const [activeVolunteer, setActiveVolunteer] = useState<Volunteer | null>(null);
  const [vDialog, setVDialog] = useState(false);
  const [editVId, setEditVId] = useState<number | null>(null);
  const [vForm, setVForm] = useState<VolunteerForm>(BLANK_V);
  const [shiftDialog, setShiftDialog] = useState(false);
  const [shiftForm, setShiftForm] = useState<ShiftForm>(BLANK_SHIFT);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const { data: volunteers = [] } = useListVolunteers();
  const { data: allShifts = [] } = useListVolunteerShifts();
  const { data: shifts = [] } = useListVolunteerShifts(activeVolunteer?.id);
  const { data: meets = [] } = useListMeets();
  const createV = useCreateVolunteer();
  const updateV = useUpdateVolunteer();
  const deleteV = useDeleteVolunteer();
  const createShift = useCreateVolunteerShift();
  const updateShift = useUpdateVolunteerShift();
  const deleteShift = useDeleteVolunteerShift();

  const filtered = volunteers.filter(v => v.name.toLowerCase().includes(search.toLowerCase()) || (v.email ?? "").toLowerCase().includes(search.toLowerCase()));

  function openAdd() { setEditVId(null); setVForm(BLANK_V); setVDialog(true); }
  function openEdit(v: Volunteer) {
    setEditVId(v.id);
    setVForm({ name: v.name, email: v.email ?? "", phone: v.phone ?? "", roles: v.roles ?? [], notes: v.notes ?? "" });
    setVDialog(true);
  }

  function submitV() {
    if (!vForm.name) { toast({ title: "Name is required", variant: "destructive" }); return; }
    const payload = { name: vForm.name, email: vForm.email || undefined, phone: vForm.phone || undefined, roles: vForm.roles, notes: vForm.notes || undefined };
    if (editVId) {
      updateV.mutate({ id: editVId, data: payload }, { onSuccess: () => { setVDialog(false); toast({ title: "Volunteer updated" }); } });
    } else {
      createV.mutate({ data: payload }, { onSuccess: () => { setVDialog(false); toast({ title: "Volunteer added" }); } });
    }
  }

  function toggleRole(r: string) {
    setVForm(f => ({ ...f, roles: f.roles.includes(r) ? f.roles.filter(x => x !== r) : [...f.roles, r] }));
  }

  function submitShift() {
    const vol = activeVolunteer;
    if (!vol || !shiftForm.role || !shiftForm.date) { toast({ title: "Role and date are required", variant: "destructive" }); return; }
    createShift.mutate({
      data: {
        volunteerId: vol.id,
        meetId: shiftForm.meetId ? parseInt(shiftForm.meetId) : undefined,
        role: shiftForm.role, date: shiftForm.date,
        startTime: shiftForm.startTime || undefined, endTime: shiftForm.endTime || undefined,
        confirmed: false, reminderSent: false,
      },
    }, { onSuccess: () => { setShiftDialog(false); setShiftForm(BLANK_SHIFT); toast({ title: "Shift added" }); } });
  }

  const totalShifts = allShifts.length;
  const confirmedShifts = allShifts.filter((s: any) => s.confirmed).length;
  const totalHours = allShifts.reduce((s: number, sh: any) => s + (sh.hours ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Volunteer Management</h1>
          <p className="text-muted-foreground text-sm">Manage volunteer rosters, shifts, and meet assignments</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add Volunteer</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <UserCheck className="h-5 w-5 text-blue-600" />
          </div>
          <div><div className="text-2xl font-black">{volunteers.length}</div><div className="text-xs text-muted-foreground">Volunteers</div></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          </div>
          <div><div className="text-2xl font-black">{confirmedShifts}/{totalShifts}</div><div className="text-xs text-muted-foreground">Shifts Confirmed</div></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Clock className="h-5 w-5 text-amber-600" />
          </div>
          <div><div className="text-2xl font-black">{totalHours}</div><div className="text-xs text-muted-foreground">Total Hours Logged</div></div>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Volunteer list */}
        <div className="space-y-3">
          <Input placeholder="Search volunteers…" value={search} onChange={e => setSearch(e.target.value)} className="h-8 text-sm" />
          {filtered.length === 0 && (
            <Card className="border-dashed"><CardContent className="py-8 text-center text-muted-foreground text-sm">No volunteers yet.</CardContent></Card>
          )}
          {filtered.map((v) => {
            const vs = allShifts.filter((s: any) => s.volunteerId === v.id);
            return (
              <Card key={v.id}
                className={cn("cursor-pointer hover:shadow-md transition-all", activeVolunteer?.id === v.id ? "ring-2 ring-primary" : "")}
                onClick={() => setActiveVolunteer(v)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold">{v.name}</div>
                      <div className="text-xs text-muted-foreground">{v.email || "No email"}</div>
                    </div>
                    <Badge variant="secondary" className="text-xs">{vs.length} shifts</Badge>
                  </div>
                  {v.roles?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {v.roles.slice(0, 3).map(r => <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>)}
                      {v.roles.length > 3 && <Badge variant="outline" className="text-[10px]">+{v.roles.length - 3}</Badge>}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Volunteer detail */}
        {activeVolunteer ? (
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">{activeVolunteer.name}</h2>
                <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                  {activeVolunteer.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{activeVolunteer.email}</span>}
                  {activeVolunteer.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{activeVolunteer.phone}</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(activeVolunteer)}><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>
                <Button size="sm" variant="destructive" onClick={() => {
                  deleteV.mutate({ id: activeVolunteer.id }, { onSuccess: () => { setActiveVolunteer(null); toast({ title: "Removed" }); } });
                }}><Trash2 className="h-3.5 w-3.5 mr-1" />Delete</Button>
              </div>
            </div>

            {activeVolunteer.roles?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {activeVolunteer.roles.map(r => <Badge key={r} variant="secondary">{r}</Badge>)}
              </div>
            )}

            <Tabs defaultValue="shifts">
              <TabsList>
                <TabsTrigger value="shifts"><CalendarDays className="h-3.5 w-3.5 mr-1" />Shifts ({shifts.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="shifts" className="mt-4 space-y-3">
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => { setShiftForm(BLANK_SHIFT); setShiftDialog(true); }}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Add Shift
                  </Button>
                </div>
                {shifts.length === 0 ? (
                  <Card className="border-dashed"><CardContent className="py-8 text-center text-muted-foreground text-sm">No shifts scheduled.</CardContent></Card>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Meet</TableHead>
                        <TableHead className="text-center">Confirmed</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shifts.map((s: any) => {
                        const meet = s.meetId ? meets.find((m: any) => m.id === s.meetId) : null;
                        return (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium">{s.date}</TableCell>
                            <TableCell className="text-sm">{s.role}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {s.startTime && s.endTime ? `${s.startTime}–${s.endTime}` : s.startTime ?? "—"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{meet?.name ?? "—"}</TableCell>
                            <TableCell className="text-center">
                              <button onClick={() => updateShift.mutate({ id: s.id, data: { confirmed: !s.confirmed } })}>
                                {s.confirmed
                                  ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                                  : <XCircle className="h-4 w-4 text-slate-400 mx-auto" />}
                              </button>
                            </TableCell>
                            <TableCell>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                                onClick={() => deleteShift.mutate({ id: s.id }, { onSuccess: () => toast({ title: "Shift removed" }) })}>
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
            </Tabs>
          </div>
        ) : (
          <div className="lg:col-span-2 flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl min-h-[300px]">
            <div className="text-center"><UserCheck className="h-10 w-10 mx-auto mb-2 opacity-20" /><p>Select a volunteer to view details</p></div>
          </div>
        )}
      </div>

      {/* Volunteer dialog */}
      <Dialog open={vDialog} onOpenChange={setVDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editVId ? "Edit Volunteer" : "Add Volunteer"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Full Name *</Label><Input value={vForm.name} onChange={e => setVForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Email</Label><Input type="email" value={vForm.email} onChange={e => setVForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Phone</Label><Input type="tel" value={vForm.phone} onChange={e => setVForm(f => ({ ...f, phone: e.target.value }))} /></div>
            </div>
            <div className="space-y-1">
              <Label>Roles / Certifications</Label>
              <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto border rounded-md p-2">
                {ALL_ROLES.map(r => (
                  <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={vForm.roles.includes(r)} onCheckedChange={() => toggleRole(r)} />
                    {r}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1"><Label>Notes</Label><Input value={vForm.notes} onChange={e => setVForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVDialog(false)}>Cancel</Button>
            <Button onClick={submitV}>{editVId ? "Update" : "Add Volunteer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shift dialog */}
      <Dialog open={shiftDialog} onOpenChange={setShiftDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Shift — {activeVolunteer?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Role *</Label>
              <Select value={shiftForm.role} onValueChange={v => setShiftForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue placeholder="Choose role…" /></SelectTrigger>
                <SelectContent>{ALL_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Date *</Label><Input type="date" value={shiftForm.date} onChange={e => setShiftForm(f => ({ ...f, date: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Meet (optional)</Label>
                <Select value={shiftForm.meetId} onValueChange={v => setShiftForm(f => ({ ...f, meetId: v }))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {meets.map((m: any) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Start Time</Label><Input type="time" value={shiftForm.startTime} onChange={e => setShiftForm(f => ({ ...f, startTime: e.target.value }))} /></div>
              <div className="space-y-1"><Label>End Time</Label><Input type="time" value={shiftForm.endTime} onChange={e => setShiftForm(f => ({ ...f, endTime: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShiftDialog(false)}>Cancel</Button>
            <Button onClick={submitShift}>Add Shift</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
