import { useState, useMemo, useRef } from "react";
import {
  useListEvents, useListSessions, useCreateEvent, useUpdateEvent, useDeleteEvent,
  useGetMeet, getListEventsQueryKey, getListSessionsQueryKey,
  readStore, writeStore, nextId, type Event, type Session,
} from "@/lib/local-store";
import { parseEv3, summarizeEv3 } from "@/lib/ev3-import";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus, Pencil, Trash2, ChevronUp, ChevronDown, Layers, Zap, MoreHorizontal,
  GripVertical, Upload, Loader2,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const STROKES = ["Freestyle", "Backstroke", "Breaststroke", "Butterfly", "Individual Medley", "Freestyle Relay", "Medley Relay"];
const GENDERS = [{ value: "M", label: "Men" }, { value: "F", label: "Women" }, { value: "Mixed", label: "Mixed" }];
const HEAT_ORDERS = ["Slow-to-Fast", "Fast-to-Slow", "Seeded", "Circle Seeding"];
const EVENT_TYPES = ["Standard", "Prelims", "Finals", "Timed Finals", "Consolation Finals", "B-Finals"];

const AGE_GROUPS = [
  "8 & Under", "9-10", "11-12", "13-14", "15-16", "15-18", "Senior", "Open",
  "10 & Under", "11 & Over", "12 & Under", "13 & Over",
];

interface EventForm {
  eventNumber: number;
  gender: string;
  ageGroup: string;
  distance: number;
  stroke: string;
  course: string;
  eventType: string;
  heatOrder: string;
  isRelay: boolean;
  sessionId: string;
}

const BLANK_FORM: EventForm = {
  eventNumber: 1,
  gender: "M",
  ageGroup: "",
  distance: 50,
  stroke: "Freestyle",
  course: "",
  eventType: "Standard",
  heatOrder: "Slow-to-Fast",
  isRelay: false,
  sessionId: "none",
};

