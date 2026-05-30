import { useState } from "react";
import {
  useListSessions, useListEvents, useCreateSession, useUpdateSession, useDeleteSession,
  useUpdateEvent, getListSessionsQueryKey, getListEventsQueryKey, type Session,
} from "@/lib/local-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus, Pencil, Trash2, Clock, Calendar, Layers, ChevronDown, ChevronRight,
  Users, MoveRight, GripVertical,
} from "lucide-react";
import { format } from "date-fns";

const SESSION_TYPES = ["Prelims", "Finals", "Timed Finals", "Combined Finals", "Mixed", "Warm-Up/Scratch"];

const TYPE_COLORS: Record<string, string> = {
  "Prelims":          "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200",
  "Finals":           "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200",
  "Timed Finals":     "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200",
  "Combined Finals":  "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200",
  "Mixed":            "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200",
  "Warm-Up/Scratch":  "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200",
};

interface SessionFormData {
  sessionNumber: number;
  name: string;
  sessionType: string;
  date: string;
  warmupTime: string;
  startTime: string;
  notes: string;
}

const BLANK_FORM: SessionFormData = {
  sessionNumber: 1,
  name: "",
  sessionType: "Timed Finals",
  date: "",
  warmupTime: "",
  startTime: "",
  notes: "",
};

function fmtGender(g: string) {
  return g === "M" ? "Men" : g === "F" ? "Women" : "Mixed";
}

