import { useState, useEffect } from "react";
import { useListEvents, useListHeats, useSetResult, getListHeatsQueryKey, readStore } from "@/lib/local-store";
import { useListFinals } from "@/lib/finals";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { formatTime, parseTime } from "@/lib/format-time";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Edit2, Wifi, Send, Loader2, Radio, Play, Square } from "lucide-react";
import { broadcastRun, broadcastSignal, broadcastDataChanged, subscribeToSignals } from "@/lib/live-broadcast";
import { autoPushLiveResults } from "@/lib/live-push";

interface ResultForm {
  finishTime: string;
  place: string;
  dq: boolean;
  dqCode: string;
  ns: boolean;
  dnf: boolean;
  splits: string;
}

const DQ_CODES = [
  { code: "1A", label: "False Start" },
  { code: "2A", label: "Stroke Infraction — Freestyle" },
  { code: "2B", label: "Stroke Infraction — Backstroke" },
  { code: "2C", label: "Stroke Infraction — Breaststroke" },
  { code: "2D", label: "Stroke Infraction — Butterfly" },
  { code: "3A", label: "No Touch / Illegal Touch" },
  { code: "3B", label: "Early Turn" },
  { code: "4A", label: "Unsportsmanlike Conduct" },
  { code: "4B", label: "Delay of Meet" },
  { code: "5A", label: "Unspecified / Other" },
];

function fmtTime(secs: number | null | undefined) {
  if (!secs) return "NT";
  return formatTime(secs);
}

