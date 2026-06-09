import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useListMeets, useListEvents, useListHeats, useSetResult, getListHeatsQueryKey } from "@/lib/local-store";
import { formatTime } from "@/lib/format-time";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Timer, WifiOff, Play, Square, RotateCcw,
  Settings, Zap, Radio, CheckCircle2, Keyboard, Wifi
} from "lucide-react";
import { cn } from "@/lib/utils";
import { subscribeToRun, getActiveRun, subscribeToSignals, broadcastDataChanged } from "@/lib/live-broadcast";
import { autoPushLiveResults } from "@/lib/live-push";
import {
  TimingConnection,
  VENDOR_DEFAULT_PORT,
  autoDetectPort,
  probeWebSocket,
  type HardwareMode,
  type ConnectionStatus,
  type TimingEvent,
} from "@/lib/timing-systems";

interface LaneTime {
  lane: number;
  time: number | null;
  split1: number | null;
  split2: number | null;
  touched: boolean;
  dq: boolean;
  ns: boolean;
}

interface HwConfig {
  mode: HardwareMode;
  ip: string;
  port: string;
}

const MODE_LABELS: Record<HardwareMode, string> = {
  manual: "Manual (Keyboard / Button)",
  cts: "Colorado Timing (CTS Dolphin)",
  daktronics: "Daktronics OmniSport 6000",
  omega: "Omega ARES 21",
  sim: "Simulation (Auto-generate times)",
};

const DQ_CODES = [
  { code: "1A", label: "False Start" },
  { code: "2A", label: "Freestyle — Stroke Infraction" },
  { code: "2B", label: "Backstroke — Stroke Infraction" },
  { code: "2C", label: "Breaststroke — Stroke Infraction" },
  { code: "2D", label: "Butterfly — Stroke Infraction" },
  { code: "3A", label: "No Touch / Illegal Touch" },
  { code: "3B", label: "Backstroke Turn" },
  { code: "3C", label: "Breaststroke / Butterfly Turn" },
  { code: "3D", label: "Relay Exchange" },
  { code: "3E", label: "Backstroke — Not on Signal" },
  { code: "4A", label: "Unsportsmanlike Conduct" },
  { code: "4B", label: "Starting Before Signal" },
  { code: "5A", label: "Other / Unspecified" },
  { code: "6A", label: "Relay — False Start" },
  { code: "6B", label: "Relay — Starting Before Touch" },
  { code: "7A", label: "Head Submerged" },
];

function buildLanes(lanes: number): LaneTime[] {
  return Array.from({ length: lanes }, (_, i) => ({
    lane: i + 1,
    time: null,
    split1: null,
    split2: null,
    touched: false,
    dq: false,
    ns: false,
  }));
}

function ElapsedClock({ running, elapsed }: { running: boolean; elapsed: number }) {
  const mm = Math.floor(elapsed / 60);
  const ss = Math.floor(elapsed % 60);
  const hh = Math.round((elapsed * 100) % 100);
  return (
    <div className="font-mono text-5xl font-black tracking-widest tabular-nums text-cyan-300">
      {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}.{String(hh).padStart(2, "0")}
    </div>
  );
}

