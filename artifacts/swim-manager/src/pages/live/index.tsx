import { useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatTime } from "@/lib/format-time";
import { readStore, type Event } from "@/lib/local-store";
import { buildResults } from "@/lib/report-data";
import { getActiveRun, subscribeToSignals, subscribeToRun } from "@/lib/live-broadcast";
import { addScratchRequest } from "@/lib/scratch-requests";
import { format } from "date-fns";
import {
  Waves, Radio, Clock, Trophy, CalendarDays, MapPin, CheckCircle2, Timer, AlertTriangle,
} from "lucide-react";

const DEADLINE_KEY = (meetId: number) => `swimmanager_finals_deadline_${meetId}`;

function readDeadline(meetId: number): number | null {
  try {
    const raw = localStorage.getItem(DEADLINE_KEY(meetId));
    if (!raw) return null;
    const v = JSON.parse(raw);
    return typeof v.deadline === "number" ? v.deadline : null;
  } catch {
    return null;
  }
}

function eventTitle(e: { gender: string; ageGroup?: string; distance: number; stroke: string }) {
  const g = e.gender === "M" ? "Men" : e.gender === "F" ? "Women" : "Mixed";
  return `${g} ${e.ageGroup || "Open"} ${e.distance} ${e.stroke}`;
}

const STATUS_STYLE: Record<string, string> = {
  running: "bg-red-500/15 text-red-300 border-red-400/30",
  complete: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  seeded: "bg-sky-500/15 text-sky-300 border-sky-400/30",
  open: "bg-white/10 text-cyan-100/70 border-white/15",
};