function EventDialog({
  open,
  onOpenChange,
  initial,
  sessions,
  onSave,
  isPending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: EventForm;
  sessions: any[];
  onSave: (data: EventForm) => void;
  isPending?: boolean;
}) {
  const [form, setForm] = useState<EventForm>(initial ?? BLANK_FORM);

  function set(k: keyof EventForm, v: any) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(form);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Event" : "Add Event"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Event #</Label>
              <Input
                type="number" min={1}
                value={form.eventNumber}
                onChange={(e) => set("eventNumber", parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Distance (m/yd)</Label>
              <Input
                type="number" min={25} step={25}
                value={form.distance}
                onChange={(e) => set("distance", parseInt(e.target.value) || 50)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Stroke</Label>
              <Select value={form.stroke} onValueChange={(v) => {
                set("stroke", v);
                if (v.includes("Relay")) set("isRelay", true);
                else if (!v.includes("Relay")) set("isRelay", false);
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STROKES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Age Group</Label>
              <Select value={form.ageGroup || "__custom"} onValueChange={(v) => {
                if (v !== "__custom") set("ageGroup", v === "Open" ? "" : v);
              }}>
                <SelectTrigger><SelectValue placeholder="Open / custom" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Open">Open</SelectItem>
                  {AGE_GROUPS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  <SelectItem value="__custom">Custom…</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Custom age group (optional)"
                value={form.ageGroup}
                onChange={(e) => set("ageGroup", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Session</Label>
              <Select value={form.sessionId} onValueChange={(v) => set("sessionId", v)}>
                <SelectTrigger><SelectValue placeholder="No session" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No session —</SelectItem>
                  {sessions.sort((a, b) => ((a.sessionNumber ?? 0) - (b.sessionNumber ?? 0))).map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.sessionNumber}: {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Event Type</Label>
              <Select value={form.eventType} onValueChange={(v) => set("eventType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Heat Order</Label>
              <Select value={form.heatOrder} onValueChange={(v) => set("heatOrder", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HEAT_ORDERS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="isRelay"
              checked={form.isRelay}
              onCheckedChange={(v) => set("isRelay", !!v)}
            />
            <Label htmlFor="isRelay" className="cursor-pointer">Relay event</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : initial ? "Save Changes" : "Add Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const TEMPLATE_PRESETS = [
  {
    name: "Standard Age Group",
    description: "Age groups × 5 strokes, girls then boys per event",
    generate: () => {
      const groups = ["8 & Under", "9-10", "11-12", "13-14", "15-16", "Senior"];
      const strokes = ["Freestyle", "Backstroke", "Breaststroke", "Butterfly", "Individual Medley"];
      const distances: Record<string, number> = {
        "Freestyle": 100, "Backstroke": 100, "Breaststroke": 100, "Butterfly": 100, "Individual Medley": 200,
      };
      const events: Partial<EventForm>[] = [];
      let num = 1;
      for (const grp of groups) {
        for (const st of strokes) {
          for (const g of ["F", "M"]) {
            events.push({ eventNumber: num++, gender: g, ageGroup: grp, distance: distances[st] ?? 100, stroke: st });
          }
        }
      }
      return events;
    },
  },
  {
    name: "Sprint Meet",
    description: "50/100 all strokes — girls then boys per event",
    generate: () => {
      const events: Partial<EventForm>[] = [];
      let num = 1;
      for (const dist of [50, 100]) {
        for (const st of ["Freestyle", "Backstroke", "Breaststroke", "Butterfly"]) {
          for (const g of ["F", "M"]) {
            events.push({ eventNumber: num++, gender: g, ageGroup: "", distance: dist, stroke: st });
          }
        }
      }
      for (const g of ["F", "M"]) {
        events.push({ eventNumber: num++, gender: g, ageGroup: "", distance: 200, stroke: "Individual Medley" });
      }
      return events;
    },
  },
  {
    name: "Championship – Prelims/Finals",
    description: "Dual-session championship — girls then boys per event",
    generate: () => {
      const lineup: [number, string][] = [
        [200, "Medley Relay"], [200, "Freestyle"], [200, "Individual Medley"], [50, "Freestyle"],
        [100, "Butterfly"], [100, "Freestyle"], [500, "Freestyle"], [200, "Freestyle Relay"],
        [100, "Backstroke"], [100, "Breaststroke"], [400, "Freestyle Relay"],
      ];
      const events: Partial<EventForm>[] = [];
      let num = 1;
      for (const [dist, st] of lineup) {
        for (const g of ["F", "M"]) {
          events.push({ eventNumber: num++, gender: g, ageGroup: "", distance: dist, stroke: st, eventType: "Prelims", isRelay: st.includes("Relay") });
        }
      }
      for (const [dist, st] of lineup) {
        for (const g of ["F", "M"]) {
          events.push({ eventNumber: num++, gender: g, ageGroup: "", distance: dist, stroke: st, eventType: "Finals", isRelay: st.includes("Relay") });
        }
      }
      return events;
    },
  },
  {
    name: "High School Invitational",
    description: "NFHS standard 12-event order, girls then boys (SCY)",
    generate: () => {
      const lineup: [number, string, boolean][] = [
        [200, "Medley Relay", true],
        [200, "Freestyle", false],
        [200, "Individual Medley", false],
        [50, "Freestyle", false],
        [1, "Diving", false],
        [100, "Butterfly", false],
        [100, "Freestyle", false],
        [500, "Freestyle", false],
        [200, "Freestyle Relay", true],
        [100, "Backstroke", false],
        [100, "Breaststroke", false],
        [400, "Freestyle Relay", true],
      ];
      const events: Partial<EventForm>[] = [];
      let num = 1;
      for (const [dist, st, isRelay] of lineup) {
        for (const g of ["F", "M"]) {
          events.push({ eventNumber: num++, gender: g, ageGroup: "", distance: dist, stroke: st, isRelay, course: "SCY" });
        }
      }
      return events;
    },
  },
];

function BulkAddDialog({
  open,
  onOpenChange,
  meetId,
  existingCount,
  sessions,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  meetId: number;
  existingCount: number;
  sessions: any[];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<Partial<EventForm>[]>([]);
  const [sessionId, setSessionId] = useState("none");
  const createEvent = useCreateEvent();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  function selectTemplate(name: string) {
    const tmpl = TEMPLATE_PRESETS.find((t) => t.name === name);
    if (!tmpl) return;
    setSelected(name);
    const events = tmpl.generate();
    setPreview(events.map((e, i) => ({ ...BLANK_FORM, ...e, eventNumber: existingCount + i + 1 })));
  }

  async function handleBulkAdd() {
    if (!preview.length) return;
    setLoading(true);
    try {
      for (const ev of preview) {
        await createEvent.mutateAsync({
          data: {
            meetId,
            eventNumber: ev.eventNumber ?? 1,
            gender: ev.gender ?? "M",
            ageGroup: ev.ageGroup ?? "",
            distance: ev.distance ?? 100,
            stroke: ev.stroke ?? "Freestyle",
            eventType: ev.eventType ?? "Standard",
            heatOrder: ev.heatOrder ?? "Slow-to-Fast",
            isRelay: ev.isRelay ?? false,
            sessionId: sessionId !== "none" ? parseInt(sessionId) : undefined,
          } as any,
        });
      }
      queryClient.invalidateQueries({ queryKey: getListEventsQueryKey(meetId) });
      toast({ title: `${preview.length} events added` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Add Events from Template</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            {TEMPLATE_PRESETS.map((t) => (
              <div
                key={t.name}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${selected === t.name ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                onClick={() => selectTemplate(t.name)}
              >
                <div className="font-medium text-sm">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.description}</div>
              </div>
            ))}
          </div>
          {preview.length > 0 && (
            <>
              <div className="space-y-1.5">
                <Label>Assign to Session (optional)</Label>
                <Select value={sessionId} onValueChange={setSessionId}>
                  <SelectTrigger><SelectValue placeholder="No session" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— No session —</SelectItem>
                    {sessions.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.sessionNumber}: {s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-md border max-h-48 overflow-y-auto">
                <div className="p-2 text-xs font-semibold text-muted-foreground bg-muted/40">
                  Preview — {preview.length} events will be created:
                </div>
                <div className="divide-y">
                  {preview.slice(0, 30).map((ev, i) => (
                    <div key={i} className="px-3 py-1.5 text-xs flex gap-3">
                      <span className="font-mono text-primary w-5">{ev.eventNumber}</span>
                      <span className="text-muted-foreground">{ev.gender === "F" ? "Women" : "Men"}</span>
                      <span>{ev.ageGroup || "Open"} {ev.distance} {ev.stroke}</span>
                      {ev.eventType && ev.eventType !== "Standard" && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">{ev.eventType}</Badge>
                      )}
                    </div>
                  ))}
                  {preview.length > 30 && (
                    <div className="px-3 py-1.5 text-xs text-muted-foreground">+ {preview.length - 30} more…</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleBulkAdd} disabled={!preview.length || loading}>
            {loading ? "Adding…" : `Add ${preview.length} Events`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function statusColor(status: string) {
  if (status === "completed") return "default";
  if (status === "seeded") return "secondary";
  return "outline";
}

export default function MeetEvents({ meetId }: { meetId: number }) {
  const { data: events = [], isLoading } = useListEvents(meetId);
  const { data: sessions = [] } = useListSessions(meetId);
  const { data: meet } = useGetMeet(meetId);
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<Event | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const ev3InputRef = useRef<HTMLInputElement>(null);

  function addDays(iso: string | undefined, days: number): string | undefined {
    if (!iso) return undefined;
    const d = new Date(iso + "T00:00:00");
    if (Number.isNaN(d.getTime())) return undefined;
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  async function handleImportEv3(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = parseEv3(text);
      if (parsed.events.length === 0) {
        toast({ title: "No events found", description: "The .ev3 file contained no event records.", variant: "destructive" });
        return;
      }

      const store = readStore();
      const newSessions: Session[] = [];
      // Reuse a session that already exists for this meet with the same number,
      // otherwise create one (dated from the meet start date + day offset).
      const sessionIdByNumber = new Map<number, number>();
      for (const s of store.sessions.filter((s) => s.meetId === meetId)) {
        if (s.sessionNumber != null) sessionIdByNumber.set(s.sessionNumber, s.id);
      }
      let sessionIdSeed = nextId([...store.sessions, ...newSessions]);
      for (const ev of parsed.events) {
        if (ev.sessionNumber == null || sessionIdByNumber.has(ev.sessionNumber)) continue;
        const id = sessionIdSeed++;
        sessionIdByNumber.set(ev.sessionNumber, id);
        newSessions.push({
          id,
          meetId,
          sessionNumber: ev.sessionNumber,
          name: ev.day ? `Session ${ev.sessionNumber} (Day ${ev.day})` : `Session ${ev.sessionNumber}`,
          date: ev.day ? addDays(meet?.startDate, ev.day - 1) : meet?.startDate,
          startTime: ev.sessionStart ?? undefined,
        });
      }

      let eventIdSeed = nextId(store.events);
      const newEvents: Event[] = parsed.events.map((ev) => ({
        id: eventIdSeed++,
        meetId,
        sessionId: ev.sessionNumber != null ? sessionIdByNumber.get(ev.sessionNumber) : undefined,
        eventNumber: ev.eventNumber,
        gender: ev.gender,
        ageGroup: ev.ageGroup || undefined,
        distance: ev.distance,
        stroke: ev.stroke,
        course: ev.course ?? undefined,
        eventType: ev.eventType,
        heatOrder: "Slow-to-Fast",
        isRelay: ev.isRelay,
        status: "pending",
        createdAt: new Date().toISOString(),
      }));

      writeStore({
        ...store,
        sessions: [...store.sessions, ...newSessions],
        events: [...store.events, ...newEvents],
      });
      queryClient.invalidateQueries({ queryKey: getListEventsQueryKey(meetId) });
      queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey(meetId) });

      const sum = summarizeEv3(parsed);
      toast({
        title: `Imported ${newEvents.length} events`,
        description: `${sum.individualEvents} individual, ${sum.relayEvents} relay · ${newSessions.length} new session(s)${parsed.warnings.length ? ` · ${parsed.warnings.length} warning(s)` : ""}`,
      });
    } catch (err) {
      toast({ title: "Import failed", description: err instanceof Error ? err.message : "Could not parse the .ev3 file.", variant: "destructive" });
    } finally {
      setImporting(false);
      if (ev3InputRef.current) ev3InputRef.current.value = "";
    }
  }

  const sorted = useMemo(() => [...events].sort((a, b) => a.eventNumber - b.eventNumber), [events]);

  function getSessionName(sessionId?: number) {
    if (!sessionId) return null;
    const s = sessions.find((s) => s.id === sessionId);
    return s ? `${(s as any).sessionNumber ?? ""}:${s.name}` : null;
  }

  function eventToForm(ev: Event): EventForm {
    return {
      eventNumber: ev.eventNumber,
      gender: ev.gender,
      ageGroup: ev.ageGroup ?? "",
      distance: ev.distance,
      stroke: ev.stroke,
      course: ev.course ?? "",
      eventType: ev.eventType ?? "Standard",
      heatOrder: ev.heatOrder ?? "Slow-to-Fast",
      isRelay: ev.isRelay ?? false,
      sessionId: String((ev as any).sessionId ?? "none"),
    };
  }

  async function handleCreate(data: EventForm) {
    await createEvent.mutateAsync({
      data: {
        meetId,
        eventNumber: data.eventNumber,
        gender: data.gender,
        ageGroup: data.ageGroup || undefined,
        distance: data.distance,
        stroke: data.stroke,
        course: data.course || undefined,
        eventType: data.eventType,
        heatOrder: data.heatOrder,
        isRelay: data.isRelay,
        sessionId: data.sessionId !== "none" ? parseInt(data.sessionId) : undefined,
      } as any,
    });
    queryClient.invalidateQueries({ queryKey: getListEventsQueryKey(meetId) });
    toast({ title: "Event added" });
    setAddOpen(false);
  }

  async function handleEdit(data: EventForm) {
    if (!editEvent) return;
    await updateEvent.mutateAsync({
      id: editEvent.id,
      data: {
        eventNumber: data.eventNumber,
        gender: data.gender,
        ageGroup: data.ageGroup || undefined,
        distance: data.distance,
        stroke: data.stroke,
        course: data.course || undefined,
        eventType: data.eventType,
        heatOrder: data.heatOrder,
        isRelay: data.isRelay,
        sessionId: data.sessionId !== "none" ? parseInt(data.sessionId) : undefined,
      } as any,
    });
    queryClient.invalidateQueries({ queryKey: getListEventsQueryKey(meetId) });
    toast({ title: "Event updated" });
    setEditEvent(null);
  }

  async function handleDelete(id: number) {
    await deleteEvent.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListEventsQueryKey(meetId) });
    toast({ title: "Event deleted" });
    setDeleteId(null);
  }

  async function moveEvent(index: number, direction: "up" | "down") {
    const list = [...sorted];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const a = list[index];
    const b = list[targetIndex];
    const numA = a.eventNumber;
    const numB = b.eventNumber;

    await updateEvent.mutateAsync({ id: a.id, data: { eventNumber: numB } });
    await updateEvent.mutateAsync({ id: b.id, data: { eventNumber: numA } });
    queryClient.invalidateQueries({ queryKey: getListEventsQueryKey(meetId) });
  }

  const nextEventNumber = sorted.length > 0 ? Math.max(...sorted.map((e) => e.eventNumber)) + 1 : 1;

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading events…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Events</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{sorted.length} event{sorted.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={ev3InputRef}
            type="file"
            accept=".ev3,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportEv3(file);
            }}
          />
          <Button variant="outline" size="sm" disabled={importing} onClick={() => ev3InputRef.current?.click()}>
            {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Import .ev3
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)}>
            <Zap className="h-4 w-4 mr-2" />
            Quick Template
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Event
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 pl-2"></TableHead>
                  <TableHead className="w-16">Evt #</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Age Group</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Distance</TableHead>
                  <TableHead>Stroke</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-center">Entries</TableHead>
                  <TableHead className="text-center">Heats</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((event, idx) => {
                  const sessionName = getSessionName((event as any).sessionId);
                  return (
                    <TableRow key={event.id} className="group">
                      <TableCell className="pl-2">
                        <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost" size="icon" className="h-5 w-5"
                            disabled={idx === 0}
                            onClick={() => moveEvent(idx, "up")}
                          >
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-5 w-5"
                            disabled={idx === sorted.length - 1}
                            onClick={() => moveEvent(idx, "down")}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono font-bold text-primary">{event.eventNumber}</TableCell>
                      <TableCell>
                        {sessionName ? (
                          <Badge variant="outline" className="text-[10px] font-normal">{sessionName}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                      <TableCell>{event.ageGroup || "Open"}</TableCell>
                      <TableCell>
                        {event.gender === "M" ? "Men" : event.gender === "F" ? "Women" : "Mixed"}
                      </TableCell>
                      <TableCell className="font-mono">{event.distance}</TableCell>
                      <TableCell>{event.stroke}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {event.eventType || "Standard"}
                          {event.isRelay && " Relay"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-medium">{event.entryCount ?? 0}</TableCell>
                      <TableCell className="text-center font-medium">{event.heatCount ?? 0}</TableCell>
                      <TableCell>
                        <Badge variant={statusColor(event.status)}>{event.status ?? "pending"}</Badge>
                      </TableCell>
                      <TableCell className="text-right pr-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditEvent(event)}>
                              <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteId(event.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {sorted.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-10 text-muted-foreground">
                      No events yet. Use "Add Event" or "Quick Template" to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add event dialog */}
      <EventDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        sessions={sessions}
        initial={{ ...BLANK_FORM, eventNumber: nextEventNumber }}
        onSave={handleCreate}
        isPending={createEvent.isPending}
      />

      {/* Edit event dialog */}
      {editEvent && (
        <EventDialog
          key={editEvent.id}
          open={!!editEvent}
          onOpenChange={(v) => { if (!v) setEditEvent(null); }}
          initial={eventToForm(editEvent)}
          sessions={sessions}
          onSave={handleEdit}
          isPending={updateEvent.isPending}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the event and all its entries, heats, and results. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              Delete Event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk add dialog */}
      <BulkAddDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        meetId={meetId}
        existingCount={sorted.length}
        sessions={sessions}
      />
    </div>
  );
}