export default function TimingConsolePage() {
  const { data: meets } = useListMeets();
  const [selectedMeet, setSelectedMeet] = useState("");
  const [selectedEvent, setSelectedEvent] = useState("");
  const [selectedHeat, setSelectedHeat] = useState<number | null>(null);
  const [hwConfig, setHwConfig] = useState<HwConfig>(() => {
    const stored = localStorage.getItem("timing_hw_config");
    return stored ? JSON.parse(stored) : { mode: "manual", ip: "192.168.1.100", port: "5100" };
  });
  const [connStatus, setConnStatus] = useState<ConnectionStatus>("idle");
  const [probing, setProbing] = useState(false);
  const connected = connStatus === "connected";
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [lanes, setLanes] = useState<LaneTime[]>(buildLanes(8));
  const [committed, setCommitted] = useState(false);
  const [tab, setTab] = useState("timing");
  const [followRun, setFollowRun] = useState(false);

  const { data: events } = useListEvents(selectedMeet ? parseInt(selectedMeet) : 0, {
    query: { enabled: !!selectedMeet }
  });
  const { data: heatsData } = useListHeats(selectedEvent ? parseInt(selectedEvent) : 0, {
    query: { enabled: !!selectedEvent }
  });
  const setResult = useSetResult();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connRef = useRef<TimingConnection | null>(null);
  // Holds the start timestamp when a remote "start" signal selects a new
  // event/heat, so the reset effect (which fires on selection change) starts
  // the clock instead of clearing it.
  const pendingStartRef = useRef<number | null>(null);

  const allHeats: number[] = heatsData
    ? heatsData.map((h: any) => h.heatNumber).sort((a: number, b: number) => a - b)
    : [];

  const currentHeatObj = selectedHeat !== null && heatsData
    ? (heatsData.find((h: any) => h.heatNumber === selectedHeat) ?? null)
    : null;
  const currentHeatLanes: any[] = currentHeatObj?.lanes ?? [];

  const eventLanes = (() => {
    const evt = events?.find((e: any) => e.id === parseInt(selectedEvent));
    return (evt as any)?.lanes || 8;
  })();

  useEffect(() => {
    setLanes(buildLanes(eventLanes));
    setCommitted(false);
    // If a remote start signal just switched us to this event/heat, honor it
    // and start the clock rather than resetting to a stopped state.
    if (pendingStartRef.current != null) {
      const at = pendingStartRef.current;
      pendingStartRef.current = null;
      setStartedAt(at);
      setElapsed(0);
      setRunning(true);
    } else {
      setElapsed(0);
      setRunning(false);
      setStartedAt(null);
    }
  }, [selectedEvent, selectedHeat, eventLanes]);

  useEffect(() => {
    if (!followRun) return;
    const initial = getActiveRun();
    if (initial) {
      setSelectedMeet(String(initial.meetId));
      setSelectedEvent(String(initial.eventId));
      setSelectedHeat(null);
    }
    return subscribeToRun((data) => {
      if (!data) return;
      setSelectedMeet(String(data.meetId));
      setSelectedEvent(String(data.eventId));
      setSelectedHeat(null);
      setRunning(false);
      setElapsed(0);
      setStartedAt(null);
      setCommitted(false);
    });
  }, [followRun]);

  useEffect(() => {
    if (running) {
      const start = startedAt ?? Date.now();
      if (!startedAt) setStartedAt(start);
      intervalRef.current = setInterval(() => {
        setElapsed((Date.now() - start) / 1000);
      }, 10);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  // Remote race control: the Run screen's Start/Stop button drives the clock
  // here so the timing operator doesn't have to hit start separately. If a
  // hardware start system is connected, relay the start command to it too.
  useEffect(() => {
    return subscribeToSignals((sig) => {
      if (selectedMeet && sig.meetId !== parseInt(selectedMeet)) return;
      if (sig.type === "start") {
        const at = new Date(sig.at).getTime();
        // Auto-select the meet/event/heat the Run screen started so the lane
        // roster populates with real athletes instead of staying empty (NT).
        const selectionChanges =
          (sig.meetId != null && String(sig.meetId) !== selectedMeet) ||
          (sig.eventId != null && String(sig.eventId) !== selectedEvent) ||
          (sig.heatNumber != null && sig.heatNumber !== selectedHeat);
        if (sig.meetId != null) setSelectedMeet(String(sig.meetId));
        if (sig.eventId != null) setSelectedEvent(String(sig.eventId));
        if (sig.heatNumber != null) setSelectedHeat(sig.heatNumber);
        if (selectionChanges) {
          // The reset effect will fire on the selection change; defer the clock
          // start to it so it isn't immediately cleared.
          pendingStartRef.current = at;
        } else {
          setLanes(buildLanes(eventLanes));
          setCommitted(false);
          setStartedAt(at);
          setElapsed(0);
          setRunning(true);
        }
        connRef.current?.send({ command: "start", at: sig.at });
      } else if (sig.type === "stop") {
        setRunning(false);
      } else if (sig.type === "reset") {
        setRunning(false);
        setElapsed(0);
        setStartedAt(null);
        setLanes(buildLanes(eventLanes));
        setCommitted(false);
      }
    });
  }, [selectedMeet, selectedEvent, selectedHeat, eventLanes, connected]);

  const touchLane = useCallback((laneNum: number) => {
    if (!running) return;
    const t = elapsed;
    setLanes(prev => prev.map(l =>
      l.lane === laneNum && !l.touched ? { ...l, time: t, touched: true } : l
    ));
  }, [running, elapsed]);

  const toggleDQ = (laneNum: number) => {
    setLanes(prev => prev.map(l => l.lane === laneNum ? { ...l, dq: !l.dq, ns: false } : l));
  };
  const toggleNS = (laneNum: number) => {
    setLanes(prev => prev.map(l => l.lane === laneNum ? { ...l, ns: !l.ns, dq: false } : l));
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (tab !== "timing") return;
      const num = parseInt(e.key);
      if (num >= 1 && num <= 9) { touchLane(num); return; }
      if (e.key === " ") {
        e.preventDefault();
        if (!running) { setRunning(true); setElapsed(0); setStartedAt(Date.now()); }
        else setRunning(false);
      }
      if (e.key === "r" || e.key === "R") {
        setRunning(false); setElapsed(0); setStartedAt(null);
        setLanes(buildLanes(eventLanes));
        setCommitted(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [tab, running, touchLane, eventLanes]);

  function runSim() {
    setRunning(true);
    setElapsed(0);
    const start = Date.now();
    setStartedAt(start);
    const baseTime = 25 + Math.random() * 40;
    const spread = 2;
    currentHeatLanes.forEach((h: any) => {
      const delay = (baseTime + (Math.random() - 0.5) * spread) * 1000;
      setTimeout(() => {
        setElapsed((Date.now() - start) / 1000);
        setLanes(prev => prev.map(l =>
          l.lane === (h.laneNumber ?? h.lane) ? { ...l, time: delay / 1000, touched: true } : l
        ));
      }, delay);
    });
    const maxTime = (baseTime + spread + 0.5) * 1000;
    setTimeout(() => setRunning(false), maxTime);
  }

  async function commitResults() {
    if (!selectedEvent || selectedHeat === null) return;
    const timedLanes = lanes.filter(l => l.touched || l.ns);
    const sorted = [...timedLanes].filter(l => l.time !== null).sort((a, b) => (a.time ?? 0) - (b.time ?? 0));

    let success = 0;
    for (const l of lanes) {
      const heatEntry = currentHeatLanes.find((h: any) => (h.laneNumber ?? h.lane) === l.lane);
      if (!(heatEntry as any)?.entryId) continue;
      const place = l.ns || l.dq ? null : (sorted.findIndex(s => s.lane === l.lane) + 1 || null);
      try {
        await setResult.mutateAsync({
          eventId: parseInt(selectedEvent),
          data: {
            entryId: (heatEntry as any).entryId,
            finishTime: (l.ns || l.dq) ? undefined : (l.time ?? undefined),
            place: place ?? undefined,
            dq: l.dq,
            dqCode: "",
            ns: l.ns,
            dnf: false,
            splits: "",
          },
        });
        success++;
      } catch {}
    }
    queryClient.invalidateQueries({ queryKey: getListHeatsQueryKey(parseInt(selectedEvent)) });
    setCommitted(true);
    toast({ title: `Committed ${success} results`, description: `Heat ${selectedHeat} results saved.` });
    if (selectedMeet) {
      broadcastDataChanged(parseInt(selectedMeet));
      autoPushLiveResults(parseInt(selectedMeet)).catch(() => {});
    }
  }

  // Apply a normalized timing event from the hardware bridge to the console.
  const applyTimingEvent = useCallback((e: TimingEvent) => {
    if (e.kind === "start") {
      setLanes(buildLanes(eventLanes));
      setCommitted(false);
      setStartedAt(Date.now());
      setElapsed(0);
      setRunning(true);
    } else if (e.kind === "reset") {
      setRunning(false);
      setElapsed(0);
      setStartedAt(null);
      setLanes(buildLanes(eventLanes));
      setCommitted(false);
    } else if (e.kind === "touch") {
      // Use the device-reported finish time when present; otherwise fall back to
      // the console's own elapsed clock at the moment the touch arrived.
      setLanes((prev) => prev.map((l) =>
        l.lane === e.lane && !l.touched
          ? { ...l, time: e.time ?? l.time ?? null, touched: true }
          : l
      ));
    } else if (e.kind === "split") {
      setLanes((prev) => prev.map((l) =>
        l.lane === e.lane
          ? { ...l, [e.index <= 1 ? "split1" : "split2"]: e.time }
          : l
      ));
    } else if (e.kind === "dq") {
      setLanes((prev) => prev.map((l) => l.lane === e.lane ? { ...l, dq: true, ns: false } : l));
    }
  }, [eventLanes]);

  async function detectPort() {
    if (!hwConfig.ip) { toast({ title: "Enter the bridge IP first", variant: "destructive" }); return; }
    setProbing(true);
    const found = await autoDetectPort(hwConfig.mode, hwConfig.ip);
    setProbing(false);
    if (found) {
      setHwConfig((c) => ({ ...c, port: found }));
      toast({ title: "Timing system found", description: `Reachable on port ${found}.` });
    } else {
      toast({ title: "No timing system found", description: "Checked common ports — verify the bridge is running and on the network.", variant: "destructive" });
    }
  }

  async function connectHardware() {
    if (hwConfig.mode === "manual" || hwConfig.mode === "sim") { setConnStatus("connected"); return; }
    // Only connect when the bridge is actually reachable, so we never show a
    // phantom connection or hammer a closed port with reconnect attempts.
    setProbing(true);
    const reachable = await probeWebSocket(`ws://${hwConfig.ip}:${hwConfig.port}`);
    setProbing(false);
    if (!reachable) {
      setConnStatus("error");
      toast({ title: "Timing system not reachable", description: `Nothing responded at ${hwConfig.ip}:${hwConfig.port}. Try Auto-detect.`, variant: "destructive" });
      return;
    }
    connRef.current?.close();
    const conn = new TimingConnection(
      hwConfig.mode,
      `ws://${hwConfig.ip}:${hwConfig.port}`,
      {
        onEvent: applyTimingEvent,
        onStatus: (s, detail) => {
          setConnStatus(s);
          if (s === "connected") toast({ title: "Hardware connected", description: MODE_LABELS[hwConfig.mode] });
          else if (s === "error") toast({ title: "Connection issue", description: detail || "Check IP/port and hardware.", variant: "destructive" });
        },
      }
    );
    connRef.current = conn;
    conn.connect();
  }

  function disconnect() {
    connRef.current?.close();
    connRef.current = null;
    setConnStatus("idle");
  }

  // Tear the connection down if the operator leaves the console.
  useEffect(() => () => { connRef.current?.close(); connRef.current = null; }, []);

  function saveConfig() {
    localStorage.setItem("timing_hw_config", JSON.stringify(hwConfig));
    toast({ title: "Config saved" });
  }

  const currentEvent = events?.find((e: any) => e.id === parseInt(selectedEvent));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Timing Console</h1>
          <p className="text-muted-foreground text-sm">Live heat timing — manual or hardware interface</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={followRun ? "default" : "outline"}
            onClick={() => setFollowRun((v) => !v)}
            className={followRun ? "bg-cyan-700 hover:bg-cyan-600 border-cyan-700" : ""}
            title="Auto-select event from the Meet Manager Run screen"
          >
            <Radio className={`h-3.5 w-3.5 mr-1 ${followRun ? "animate-pulse" : ""}`} />
            {followRun ? "Following Run Screen" : "Follow Run Screen"}
          </Button>
          {connStatus === "connected"
            ? <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><Wifi className="h-3 w-3 mr-1" />Connected</Badge>
            : connStatus === "connecting" || connStatus === "reconnecting"
            ? <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30"><Radio className="h-3 w-3 mr-1 animate-pulse" />{connStatus === "reconnecting" ? "Reconnecting…" : "Connecting…"}</Badge>
            : connStatus === "error"
            ? <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><WifiOff className="h-3 w-3 mr-1" />Error</Badge>
            : <Badge variant="outline" className="text-slate-400"><WifiOff className="h-3 w-3 mr-1" />Disconnected</Badge>}
          <Badge variant="outline">{MODE_LABELS[hwConfig.mode].split(" ")[0]}</Badge>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="timing"><Timer className="h-4 w-4 mr-1" />Timing</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-1" />Hardware Config</TabsTrigger>
        </TabsList>

        <TabsContent value="timing" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs mb-1 block">Meet</Label>
              <Select value={selectedMeet} onValueChange={v => { setSelectedMeet(v); setSelectedEvent(""); setSelectedHeat(null); }}>
                <SelectTrigger><SelectValue placeholder="Select meet..." /></SelectTrigger>
                <SelectContent>{meets?.map((m: any) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Event</Label>
              <Select value={selectedEvent} onValueChange={v => { setSelectedEvent(v); setSelectedHeat(null); }} disabled={!selectedMeet}>
                <SelectTrigger><SelectValue placeholder="Select event..." /></SelectTrigger>
                <SelectContent>{events?.map((e: any) => <SelectItem key={e.id} value={String(e.id)}>#{e.eventNumber} — {e.distance}{e.stroke} {e.gender}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Heat</Label>
              <Select value={selectedHeat !== null ? String(selectedHeat) : ""} onValueChange={v => setSelectedHeat(parseInt(v))} disabled={!selectedEvent}>
                <SelectTrigger><SelectValue placeholder="Select heat..." /></SelectTrigger>
                <SelectContent>{allHeats.map(h => <SelectItem key={h} value={String(h)}>Heat {h}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {selectedHeat !== null && (
            <div className="space-y-4">
              <Card className="bg-slate-950 border-slate-800">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <div className="text-slate-400 text-sm mb-1">
                        {currentEvent ? `Event #${currentEvent.eventNumber} — ${currentEvent.distance}${currentEvent.stroke} ${currentEvent.gender}` : "—"}
                      </div>
                      <div className="text-white font-bold text-lg">Heat {selectedHeat}</div>
                    </div>
                    <ElapsedClock running={running} elapsed={elapsed} />
                  </div>

                  <div className="flex items-center gap-3 mb-6">
                    {!running ? (
                      <Button onClick={() => { setRunning(true); setElapsed(0); setStartedAt(Date.now()); setLanes(buildLanes(eventLanes)); setCommitted(false); }}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold px-6">
                        <Play className="h-4 w-4 mr-2" /> START
                      </Button>
                    ) : (
                      <Button onClick={() => setRunning(false)} variant="destructive" className="font-bold px-6">
                        <Square className="h-4 w-4 mr-2" /> STOP
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => { setRunning(false); setElapsed(0); setStartedAt(null); setLanes(buildLanes(eventLanes)); setCommitted(false); }}
                      className="border-slate-700 text-slate-300">
                      <RotateCcw className="h-4 w-4 mr-1" /> Reset
                    </Button>
                    {hwConfig.mode === "sim" && (
                      <Button variant="outline" onClick={runSim} className="border-purple-700 text-purple-300">
                        <Zap className="h-4 w-4 mr-1" /> Simulate Heat
                      </Button>
                    )}
                    <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
                      <Keyboard className="h-3 w-3" />
                      Keys: 1-8 = touch lane · Space = start/stop · R = reset
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {lanes.map(l => {
                      const heatEntry = currentHeatLanes.find((h: any) => (h.laneNumber ?? h.lane) === l.lane);
                      const athlete = (heatEntry as any)?.athleteName || "—";
                      const seedTime = (heatEntry as any)?.seedTime ? formatTime((heatEntry as any).seedTime) : "NT";
                      return (
                        <div key={l.lane} className={cn(
                          "flex items-center gap-3 rounded-lg px-4 py-3 border transition-all",
                          l.touched && !l.dq && !l.ns ? "bg-green-950/40 border-green-800" :
                          l.dq ? "bg-red-950/40 border-red-800" :
                          l.ns ? "bg-slate-800/60 border-slate-700" :
                          running ? "bg-slate-900 border-slate-700 hover:border-cyan-700 cursor-pointer" :
                          "bg-slate-900/60 border-slate-800"
                        )}
                        onClick={() => !l.touched && touchLane(l.lane)}
                        >
                          <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-cyan-400 font-black text-lg flex-shrink-0">
                            {l.lane}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm text-white truncate">{athlete}</div>
                            <div className="text-xs text-slate-500">Seed: {seedTime} {(heatEntry as any)?.teamName ? `· ${(heatEntry as any).teamName}` : ""}</div>
                          </div>
                          <div className="font-mono text-xl font-bold min-w-[100px] text-right">
                            {l.ns ? <span className="text-slate-500 text-base">NS</span> :
                             l.dq ? <span className="text-red-400 text-base">DQ</span> :
                             l.time ? <span className="text-cyan-300">{formatTime(l.time)}</span> :
                             <span className="text-slate-600">—:——.——</span>}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {running && !l.touched && (
                              <Button size="sm" onClick={(e) => { e.stopPropagation(); touchLane(l.lane); }}
                                className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs h-8 px-3 font-bold">
                                TOUCH
                              </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); toggleDQ(l.lane); }}
                              className={cn("h-8 px-2 text-xs", l.dq ? "bg-red-900 border-red-700 text-red-300" : "border-slate-700 text-slate-400")}>
                              DQ
                            </Button>
                            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); toggleNS(l.lane); }}
                              className={cn("h-8 px-2 text-xs", l.ns ? "bg-slate-700 border-slate-600 text-slate-200" : "border-slate-700 text-slate-400")}>
                              NS
                            </Button>
                            {l.touched && !l.dq && !l.ns && (
                              <CheckCircle2 className="h-5 w-5 text-green-400" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-xs text-slate-500">
                      {lanes.filter(l => l.touched).length} / {eventLanes} lanes touched
                    </div>
                    <Button onClick={commitResults}
                      disabled={committed || lanes.every(l => !l.touched && !l.ns)}
                      className={cn("font-bold px-8", committed ? "bg-green-700" : "bg-blue-600 hover:bg-blue-500")}>
                      {committed ? <><CheckCircle2 className="h-4 w-4 mr-2" /> Committed</> : "Commit Results →"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">DQ Code Reference (USA Swimming)</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {DQ_CODES.map(d => (
                      <div key={d.code} className="flex items-start gap-2 text-xs">
                        <span className="font-mono font-bold text-red-400 flex-shrink-0">{d.code}</span>
                        <span className="text-muted-foreground">{d.label}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {!selectedHeat && (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center text-muted-foreground">
                <Timer className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>Select a meet, event, and heat above to begin timing.</p>
                <p className="text-xs mt-2">Use keyboard keys 1–8 to touch lanes, Space to start/stop.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Radio className="h-5 w-5" />Hardware Interface Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Timing System Mode</Label>
                <Select value={hwConfig.mode} onValueChange={v => setHwConfig(c => ({ ...c, mode: v as HardwareMode, port: VENDOR_DEFAULT_PORT[v as HardwareMode] || c.port }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(MODE_LABELS) as HardwareMode[]).map(k => (
                      <SelectItem key={k} value={k}>{MODE_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(hwConfig.mode === "cts" || hwConfig.mode === "daktronics" || hwConfig.mode === "omega") && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>IP Address</Label>
                      <Input value={hwConfig.ip} onChange={e => setHwConfig(c => ({ ...c, ip: e.target.value }))} placeholder="192.168.1.100" />
                    </div>
                    <div className="space-y-2">
                      <Label>Port</Label>
                      <Input value={hwConfig.port} onChange={e => setHwConfig(c => ({ ...c, port: e.target.value }))} placeholder="5100" />
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground space-y-1">
                    {hwConfig.mode === "cts" && <>
                      <p className="font-semibold text-foreground">Colorado Timing Systems — CTS Dolphin</p>
                      <p>Default port: 5100. Enable "Network Mode" in CTS Dolphin settings. Ensure firewall allows TCP on the configured port.</p>
                    </>}
                    {hwConfig.mode === "daktronics" && <>
                      <p className="font-semibold text-foreground">Daktronics OmniSport 6000</p>
                      <p>Default port: 5100. Enable "External Control" in OmniSport. The scoreboard output will auto-sync with results.</p>
                    </>}
                    {hwConfig.mode === "omega" && <>
                      <p className="font-semibold text-foreground">Omega ARES 21</p>
                      <p>Default port: 5100. Configure ARES 21 "External Data Output" to this machine's IP. Touch pads connect via the ARES hardware.</p>
                    </>}
                    <p className="pt-1 border-t border-border/50 mt-2">
                      Connects to a WebSocket bridge on the scoring PC. The console reads either structured
                      JSON (<code>{`{type:"touch",lane,time}`}</code>, <code>start</code>, <code>reset</code>,
                      <code>dq</code>, <code>split</code>) or the vendor's line output (e.g. <code>1;58.10</code>).
                      It auto-reconnects if the link drops.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    {connStatus === "idle" || connStatus === "error" ? (
                      <Button onClick={connectHardware} disabled={probing} className="bg-green-600 hover:bg-green-700">
                        <Wifi className="h-4 w-4 mr-2" /> {probing ? "Checking…" : "Connect"}
                      </Button>
                    ) : (
                      <Button onClick={disconnect} variant="destructive">
                        <WifiOff className="h-4 w-4 mr-2" /> {connStatus === "connected" ? "Disconnect" : "Cancel"}
                      </Button>
                    )}
                    <Button variant="outline" onClick={detectPort} disabled={probing}>
                      <Radio className={`h-4 w-4 mr-2 ${probing ? "animate-pulse" : ""}`} /> Auto-detect Port
                    </Button>
                    <Button variant="outline" onClick={saveConfig}>Save Config</Button>
                  </div>
                </>
              )}

              {hwConfig.mode === "manual" && (
                <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
                  <p className="font-semibold">Manual Mode — Keyboard Shortcuts</p>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-muted-foreground">
                    <span><kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">1–8</kbd> Touch lane 1–8</span>
                    <span><kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Space</kbd> Start / Stop clock</span>
                    <span><kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">R</kbd> Reset heat</span>
                    <span>Click lane row to touch that lane</span>
                  </div>
                  <Button onClick={() => { setConnStatus("connected"); saveConfig(); }} className="mt-2">Activate Manual Mode</Button>
                </div>
              )}

              {hwConfig.mode === "sim" && (
                <div className="rounded-lg bg-purple-950/30 border border-purple-800/40 p-4 text-sm">
                  <p className="font-semibold text-purple-300">Simulation Mode</p>
                  <p className="text-muted-foreground mt-1">Auto-generates realistic swim times for all seeded lanes. Use for testing and demonstrations. Click "Simulate Heat" in the Timing tab.</p>
                  <Button onClick={() => { setConnStatus("connected"); saveConfig(); }} className="mt-3 bg-purple-700 hover:bg-purple-600">Activate Simulation</Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Scoreboard Output</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Scoreboard IP</Label>
                  <Input placeholder="192.168.1.50" />
                </div>
                <div className="space-y-2">
                  <Label>Protocol</Label>
                  <Select defaultValue="daktronics">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daktronics">Daktronics OmniSport</SelectItem>
                      <SelectItem value="cts">CTS Scoreboard</SelectItem>
                      <SelectItem value="generic">Generic ASCII</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Results committed in the timing tab will be broadcast to the configured scoreboard address in real time.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