export default function LiveSite() {
  const [, params] = useRoute("/live/:meetId");
  const meetId = params?.meetId ? parseInt(params.meetId) : 0;

  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  // Re-render on any cross-screen data change, active-run change, or timer tick.
  useEffect(() => {
    const offSignal = subscribeToSignals((s) => {
      if (!meetId || s.meetId === meetId) refresh();
    });
    const offRun = subscribeToRun(() => refresh());
    const id = setInterval(refresh, 1000);
    return () => { offSignal(); offRun(); clearInterval(id); };
  }, [meetId]);

  const store = useMemo(() => readStore(), [tick]);
  const meet = store.meets.find((m) => m.id === meetId);
  const events = useMemo(
    () => store.events.filter((e) => e.meetId === meetId).sort((a, b) => a.eventNumber - b.eventNumber),
    [store, meetId]
  );
  const club = store.club;

  const activeRun = getActiveRun();
  const liveEvent = activeRun && activeRun.meetId === meetId ? activeRun : null;

  const resultsData = useMemo(() => {
    try {
      return buildResults(meetId);
    } catch {
      return null;
    }
  }, [tick, meetId]);
  const completed = (resultsData?.events ?? []).filter((e) => e.results.length > 0);

  const deadline = readDeadline(meetId);
  const remaining = deadline != null ? deadline - Date.now() : null;

  if (!meet) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-cyan-100">
        <div className="text-center space-y-2">
          <Waves className="h-10 w-10 mx-auto opacity-50" />
          <p className="text-lg font-semibold">Meet not found on this device</p>
          <p className="text-sm text-cyan-200/60">Open the meet in SwimManager on this browser to view its live page.</p>
        </div>
      </div>
    );
  }

  const location = [meet.facility, meet.city, meet.state].filter(Boolean).join(" · ");
  const dateLabel = meet.endDate && meet.endDate !== meet.startDate
    ? `${format(new Date(meet.startDate), "MMM d")} – ${format(new Date(meet.endDate), "MMM d, yyyy")}`
    : meet.startDate ? format(new Date(meet.startDate), "MMM d, yyyy") : "";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-sky-950 to-slate-950 text-cyan-50">
      {/* Header */}
      <header className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 opacity-20 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle at 20% 30%, #0ea5e9 0, transparent 45%), radial-gradient(circle at 80% 10%, #06b6d4 0, transparent 40%)" }} />
        <div className="relative max-w-4xl mx-auto px-5 py-7">
          <div className="flex items-center gap-2 text-cyan-300/80 text-xs font-medium tracking-widest uppercase mb-2">
            <Waves className="h-4 w-4" /> {club?.name || "SwimManager"} · Live Meet
          </div>
          <h1 className="text-3xl sm:text-4xl font-black leading-tight">{meet.name}</h1>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3 text-sm text-cyan-100/80">
            {dateLabel && <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> {dateLabel}</span>}
            {location && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {location}</span>}
            <span className="flex items-center gap-1.5 uppercase tracking-wide">{meet.course}</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-6 space-y-6">
        {/* Now swimming */}
        {liveEvent ? (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-5 flex items-center gap-4">
            <div className="relative">
              <Radio className="h-8 w-8 text-red-400" />
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 animate-ping" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-red-300 font-semibold">Now Swimming</div>
              <div className="text-xl font-bold">Event {liveEvent.eventNumber} — {liveEvent.eventDescription}</div>
            </div>
            <Badge className="ml-auto bg-red-600 text-white border-0">LIVE</Badge>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex items-center gap-3 text-cyan-100/70">
            <Radio className="h-6 w-6 opacity-60" />
            <span>No event is currently running. Check the schedule below.</span>
          </div>
        )}

        {/* Scratch deadline countdown */}
        {remaining != null && remaining > 0 && (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-5">
            <div className="flex items-center gap-3">
              <Timer className="h-7 w-7 text-amber-300" />
              <div>
                <div className="text-xs uppercase tracking-widest text-amber-200 font-semibold">Finals Scratch Deadline</div>
                <div className="text-2xl font-black font-mono tabular-nums">{fmt(remaining)}</div>
              </div>
            </div>
            <p className="text-sm text-amber-100/80 mt-2">
              Declare finals scratches before the timer expires. When it reaches zero, scratches are processed
              automatically and finals are re-seeded per USA Swimming rules.
            </p>
          </div>
        )}
        {remaining != null && remaining <= 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center gap-2 text-cyan-100/70 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-300" /> Scratch deadline has passed — finals have been seeded.
          </div>
        )}

        <Tabs defaultValue="schedule">
          <TabsList className="bg-white/5 border border-white/10">
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
            <TabsTrigger value="scratch">ScratchPad</TabsTrigger>
          </TabsList>

          {/* Schedule */}
          <TabsContent value="schedule" className="mt-4">
            {events.length === 0 ? (
              <Empty>No events have been added yet.</Empty>
            ) : (
              <div className="space-y-2">
                {events.map((e) => {
                  const isLive = liveEvent?.eventNumber === e.eventNumber;
                  const key = isLive ? "running" : e.status === "complete" ? "complete" : e.status === "seeded" ? "seeded" : "open";
                  return (
                    <div key={e.id}
                      className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${isLive ? "border-red-400/40 bg-red-500/10" : "border-white/10 bg-white/5"}`}>
                      <span className="font-mono text-sm text-cyan-300/70 w-8">#{e.eventNumber}</span>
                      <span className="font-semibold">{eventTitle(e)}</span>
                      {e.isRelay && <Badge variant="outline" className="border-cyan-400/30 text-cyan-200">Relay</Badge>}
                      <span className={`ml-auto text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLE[key]}`}>
                        {isLive ? "Swimming now" : key === "complete" ? "Final" : key === "seeded" ? "Seeded" : "Upcoming"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Results */}
          <TabsContent value="results" className="mt-4">
            {completed.length === 0 ? (
              <Empty>No results posted yet. They'll appear here as heats finish.</Empty>
            ) : (
              <div className="space-y-4">
                {completed.map((ev, idx) => (
                  <Card key={`${ev.eventNumber}-${(ev as any).roundLabel ?? "x"}-${idx}`} className="bg-white/5 border-white/10 text-cyan-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-amber-400" />
                        Event {ev.eventNumber} — {eventTitle(ev)}
                        {(ev as any).roundLabel && (
                          <Badge variant="outline" className="ml-1 border-amber-400/50 text-amber-300">{(ev as any).roundLabel}</Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {ev.results.slice(0, 8).map((r: any, i: number) => (
                        <div key={i} className="flex items-center gap-3 text-sm py-1 border-b border-white/5 last:border-0">
                          <span className={`w-6 text-center font-bold ${i === 0 ? "text-amber-400" : i === 1 ? "text-slate-300" : i === 2 ? "text-orange-400" : "text-cyan-200/60"}`}>
                            {r.dq ? "DQ" : r.ns ? "NS" : r.dnf ? "DNF" : r.place ?? "—"}
                          </span>
                          <span className="font-medium flex-1 truncate">{r.athleteName}</span>
                          <span className="text-cyan-200/60 w-12 text-right">{r.teamAbbreviation}</span>
                          <span className="font-mono w-20 text-right">{r.finishTime != null ? formatTime(r.finishTime) : "—"}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ScratchPad */}
          <TabsContent value="scratch" className="mt-4">
            <ScratchPad meetId={meetId} events={events} />
          </TabsContent>
        </Tabs>

        <footer className="text-center text-xs text-cyan-200/40 pt-4 pb-8 flex items-center justify-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" /> Powered by SwimManager Pro · live data updates automatically
        </footer>
      </main>
    </div>
  );
}

function fmt(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 py-12 text-center text-cyan-100/60">
      <Clock className="h-7 w-7 mx-auto mb-2 opacity-40" />
      {children}
    </div>
  );
}

function ScratchPad({ meetId, events }: { meetId: number; events: Event[] }) {
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [eventNumber, setEventNumber] = useState("");
  const [reason, setReason] = useState("");
  const [signature, setSignature] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function submit() {
    if (!fullName.trim() || !eventNumber || !signature.trim()) {
      setError("Name, event, and signature are required.");
      return;
    }
    const ev = events.find((e) => String(e.eventNumber) === eventNumber);
    addScratchRequest(meetId, {
      fullName: fullName.trim(),
      dob: dob.trim(),
      eventNumber,
      eventName: ev ? eventTitle(ev) : "",
      reason: reason.trim(),
      signature: signature.trim(),
    });
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-8 text-center space-y-3">
        <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-400" />
        <div className="text-lg font-bold">Scratch submitted</div>
        <p className="text-sm text-emerald-100/80">
          Your declaration for Event {eventNumber} has been sent to the meet referee for review.
        </p>
        <Button variant="outline" className="border-white/20 text-cyan-50 hover:bg-white/10"
          onClick={() => { setSubmitted(false); setFullName(""); setDob(""); setEventNumber(""); setReason(""); setSignature(""); setError(""); }}>
          Submit another scratch
        </Button>
      </div>
    );
  }

  return (
    <Card className="bg-white/5 border-white/10 text-cyan-50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Declare a Scratch</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-cyan-100/70">
          Use this form to officially scratch from an event. Submissions go to the meet referee and are
          governed by USA Swimming Rule 102.7.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1 block text-cyan-100/80">Athlete full name *</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)}
              className="bg-white/10 border-white/15 text-cyan-50 placeholder:text-cyan-200/40" placeholder="First Last" />
          </div>
          <div>
            <Label className="text-xs mb-1 block text-cyan-100/80">Date of birth</Label>
            <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)}
              className="bg-white/10 border-white/15 text-cyan-50" />
          </div>
        </div>
        <div>
          <Label className="text-xs mb-1 block text-cyan-100/80">Event *</Label>
          <Select value={eventNumber} onValueChange={setEventNumber}>
            <SelectTrigger className="bg-white/10 border-white/15 text-cyan-50">
              <SelectValue placeholder="Select event to scratch..." />
            </SelectTrigger>
            <SelectContent>
              {events.map((e) => (
                <SelectItem key={e.id} value={String(e.eventNumber)}>
                  #{e.eventNumber} — {eventTitle(e)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1 block text-cyan-100/80">Reason (optional)</Label>
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
            className="bg-white/10 border-white/15 text-cyan-50 placeholder:text-cyan-200/40"
            placeholder="e.g. Injury, schedule conflict" />
        </div>
        <div>
          <Label className="text-xs mb-1 block text-cyan-100/80">Signature (type full name) *</Label>
          <Input value={signature} onChange={(e) => setSignature(e.target.value)}
            className="bg-white/10 border-white/15 text-cyan-50 placeholder:text-cyan-200/40"
            placeholder="I certify this scratch request" />
        </div>
        {error && <p className="text-sm text-red-300">{error}</p>}
        <Button onClick={submit} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white">
          Submit Scratch Declaration
        </Button>
      </CardContent>
    </Card>
  );
}
