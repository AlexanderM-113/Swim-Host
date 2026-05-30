import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Shield, Phone, Mail, Users } from "lucide-react";

const ROLES = [
  "Meet Director",
  "Referee",
  "Starter",
  "Administrative Referee",
  "Chief Finish Judge",
  "Stroke & Turn Judge",
  "Timer",
  "Clerk of Course",
  "Announcer",
  "Recorder / Scorekeeper",
  "Entry Coordinator",
  "Computer Operator",
];

const CERTIFICATIONS = [
  "USA Swimming Senior", "USA Swimming Junior", "YMCA Level 1", "YMCA Level 2",
  "NISCA", "NFHS", "High School", "Club Level", "Other",
];

interface OfficialForm {
  name: string; role: string; lscId: string; certification: string;
  phone: string; email: string; assignedLanes: string; sessionNumber: string; notes: string;
}

const BLANK: OfficialForm = {
  name: "", role: "Referee", lscId: "", certification: "", phone: "", email: "", assignedLanes: "", sessionNumber: "", notes: "",
};

function fetchOfficials(meetId: number) {
  return fetch(`/api/meets/${meetId}/officials`).then(r => r.json());
}

export default function MeetOfficials({ meetId }: { meetId: number }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<OfficialForm>(BLANK);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: officials = [], isLoading } = useQuery({
    queryKey: ["officials", meetId],
    queryFn: () => fetchOfficials(meetId),
    enabled: !!meetId,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => fetch(`/api/meets/${meetId}/officials`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
    }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["officials", meetId] }); setDialogOpen(false); toast({ title: "Official added" }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => fetch(`/api/officials/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
    }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["officials", meetId] }); setDialogOpen(false); toast({ title: "Official updated" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/officials/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["officials", meetId] }); toast({ title: "Official removed" }); },
  });

  function openAdd() { setEditId(null); setForm(BLANK); setDialogOpen(true); }
  function openEdit(o: any) {
    setEditId(o.id);
    setForm({
      name: o.name, role: o.role, lscId: o.lscId || "", certification: o.certification || "",
      phone: o.phone || "", email: o.email || "", assignedLanes: o.assignedLanes || "",
      sessionNumber: o.sessionNumber ? String(o.sessionNumber) : "", notes: o.notes || "",
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    const payload = {
      ...form,
      sessionNumber: form.sessionNumber ? parseInt(form.sessionNumber) : null,
    };
    if (editId) updateMutation.mutate({ id: editId, data: payload });
    else createMutation.mutate(payload);
  }

  const grouped = ROLES.reduce((acc, role) => {
    const in_role = (officials as any[]).filter(o => o.role === role);
    if (in_role.length > 0) acc[role] = in_role;
    return acc;
  }, {} as Record<string, any[]>);

  const ungrouped = (officials as any[]).filter(o => !ROLES.includes(o.role));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Officials</h2>
          <Badge variant="secondary">{(officials as any[]).length} assigned</Badge>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add Official</Button>
      </div>

      {isLoading && <div className="py-8 text-center text-muted-foreground">Loading officials...</div>}

      {!isLoading && (officials as any[]).length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Shield className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No officials assigned yet.</p>
            <p className="text-xs mt-1">Add officials to track assignments by role and session.</p>
          </CardContent>
        </Card>
      )}

      {Object.entries(grouped).map(([role, officials_in_role]) => (
        <Card key={role}>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" /> {role}
            </CardTitle>
            <Badge variant="outline" className="text-xs">{officials_in_role.length}</Badge>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Certification</TableHead>
                  <TableHead>LSC ID</TableHead>
                  <TableHead>Lanes / Session</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(officials_in_role as any[]).map((o: any) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-semibold">{o.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{o.certification || "—"}</TableCell>
                    <TableCell className="font-mono text-sm">{o.lscId || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {o.assignedLanes ? `Lanes ${o.assignedLanes}` : ""}
                      {o.sessionNumber ? ` · Session ${o.sessionNumber}` : ""}
                      {!o.assignedLanes && !o.sessionNumber ? "—" : ""}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex flex-col gap-0.5">
                        {o.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{o.phone}</span>}
                        {o.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{o.email}</span>}
                        {!o.phone && !o.email && "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(o)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(o.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {ungrouped.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Other</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableBody>
                {ungrouped.map((o: any) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-semibold">{o.name}</TableCell>
                    <TableCell>{o.role}</TableCell>
                    <TableCell>{o.certification || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(o)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(o.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? "Edit Official" : "Add Official"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label>Full Name *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="First Last" />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Certification Level</Label>
                <Select value={form.certification} onValueChange={v => setForm(f => ({ ...f, certification: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{CERTIFICATIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>LSC / Membership ID</Label>
                <Input value={form.lscId} onChange={e => setForm(f => ({ ...f, lscId: e.target.value }))} placeholder="e.g. CO-12345" />
              </div>
              <div className="space-y-1">
                <Label>Assigned Lanes (timers)</Label>
                <Input value={form.assignedLanes} onChange={e => setForm(f => ({ ...f, assignedLanes: e.target.value }))} placeholder="e.g. 1-2-3" />
              </div>
              <div className="space-y-1">
                <Label>Session Number</Label>
                <Input type="number" value={form.sessionNumber} onChange={e => setForm(f => ({ ...f, sessionNumber: e.target.value }))} placeholder="e.g. 1" />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Notes</Label>
                <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>{editId ? "Update" : "Add Official"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