function SessionDialog({
  open,
  onOpenChange,
  initial,
  meetId,
  nextNumber,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: SessionFormData;
  meetId: number;
  nextNumber: number;
  onSave: (data: SessionFormData) => void;
}) {
  const [form, setForm] = useState<SessionFormData>(
    initial ?? { ...BLANK_FORM, sessionNumber: nextNumber }
  );

  function set(k: keyof SessionFormData, v: string | number) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Session" : "Add Session"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Session #</Label>
              <Input
                type="number" min={1} max={99}
                value={form.sessionNumber}
                onChange={(e) => set("sessionNumber", parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Session Type</Label>
              <Select value={form.sessionType} onValueChange={(v) => set("sessionType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SESSION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Session Name <span className="text-red-500">*</span></Label>
            <Input
              placeholder="e.g. Morning Prelims, Championship Finals"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Warm-up Time</Label>
              <Input type="time" value={form.warmupTime} onChange={(e) => set("warmupTime", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Start Time</Label>
              <Input type="time" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              rows={2}
              placeholder="Warm-up lanes, special instructions…"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!form.name.trim()}>
              {initial ? "Save Changes" : "Create Session"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EventAssignDialog({
  open,
  onOpenChange,
  sessions,
  meetId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sessions: Session[];
  meetId: number;
}) {
  const { data: events = [] } = useListEvents(meetId);
  const updateEvent = useUpdateEvent();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  async function assign(eventId: number, sessionId: string) {
    const sid = sessionId === "none" ? undefined : parseInt(sessionId);
    await updateEvent.mutateAsync(
      { id: eventId, data: { sessionId: sid } },
    );
    queryClient.invalidateQueries({ queryKey: getListEventsQueryKey(meetId) });
    queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey(meetId) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Events to Sessions</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 pt-2">
          {events.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No events yet. Add events in the Events tab first.</p>
          )}
          {events.map((ev) => {
            const assigned = sessions.find((s) => s.id === (ev as any).sessionId);
            return (
              <div key={ev.id} className="flex items-center gap-3 p-2 rounded-md border bg-card">
                <div className="w-12 text-center">
                  <span className="text-xs font-mono font-bold text-primary">#{ev.eventNumber}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">
                    {fmtGender(ev.gender)} {ev.ageGroup || "Open"} {ev.distance} {ev.stroke}
                  </span>
                </div>
                <div className="w-52">
                  <Select
                    value={String((ev as any).sessionId ?? "none")}
                    onValueChange={(v) => assign(ev.id, v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="No session" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— No session —</SelectItem>
                      {sessions.sort((a, b) => (a.sessionNumber ?? 0) - (b.sessionNumber ?? 0)).map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          Session {s.sessionNumber}: {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SessionCard({
  session,
  events,
  meetId,
  onEdit,
}: {
  session: Session;
  events: any[];
  meetId: number;
  onEdit: (s: Session) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const deleteSession = useDeleteSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sessionEvents = events.filter((e) => (e as any).sessionId === session.id)
    .sort((a, b) => a.eventNumber - b.eventNumber);

  const typeColor = TYPE_COLORS[session.sessionType ?? ""] ?? "bg-slate-100 text-slate-800 border-slate-200";

  async function handleDelete() {
    await deleteSession.mutateAsync({ id: session.id });
    queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey(meetId) });
    toast({ title: "Session deleted" });
  }

  return (
    <Card className="overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/30 shrink-0" />
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
          {session.sessionNumber ?? "—"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{session.name}</span>
            {session.sessionType && (
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${typeColor}`}>
                {session.sessionType}
              </Badge>
            )}
            <Badge variant="secondary" className="text-[10px]">
              {sessionEvents.length} event{sessionEvents.length !== 1 ? "s" : ""}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
            {session.date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(session.date + "T00:00:00"), "MMM d, yyyy")}
              </span>
            )}
            {session.warmupTime && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Warm-up {session.warmupTime}
              </span>
            )}
            {session.startTime && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-primary" />
                Start {session.startTime}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost" size="icon" className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); onEdit(session); }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={(e) => e.stopPropagation()}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Session</AlertDialogTitle>
                <AlertDialogDescription>
                  Delete "{session.name}"? Events assigned to this session will become unassigned.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" /> : <ChevronRight className="h-4 w-4 text-muted-foreground ml-1" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t">
          {session.notes && (
            <div className="px-4 py-2 text-xs text-muted-foreground italic bg-muted/20 border-b">
              {session.notes}
            </div>
          )}
          {sessionEvents.length === 0 ? (
            <div className="px-4 py-4 text-sm text-muted-foreground text-center">
              No events assigned to this session yet.
            </div>
          ) : (
            <div className="divide-y">
              {sessionEvents.map((ev) => (
                <div key={ev.id} className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted/20">
                  <span className="font-mono font-bold text-primary w-8 text-right">{ev.eventNumber}</span>
                  <MoveRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">
                    {fmtGender(ev.gender)} {ev.ageGroup || "Open"} {ev.distance} {ev.stroke}
                  </span>
                  {ev.isRelay && <Badge variant="outline" className="text-[10px] px-1 py-0">Relay</Badge>}
                  <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{ev.entryCount ?? 0} entries</span>
                    <Badge variant={ev.status === "seeded" ? "default" : ev.status === "completed" ? "secondary" : "outline"} className="text-[10px]">
                      {ev.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function MeetSessions({ meetId }: { meetId: number }) {
  const { data: sessions = [], isLoading } = useListSessions(meetId);
  const { data: events = [] } = useListEvents(meetId);
  const createSession = useCreateSession();
  const updateSession = useUpdateSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [editSession, setEditSession] = useState<Session | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);

  const sorted = [...sessions].sort((a, b) => ((a as any).sessionNumber ?? 0) - ((b as any).sessionNumber ?? 0));
  const nextNumber = sorted.length > 0 ? Math.max(...sorted.map((s) => (s as any).sessionNumber ?? 0)) + 1 : 1;
  const unassignedCount = events.filter((e) => !(e as any).sessionId).length;

  async function handleCreate(data: SessionFormData) {
    await createSession.mutateAsync({
      data: {
        meetId,
        sessionNumber: data.sessionNumber,
        name: data.name,
        sessionType: data.sessionType,
        date: data.date || undefined,
        warmupTime: data.warmupTime || undefined,
        startTime: data.startTime || undefined,
        notes: data.notes || undefined,
      } as any,
    });
    queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey(meetId) });
    toast({ title: "Session created", description: data.name });
  }

  async function handleEdit(data: SessionFormData) {
    if (!editSession) return;
    await updateSession.mutateAsync({
      id: editSession.id,
      data: {
        sessionNumber: data.sessionNumber,
        name: data.name,
        sessionType: data.sessionType,
        date: data.date || undefined,
        warmupTime: data.warmupTime || undefined,
        startTime: data.startTime || undefined,
        notes: data.notes || undefined,
      } as any,
    });
    queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey(meetId) });
    toast({ title: "Session updated" });
    setEditSession(null);
  }

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Loading sessions…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Meet Sessions</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Organize events into sessions — Prelims, Finals, Timed Finals, etc.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {events.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setAssignOpen(true)}>
              <Layers className="h-4 w-4 mr-2" />
              Assign Events
              {unassignedCount > 0 && (
                <Badge variant="destructive" className="ml-2 text-[10px] px-1.5">{unassignedCount}</Badge>
              )}
            </Button>
          )}
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Session
          </Button>
        </div>
      </div>

      {/* Quick stats */}
      {sorted.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border bg-card p-3 text-center">
            <div className="text-2xl font-bold text-primary">{sorted.length}</div>
            <div className="text-xs text-muted-foreground">Sessions</div>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <div className="text-2xl font-bold text-primary">{events.length - unassignedCount}</div>
            <div className="text-xs text-muted-foreground">Assigned Events</div>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <div className={`text-2xl font-bold ${unassignedCount > 0 ? "text-amber-500" : "text-green-600"}`}>
              {unassignedCount}
            </div>
            <div className="text-xs text-muted-foreground">Unassigned Events</div>
          </div>
        </div>
      )}

      {/* Session list */}
      {sorted.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Layers className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="font-semibold text-lg">No sessions yet</h3>
            <p className="text-muted-foreground text-sm mt-1 mb-4">
              Add sessions to organize your meet — Prelims in the morning, Finals in the afternoon.
            </p>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Session
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              events={events}
              meetId={meetId}
              onEdit={(s) => setEditSession(s)}
            />
          ))}
        </div>
      )}

      {/* Unassigned events reminder */}
      {sorted.length > 0 && unassignedCount > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-900/10">
          <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              <strong>{unassignedCount}</strong> event{unassignedCount !== 1 ? "s" : ""} not yet assigned to a session.
            </p>
            <Button size="sm" variant="outline" className="border-amber-300 shrink-0" onClick={() => setAssignOpen(true)}>
              Assign Now
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <SessionDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        meetId={meetId}
        nextNumber={nextNumber}
        onSave={handleCreate}
      />
      {editSession && (
        <SessionDialog
          key={editSession.id}
          open={!!editSession}
          onOpenChange={(v) => { if (!v) setEditSession(null); }}
          initial={{
            sessionNumber: (editSession as any).sessionNumber ?? 1,
            name: editSession.name,
            sessionType: (editSession as any).sessionType ?? "Timed Finals",
            date: editSession.date ?? "",
            warmupTime: editSession.warmupTime ?? "",
            startTime: editSession.startTime ?? "",
            notes: editSession.notes ?? "",
          }}
          meetId={meetId}
          nextNumber={nextNumber}
          onSave={handleEdit}
        />
      )}
      <EventAssignDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        sessions={sorted}
        meetId={meetId}
      />
    </div>
  );
}