export default function MeetRun({ meetId }: { meetId: number }) {
  const { data: events } = useListEvents(meetId);
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [editLane, setEditLane] = useState<any | null>(null);
  const [editHeat, setEditHeat] = useState<number | null>(null);
  const [form, setForm] = useState<ResultForm>({
    finishTime: "", place: "", dq: false, dqCode: "", ns: false, dnf: false, splits: ""
  });
  const [pushing, setPushing] = useState(false);
  const [lastPush, setLastPush] = useState<string | null>(null);
  const [racingHeat, setRacingHeat] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedEvent || !events) return;
    const event = events.find((e) => String(e.id) === selectedEvent);
    if (!event) return;
    broadcastRun({
      meetId,
      eventId: parseInt(selectedEvent),
      eventNumber: event.eventNumber,
      eventDescription: `${event.gender === "F" ? "Women's" : "Men's"} ${event.ageGroup || "Open"} ${event.distance} ${event.stroke}`,
      updatedAt: new Date().toISOString(),
    });
  }, [selectedEvent, events, meetId]);

  const { data: heats, isLoading, refetch } = useListHeats(
    selectedEvent ? parseInt(selectedEvent, 10) : 0,
    { query: { enabled: !!selectedEvent, queryKey: getListHeatsQueryKey(parseInt(selectedEvent || "0", 10)) } }
  );

  const { data: finals } = useListFinals(meetId);
  const isFinalsRound = !!selectedEvent && (finals ?? []).some((f) => f.eventId === parseInt(selectedEvent, 10));

  const setResult = useSetResult();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Stay in lockstep with the Timing console / other tabs: when any screen
  // commits results for this meet, refetch so the Run grid reflects it live.
  useEffect(() => {
    return subscribeToSignals((sig) => {
      if (sig.meetId !== meetId) return;
      if (sig.type === "data-changed" && selectedEvent) {
        queryClient.invalidateQueries({ queryKey: getListHeatsQueryKey(parseInt(selectedEvent)) });
      }
    });
  }, [meetId, selectedEvent, queryClient]);

  // Reset the "racing" indicator whenever the event changes.
  useEffect(() => {
    setRacingHeat(null);
  }, [selectedEvent]);

  function firstIncompleteHeat(): number | null {
    if (!heats || heats.length === 0) return null;
    const incomplete = heats.find((h: any) =>
      h.lanes?.filter((l: any) => l.athleteId).some((l: any) => !(l.finishTime || l.dq || l.ns || l.dnf))
    );
    return (incomplete ?? heats[0])?.heatNumber ?? null;
  }

  function startRace() {
    if (!selectedEvent) return;
    const heatNumber = firstIncompleteHeat();
    setRacingHeat(heatNumber);
    // Drive the Scoreboard + Timing console (and any connected start system).
    broadcastSignal({
      type: "start",
      meetId,
      eventId: parseInt(selectedEvent),
      heatNumber: heatNumber ?? undefined,
      at: new Date().toISOString(),
    });
    toast({
      title: "Race started",
      description: heatNumber ? `Heat ${heatNumber} — scoreboard & timing started` : "Scoreboard & timing started",
    });
  }

  function stopRace() {
    if (!selectedEvent) return;
    broadcastSignal({
      type: "stop",
      meetId,
      eventId: parseInt(selectedEvent),
      heatNumber: racingHeat ?? undefined,
      at: new Date().toISOString(),
    });
    setRacingHeat(null);
    toast({ title: "Race stopped" });
  }

  function openEdit(lane: any, heatNumber: number) {
    setEditLane(lane);
    setEditHeat(heatNumber);
    setForm({
      finishTime: lane.finishTime ? formatTime(lane.finishTime) : "",
      place: lane.place ? String(lane.place) : "",
      dq: lane.dq ?? false,
      dqCode: lane.dqCode ?? "",
      ns: lane.ns ?? false,
      dnf: lane.dnf ?? false,
      splits: "",
    });
  }

  function handleSave() {
    if (!editLane?.entryId) return;
    const finishTimeSec = form.dq || form.ns || form.dnf ? null : parseTime(form.finishTime);
    const place = form.dq || form.ns || form.dnf ? null : (parseInt(form.place) || null);
    setResult.mutate(
      {
        eventId: parseInt(selectedEvent),
        data: {
          entryId: editLane.entryId,
          finishTime: finishTimeSec ?? undefined,
          place: place ?? undefined,
          dq: form.dq,
          dqCode: form.dq ? form.dqCode : undefined,
          ns: form.ns,
          dnf: form.dnf,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Result saved" });
          setEditLane(null);
          queryClient.invalidateQueries({ queryKey: getListHeatsQueryKey(parseInt(selectedEvent)) });
          refetch();
          broadcastDataChanged(meetId);
          autoPushLiveResults(meetId)
            .then(() => setLastPush(new Date().toLocaleTimeString()))
            .catch(() => {});
        },
        onError: (err: any) => {
          toast({ title: "Failed to save result", description: err?.message, variant: "destructive" });
        },
      }
    );
  }

  async function pushLiveResults() {
    setPushing(true);
    try {
      await autoPushLiveResults(meetId);
      setLastPush(new Date().toLocaleTimeString());
      toast({ title: "Results pushed live", description: `Updated at ${new Date().toLocaleTimeString()}` });
    } catch (e: any) {
      toast({ title: "Push failed", description: e?.message, variant: "destructive" });
    } finally {
      setPushing(false);
    }
  }

  function getStatusBadge(lane: any) {
    if (lane.dq) return <Badge className="bg-red-600 text-white text-[10px]">DQ</Badge>;
    if (lane.ns) return <Badge className="bg-slate-500 text-white text-[10px]">NS</Badge>;
    if (lane.dnf) return <Badge className="bg-orange-600 text-white text-[10px]">DNF</Badge>;
    if (lane.finishTime) return <Badge className="bg-green-600 text-white text-[10px]">Done</Badge>;
    return null;
  }

  const totalEntries = heats?.reduce((sum: number, h: any) => sum + (h.lanes?.filter((l: any) => l.athleteId).length ?? 0), 0) ?? 0;
  const completedEntries = heats?.reduce((sum: number, h: any) =>
    sum + (h.lanes?.filter((l: any) => l.finishTime || l.dq || l.ns || l.dnf).length ?? 0), 0) ?? 0;
  const progress = totalEntries > 0 ? Math.round((completedEntries / totalEntries) * 100) : 0;

  const availableEvents = events?.filter((e) => e.status === "seeded" || e.status === "completed") ?? [];

  return (
    <>
      <div className="space-y-4">
        {/* Header card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1">
                <CardTitle className="flex items-center gap-2">
                  Live Meet Running
                  {selectedEvent && (finals ?? []).length > 0 && (
                    <Badge variant={isFinalsRound ? "default" : "secondary"} className={isFinalsRound ? "bg-amber-500 text-black" : ""}>
                      {isFinalsRound ? "Finals Round" : "Prelims Round"}
                    </Badge>
                  )}
                </CardTitle>
                {selectedEvent && totalEntries > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{completedEntries}/{totalEntries} results entered</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedEvent && (
                  <div className="flex items-center gap-1.5 text-xs text-cyan-600 dark:text-cyan-400 font-medium">
                    <Radio className="h-3.5 w-3.5 animate-pulse" />
                    Broadcasting
                  </div>
                )}
                {selectedEvent && (
                  racingHeat !== null ? (
                    <Button
                      size="sm"
                      onClick={stopRace}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      <Square className="h-4 w-4 mr-2" />
                      Stop Heat {racingHeat}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={startRace}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Start Race
                    </Button>
                  )
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={pushLiveResults}
                  disabled={pushing}
                  className={lastPush ? "border-green-500 text-green-700 hover:text-green-700" : ""}
                >
                  {pushing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : lastPush ? (
                    <Wifi className="h-4 w-4 mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  {pushing ? "Pushing…" : lastPush ? `Pushed ${lastPush}` : "Push to Website"}
                </Button>
                <div className="w-72">
                  <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Event to Run" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableEvents.map((event) => (
                        <SelectItem key={event.id} value={event.id.toString()}>
                          Evt {event.eventNumber}: {event.gender === "F" ? "Women" : "Men"} {event.distance} {event.stroke}
                          {event.status === "completed" && " ✓"}
                        </SelectItem>
                      ))}
                      {availableEvents.length === 0 && (
                        <SelectItem value="__none" disabled>No seeded events yet</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {!selectedEvent && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Select an event above to enter results. Events must be seeded first.
            </CardContent>
          </Card>
        )}

        {selectedEvent && (
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading heats…</div>
            ) : heats?.map((heat: any) => {
              const heatComplete = heat.lanes?.filter((l: any) => l.athleteId).every(
                (l: any) => l.finishTime || l.dq || l.ns || l.dnf
              );
              return (
                <Card key={heat.id} className={heatComplete ? "border-green-200 bg-green-50/30 dark:border-green-900 dark:bg-green-900/10" : ""}>
                  <CardHeader className="flex flex-row items-center justify-between py-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      Heat {heat.heatNumber}
                      {heatComplete && <CheckCircle className="h-4 w-4 text-green-600" />}
                    </CardTitle>
                    <div className="text-xs text-muted-foreground">
                      {heat.lanes?.filter((l: any) => l.finishTime || l.dq || l.ns || l.dnf).length ?? 0}
                      /{heat.lanes?.filter((l: any) => l.athleteId).length ?? 0} results
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 pb-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-14 pl-4">Lane</TableHead>
                          <TableHead>Athlete</TableHead>
                          <TableHead>Team</TableHead>
                          <TableHead className="font-mono">Seed</TableHead>
                          <TableHead className="font-mono">Result</TableHead>
                          <TableHead className="w-14 text-center">Place</TableHead>
                          <TableHead className="w-24 text-right pr-4">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {heat.lanes?.map((lane: any) => (
                          <TableRow
                            key={lane.laneNumber ?? lane.lane}
                            className={lane.finishTime || lane.dq || lane.ns || lane.dnf ? "bg-muted/30" : ""}
                          >
                            <TableCell className="pl-4 font-bold text-primary text-lg">
                              {lane.laneNumber ?? lane.lane}
                            </TableCell>
                            <TableCell className={lane.athleteId ? "font-medium" : "text-muted-foreground italic"}>
                              <div className="flex items-center gap-2">
                                {lane.athleteName || "Empty"}
                                {getStatusBadge(lane)}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{lane.teamName || "—"}</TableCell>
                            <TableCell className="font-mono text-sm">{fmtTime(lane.seedTime)}</TableCell>
                            <TableCell className="font-mono font-bold">
                              {lane.dq ? <span className="text-red-600">DQ {lane.dqCode ? `(${lane.dqCode})` : ""}</span>
                                : lane.ns ? <span className="text-slate-500">NS</span>
                                : lane.dnf ? <span className="text-orange-600">DNF</span>
                                : lane.finishTime ? <span className="text-green-700 dark:text-green-400">{formatTime(lane.finishTime)}</span>
                                : <span className="text-muted-foreground/30">—</span>}
                            </TableCell>
                            <TableCell className="text-center font-black text-xl">
                              {!lane.dq && !lane.ns && !lane.dnf && lane.place ? lane.place : ""}
                            </TableCell>
                            <TableCell className="text-right pr-4">
                              {lane.athleteId && (
                                <Button
                                  size="sm"
                                  variant={lane.finishTime || lane.dq || lane.ns || lane.dnf ? "outline" : "default"}
                                  onClick={() => openEdit(lane, heat.heatNumber)}
                                >
                                  {lane.finishTime || lane.dq || lane.ns || lane.dnf
                                    ? <><Edit2 className="h-3 w-3 mr-1" />Edit</>
                                    : <><CheckCircle className="h-3 w-3 mr-1" />Enter</>}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              );
            })}
            {(!heats || heats.length === 0) && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No heats found. Ensure the event is seeded in the Seeding tab.
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Result Entry Dialog */}
      <Dialog open={!!editLane} onOpenChange={(open) => { if (!open) setEditLane(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editLane?.finishTime || editLane?.dq || editLane?.ns || editLane?.dnf ? "Edit Result" : "Enter Result"}
            </DialogTitle>
          </DialogHeader>
          {editLane && (
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{editLane.athleteName}</span>
              {" · "}{editLane.teamName}
              {" · "}Lane {editLane.laneNumber ?? editLane.lane}, Heat {editHeat}
              {editLane.seedTime && <span className="ml-2 font-mono text-xs">Seed: {fmtTime(editLane.seedTime)}</span>}
            </div>
          )}
          <div className="space-y-4 py-2">
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Checkbox id="dq" checked={form.dq}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, dq: !!v, ns: false, dnf: false }))} />
                <Label htmlFor="dq" className="cursor-pointer font-medium text-red-600">DQ</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="ns" checked={form.ns}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, ns: !!v, dq: false, dnf: false }))} />
                <Label htmlFor="ns" className="cursor-pointer font-medium text-slate-500">No Show</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="dnf" checked={form.dnf}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, dnf: !!v, dq: false, ns: false }))} />
                <Label htmlFor="dnf" className="cursor-pointer font-medium text-orange-600">DNF</Label>
              </div>
            </div>

            {form.dq && (
              <div className="space-y-1.5">
                <Label>DQ Code</Label>
                <Select value={form.dqCode} onValueChange={(v) => setForm((f) => ({ ...f, dqCode: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select DQ code…" /></SelectTrigger>
                  <SelectContent>
                    {DQ_CODES.map((d) => (
                      <SelectItem key={d.code} value={d.code}>{d.code} — {d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {!form.dq && !form.ns && !form.dnf && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Finish Time</Label>
                    <Input
                      placeholder="e.g. 52.34 or 1:52.34"
                      value={form.finishTime}
                      onChange={(e) => setForm((f) => ({ ...f, finishTime: e.target.value }))}
                      className="font-mono"
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground">MM:SS.hh or SS.hh</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Place</Label>
                    <Input
                      type="number" min={1} max={100} placeholder="1"
                      value={form.place}
                      onChange={(e) => setForm((f) => ({ ...f, place: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Splits (optional, comma-separated)</Label>
                  <Input
                    placeholder="e.g. 25.10, 27.24"
                    value={form.splits}
                    onChange={(e) => setForm((f) => ({ ...f, splits: e.target.value }))}
                    className="font-mono"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLane(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={setResult.isPending}>
              {setResult.isPending ? "Saving…" : "Save Result"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
