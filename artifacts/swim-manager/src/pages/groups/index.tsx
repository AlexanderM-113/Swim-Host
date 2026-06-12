import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useListAthletes, useListTeams,
  useListGroups, useCreateGroup, useUpdateGroup, useDeleteGroup,
  useListGroupMembers, useAddGroupMember, useRemoveGroupMember,
  useListAttendance, useBulkAttendance,
} from "@/lib/local-store";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus, Users, Pencil, Trash2, UserPlus, UserMinus,
  ChevronRight, ClipboardList, CheckCircle2, XCircle, BarChart2
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
  practiceSchedule: "", color: "#3B82F6", teamId: "none",
};

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
  const { data: groups = [], isLoading } = useListGroups();
  const { data: members = [] } = useListGroupMembers(activeGroup?.id);
  const { data: attendanceData = [] } = useListAttendance(activeGroup?.id, attendanceDate);

  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();
  const addMember = useAddGroupMember();
  const removeMember = useRemoveGroupMember();
  const bulkAttendance = useBulkAttendance();

  useEffect(() => {
    const map: Record<number, boolean> = {};
    attendanceData.forEach((r: any) => { map[r.athleteId] = r.present; });
    setAttendanceMap(map);
  }, [attendanceData, attendanceDate, activeGroup?.id]);

  function openAdd() { setEditGroupId(null); setGroupForm(BLANK_GROUP); setGroupDialog(true); }
  function openEdit(g: any) {
    setEditGroupId(g.id);
    setGroupForm({
      name: g.name, description: g.description || "", coachName: g.coachName || "",
      level: g.level || "Age Group A", practiceSchedule: g.practiceSchedule || "",
      color: g.color || "#3B82F6", teamId: g.teamId ? String(g.teamId) : "none",
    });
    setGroupDialog(true);
  }

  function submitGroup() {
    const payload = {
      name: groupForm.name,
      description: groupForm.description,
      coachName: groupForm.coachName,
      level: groupForm.level,
      practiceSchedule: groupForm.practiceSchedule,
      color: groupForm.color,
      teamId: groupForm.teamId && groupForm.teamId !== "none" ? parseInt(groupForm.teamId) : null,
    };
    if (!payload.name.trim()) {
      toast({ title: "Group name is required", variant: "destructive" }); return;
    }
    if (editGroupId) {
      updateGroup.mutate({ id: editGroupId, data: payload }, {
        onSuccess: () => { setGroupDialog(false); toast({ title: "Group updated" }); },
        onError: (e: any) => toast({ title: "Failed to update group", description: e?.message, variant: "destructive" }),
      });
    } else {
      createGroup.mutate({ data: payload }, {
        onSuccess: () => { setGroupDialog(false); toast({ title: "Group created" }); },
        onError: (e: any) => toast({ title: "Failed to create group", description: e?.message, variant: "destructive" }),
      });
    }
  }

  function handleDeleteGroup(id: number) {
    deleteGroup.mutate({ id }, {
      onSuccess: () => { setActiveGroup(null); toast({ title: "Group deleted" }); },
    });
  }

  function handleAddMember() {
    if (!addMemberAthleteId || !activeGroup) return;
    addMember.mutate({
      groupId: activeGroup.id,
      athleteId: parseInt(addMemberAthleteId),
      joinedDate: format(new Date(), "yyyy-MM-dd"),
    }, {
      onSuccess: () => { setAddMemberOpen(false); setAddMemberAthleteId(""); toast({ title: "Athlete added to group" }); },
    });
  }

  function handleRemoveMember(athleteId: number) {
    if (!activeGroup) return;
    removeMember.mutate({ groupId: activeGroup.id, athleteId }, {
      onSuccess: () => toast({ title: "Athlete removed from group" }),
    });
  }

  function saveAttendance() {
    if (!activeGroup) return;
    const records = (members as any[]).map((m: any) => ({
      athleteId: m.athleteId,
      present: attendanceMap[m.athleteId] ?? false,
    }));
    bulkAttendance.mutate({ groupId: activeGroup.id, date: attendanceDate, records }, {
      onSuccess: () => toast({ title: "Attendance saved" }),
    });
  }

  const memberIds = new Set((members as any[]).map((m: any) => m.athleteId));
  const nonMembers = (athletes as any[]).filter((a) => !memberIds.has(a.id));

  const presentCount = Object.values(attendanceMap).filter(Boolean).length;
  const absentCount = (members as any[]).length - presentCount;

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
        {/* Group list */}
        <div className="space-y-3">
          {isLoading && <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Loading groups…</CardContent></Card>}
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
              onClick={() => setActiveGroup(g)}
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

        {/* Group detail */}
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
                <Button size="sm" variant="destructive" onClick={() => handleDeleteGroup(activeGroup.id)}><Trash2 className="h-3.5 w-3.5 mr-1" />Delete</Button>
              </div>
            </div>

            <Tabs defaultValue="roster">
              <TabsList>
                <TabsTrigger value="roster"><Users className="h-3.5 w-3.5 mr-1" />Roster ({(members as any[]).length})</TabsTrigger>
                <TabsTrigger value="attendance"><ClipboardList className="h-3.5 w-3.5 mr-1" />Attendance</TabsTrigger>
                <TabsTrigger value="stats"><BarChart2 className="h-3.5 w-3.5 mr-1" />Analytics</TabsTrigger>
              </TabsList>

              <TabsContent value="roster" className="mt-4 space-y-3">
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => setAddMemberOpen(true)}><UserPlus className="h-3.5 w-3.5 mr-1" />Add Athlete</Button>
                </div>
                {(members as any[]).length === 0 ? (
                  <Card className="border-dashed"><CardContent className="py-8 text-center text-muted-foreground text-sm">No athletes in this group.</CardContent></Card>
                ) : (
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
                              onClick={() => handleRemoveMember(m.athleteId)}>
                              <UserMinus className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="attendance" className="mt-4 space-y-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <Label>Date</Label>
                  <Input type="date" value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)} className="w-44" />
                  <div className="flex gap-2 ml-auto">
                    <Badge variant="secondary" className="text-xs">{presentCount} present</Badge>
                    <Badge variant="outline" className="text-xs">{absentCount} absent</Badge>
                  </div>
                  <Button size="sm" onClick={saveAttendance} disabled={bulkAttendance.isPending}>
                    {bulkAttendance.isPending ? "Saving…" : "Save Attendance"}
                  </Button>
                </div>
                {(members as any[]).length === 0 ? (
                  <Card className="border-dashed"><CardContent className="py-8 text-center text-muted-foreground text-sm">No athletes in this group.</CardContent></Card>
                ) : (
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

              <TabsContent value="stats" className="mt-4">
                <AttendanceAnalytics groupId={activeGroup.id} members={members as any[]} />
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

      {/* Group dialog */}
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
                    <SelectItem value="none">Any team</SelectItem>
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
                      className={cn("h-7 w-7 rounded-full border-2 transition-all", groupForm.color === c ? "border-white scale-110 ring-2 ring-primary" : "border-transparent")}
                      style={{ background: c }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupDialog(false)}>Cancel</Button>
            <Button onClick={submitGroup} disabled={createGroup.isPending || updateGroup.isPending}>
              {editGroupId ? "Update" : "Create Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add member dialog */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Athlete to {activeGroup?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Select Athlete</Label>
            {nonMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground">All athletes are already in this group.</p>
            ) : (
              <Select value={addMemberAthleteId} onValueChange={setAddMemberAthleteId}>
                <SelectTrigger><SelectValue placeholder="Choose athlete..." /></SelectTrigger>
                <SelectContent>
                  {nonMembers.map((a: any) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.lastName}, {a.firstName} — {a.teamName || "No team"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberOpen(false)}>Cancel</Button>
            <Button onClick={handleAddMember} disabled={!addMemberAthleteId || nonMembers.length === 0}>Add to Group</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AttendanceAnalytics({ groupId, members }: { groupId: number; members: any[] }) {
  const { data: allAttendance = [] } = useListAttendance(groupId);

  const stats = members.map((m) => {
    const records = (allAttendance as any[]).filter((a: any) => a.athleteId === m.athleteId);
    const present = records.filter((r: any) => r.present).length;
    const total = records.length;
    const pct = total > 0 ? Math.round((present / total) * 100) : null;
    return { ...m, present, total, pct };
  }).sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));

  const totalSessions = new Set((allAttendance as any[]).map((a: any) => a.date)).size;

  if (members.length === 0) {
    return <Card className="border-dashed"><CardContent className="py-8 text-center text-muted-foreground text-sm">No athletes in this group yet.</CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-primary">{totalSessions}</div><div className="text-xs text-muted-foreground mt-1">Sessions Tracked</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-green-600">{stats.filter(s => (s.pct ?? 0) >= 80).length}</div><div className="text-xs text-muted-foreground mt-1">High Attendance</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-amber-600">{stats.filter(s => s.pct !== null && s.pct < 60).length}</div><div className="text-xs text-muted-foreground mt-1">At Risk</div></CardContent></Card>
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Attendance by Athlete</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Athlete</TableHead>
                <TableHead className="text-center">Sessions</TableHead>
                <TableHead className="text-center">Present</TableHead>
                <TableHead className="text-right pr-4">Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.map((s) => (
                <TableRow key={s.athleteId}>
                  <TableCell className="pl-4 font-medium">{s.lastName}, {s.firstName}</TableCell>
                  <TableCell className="text-center text-muted-foreground text-sm">{s.total}</TableCell>
                  <TableCell className="text-center text-muted-foreground text-sm">{s.present}</TableCell>
                  <TableCell className="text-right pr-4">
                    {s.pct !== null ? (
                      <span className={cn("font-bold text-sm", s.pct >= 80 ? "text-green-600" : s.pct >= 60 ? "text-amber-600" : "text-red-600")}>
                        {s.pct}%
                      </span>
                    ) : <span className="text-muted-foreground text-sm">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
