import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useListAthletes, useListTeams } from "@/lib/local-store";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Users, Pencil, Trash2, UserPlus, UserMinus,
  ChevronRight, ClipboardList, CheckCircle2, XCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const LEVELS = ["Elite", "Senior", "Junior", "Age Group A", "Age Group B", "Developmental", "Recreational"];
const GROUP_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"];

interface GroupForm {
  name: string; description: string; coachName: string;
  level: string; practiceSchedule: string; color: string; teamId: string;
}
const BLANK_GROUP: GroupForm = {
  name: "", description: "", coachName: "", level: "Age Group A",
  practiceSchedule: "", color: "#3B82F6", teamId: "",
};

function fetchGroups() { return fetch("/api/groups").then(r => r.json()); }
function fetchMembers(id: number) { return fetch(`/api/groups/${id}/members`).then(r => r.json()); }
function fetchAttendance(params: Record<string, string>) {
  const q = new URLSearchParams(params).toString();
  return fetch(`/api/attendance${q ? "?" + q : ""}`).then(r => r.json());
}

export default function GroupsPage() {
  const [activeGroup, setActiveGroup] = useState<any | null>(null);
  const [groupDialog, setGroupDialog] = useState(false);
  const [editGroupId, setEditGroupId] = useState<number | null>(null);
  const [groupForm, setGroupForm] = useState<GroupForm>(BLANK_GROUP);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addMemberAthleteId, setAddMemberAthleteId] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [attendanceMap, setAttendanceMap] = useState<Record<number, boolean>>({});
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: athletes = [] } = useListAthletes();
  const { data: teams = [] } = useListTeams();

  const { data: groups = [], isLoading } = useQuery({ queryKey: ["groups"], queryFn: fetchGroups });

  const { data: members = [] } = useQuery({
    queryKey: ["group-members", activeGroup?.id],
    queryFn: () => fetchMembers(activeGroup.id),
    enabled: !!activeGroup,
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance", { groupId: activeGroup?.id, date: attendanceDate }],
    queryFn: () => fetchAttendance({ groupId: String(activeGroup.id), date: attendanceDate }),
    enabled: !!activeGroup,
    select: (data: any[]) => {
      const map: Record<number, boolean> = {};
      data.forEach(r => { map[r.athleteId] = r.present; });
      return map;
    },
  });

  const createGroup = useMutation({
    mutationFn: (data: any) => fetch("/api/groups", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
    }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["groups"] }); setGroupDialog(false); toast({ title: "Group created" }); },
  });

  const updateGroup = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => fetch(`/api/groups/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
    }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["groups"] }); setGroupDialog(false); toast({ title: "Group updated" }); },
  });

  const deleteGroup = useMutation({
    mutationFn: (id: number) => fetch(`/api/groups/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["groups"] }); setActiveGroup(null); toast({ title: "Group deleted" }); },
  });

  const addMember = useMutation({
    mutationFn: ({ groupId, athleteId }: { groupId: number; athleteId: number }) =>
      fetch(`/api/groups/${groupId}/members`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId, joinedDate: format(new Date(), "yyyy-MM-dd") })
      }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["group-members"] }); qc.invalidateQueries({ queryKey: ["groups"] }); setAddMemberOpen(false); toast({ title: "Athlete added to group" }); },
  });

  const removeMember = useMutation({
    mutationFn: ({ groupId, athleteId }: { groupId: number; athleteId: number }) =>
      fetch(`/api/groups/${groupId}/members/${athleteId}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["group-members"] }); qc.invalidateQueries({ queryKey: ["groups"] }); toast({ title: "Athlete removed" }); },
  });

  const submitAttendance = useMutation({
    mutationFn: () => fetch("/api/attendance/bulk", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: attendanceDate,
        groupId: activeGroup?.id,
        records: members.map((m: any) => ({ athleteId: m.athleteId, present: attendanceMap[m.athleteId] ?? false })),
      }),
    }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["attendance"] }); toast({ title: "Attendance saved" }); },
  });

  function openAdd() { setEditGroupId(null); setGroupForm(BLANK_GROUP); setGroupDialog(true); }
  function openEdit(g: any) {
    setEditGroupId(g.id);
    setGroupForm({
      name: g.name, description: g.description || "", coachName: g.coachName || "",
      level: g.level || "Age Group A", practiceSchedule: g.practiceSchedule || "",
      color: g.color || "#3B82F6", teamId: g.teamId ? String(g.teamId) : "",
    });
    setGroupDialog(true);
  }
  function submitGroup() {
    const payload = { ...groupForm, teamId: groupForm.teamId ? parseInt(groupForm.teamId) : null };
    if (editGroupId) updateGroup.mutate({ id: editGroupId, data: payload });
    else createGroup.mutate(payload);
  }

  function initAttendance() {
    const map: Record<number, boolean> = {};
    (members as any[]).forEach((m: any) => { map[m.athleteId] = attendance[m.athleteId] ?? false; });
    setAttendanceMap(map);
  }

  const nonMembers = (athletes as any[]).filter(a => !(members as any[]).some((m: any) => m.athleteId === a.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Training Groups</h1>
          <p className="text-muted-foreground text-sm">Manage practice groups, rosters, and attendance</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />New Group</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-3">
          {isLoading && <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Loading groups...</CardContent></Card>}
          {!isLoading && groups.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No groups yet. Create one to get started.
              </CardContent>
            </Card>
          )}
          {(groups as any[]).map((g: any) => (
            <Card key={g.id}
              className={cn("cursor-pointer transition-all border-l-4 hover:shadow-md", activeGroup?.id === g.id ? "ring-2 ring-primary" : "")}
              style={{ borderLeftColor: g.color || "#3B82F6" }}
              onClick={() => { setActiveGroup(g); initAttendance(); }}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold">{g.name}</div>
                    <div className="text-xs text-muted-foreground">{g.coachName ? `Coach: ${g.coachName}` : "No coach assigned"}</div>
                    {g.practiceSchedule && <div className="text-xs text-muted-foreground mt-0.5">{g.practiceSchedule}</div>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-xs">{g.memberCount ?? 0} athletes</Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                {g.level && <Badge variant="outline" className="mt-2 text-xs">{g.level}</Badge>}
              </CardContent>
            </Card>
          ))}
        </div>

        {activeGroup ? (
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full inline-block" style={{ background: activeGroup.color }} />
                  {activeGroup.name}
                </h2>
                {activeGroup.description && <p className="text-sm text-muted-foreground">{activeGroup.description}</p>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(activeGroup)}><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>
                <Button size="sm" variant="destructive" onClick={() => deleteGroup.mutate(activeGroup.id)}><Trash2 className="h-3.5 w-3.5 mr-1" />Delete</Button>
              </div>
            </div>

            <Tabs defaultValue="roster">
              <TabsList>
                <TabsTrigger value="roster"><Users className="h-3.5 w-3.5 mr-1" />Roster ({members.length})</TabsTrigger>
                <TabsTrigger value="attendance"><ClipboardList className="h-3.5 w-3.5 mr-1" />Attendance</TabsTrigger>
              </TabsList>

              <TabsContent value="roster" className="mt-4 space-y-3">
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => setAddMemberOpen(true)}><UserPlus className="h-3.5 w-3.5 mr-1" />Add Athlete</Button>
                </div>
                {members.length === 0 && (
                  <Card className="border-dashed"><CardContent className="py-8 text-center text-muted-foreground text-sm">No athletes in this group.</CardContent></Card>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Gender</TableHead>
                      <TableHead>Date of Birth</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(members as any[]).map((m: any) => (
                      <TableRow key={m.membershipId}>
                        <TableCell className="font-semibold">{m.lastName}, {m.firstName}</TableCell>
                        <TableCell>{m.gender}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{m.dateOfBirth || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{m.joinedDate || "—"}</TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                            onClick={() => removeMember.mutate({ groupId: activeGroup.id, athleteId: m.athleteId })}>
                            <UserMinus className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="attendance" className="mt-4 space-y-4">
                <div className="flex items-center gap-3">
                  <Label>Date</Label>
                  <Input type="date" value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)} className="w-44" />
                  <Button size="sm" onClick={() => submitAttendance.mutate()}>Save Attendance</Button>
                </div>
                {members.length === 0
                  ? <Card className="border-dashed"><CardContent className="py-8 text-center text-muted-foreground text-sm">No athletes in this group.</CardContent></Card>
                  : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Athlete</TableHead>
                          <TableHead>Present</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(members as any[]).map((m: any) => (
                          <TableRow key={m.membershipId}>
                            <TableCell className="font-semibold">{m.lastName}, {m.firstName}</TableCell>
                            <TableCell>
                              <button
                                onClick={() => setAttendanceMap(prev => ({ ...prev, [m.athleteId]: !prev[m.athleteId] }))}
                                className="flex items-center gap-2"
                              >
                                {attendanceMap[m.athleteId]
                                  ? <><CheckCircle2 className="h-5 w-5 text-green-500" /><span className="text-green-600 text-sm">Present</span></>
                                  : <><XCircle className="h-5 w-5 text-slate-400" /><span className="text-muted-foreground text-sm">Absent</span></>}
                              </button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="lg:col-span-2 flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl min-h-[300px]">
            <div className="text-center">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-20" />
              <p>Select a group to view details</p>
            </div>
          </div>
        )}
      </div>

      <Dialog open={groupDialog} onOpenChange={setGroupDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editGroupId ? "Edit Group" : "New Training Group"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label>Group Name *</Label>
                <Input value={groupForm.name} onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Senior A, Age Group 11-12" />
              </div>
              <div className="space-y-1">
                <Label>Level</Label>
                <Select value={groupForm.level} onValueChange={v => setGroupForm(f => ({ ...f, level: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Team</Label>
                <Select value={groupForm.teamId} onValueChange={v => setGroupForm(f => ({ ...f, teamId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Any team" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any team</SelectItem>
                    {(teams as any[]).map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Coach Name</Label>
                <Input value={groupForm.coachName} onChange={e => setGroupForm(f => ({ ...f, coachName: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Practice Schedule</Label>
                <Input value={groupForm.practiceSchedule} onChange={e => setGroupForm(f => ({ ...f, practiceSchedule: e.target.value }))} placeholder="M/W/F 6-8am" />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Description</Label>
                <Input value={groupForm.description} onChange={e => setGroupForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Color</Label>
                <div className="flex gap-2 flex-wrap">
                  {GROUP_COLORS.map(c => (
                    <button key={c} onClick={() => setGroupForm(f => ({ ...f, color: c }))}
                      className={cn("h-7 w-7 rounded-full border-2 transition-all", groupForm.color === c ? "border-white scale-110" : "border-transparent")}
                      style={{ background: c }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupDialog(false)}>Cancel</Button>
            <Button onClick={submitGroup}>{editGroupId ? "Update" : "Create Group"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Athlete to {activeGroup?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Select Athlete</Label>
            <Select value={addMemberAthleteId} onValueChange={setAddMemberAthleteId}>
              <SelectTrigger><SelectValue placeholder="Choose athlete..." /></SelectTrigger>
              <SelectContent>
                {nonMembers.map((a: any) => (
                  <SelectItem key={a.id} value={String(a.id)}>{a.lastName}, {a.firstName} — {a.teamName || "No team"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberOpen(false)}>Cancel</Button>
            <Button onClick={() => { if (addMemberAthleteId && activeGroup) addMember.mutate({ groupId: activeGroup.id, athleteId: parseInt(addMemberAthleteId) }); }}
              disabled={!addMemberAthleteId}>Add to Group</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
