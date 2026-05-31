import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Maximize2, Minimize2, Clock, ChevronLeft, ChevronRight, RefreshCw,
  Play, Pause, SkipForward, Settings, X, Monitor
} from "lucide-react";
import { useListMeets, useListEvents, useListHeats } from "@/lib/local-store";
import { formatTime } from "@/lib/format-time";

const LOGO_KEY = "swimmanager:clubLogo";
const PLACE_MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const PLACE_COLOR: Record<number, string> = {
  1: "text-yellow-400",
  2: "text-slate-300",
  3: "text-amber-500",
};

const AUTO_ADVANCE_OPTIONS = [
  { label: "Manual only", value: 0 },
  { label: "30 seconds", value: 30 },
  { label: "45 seconds", value: 45 },
  { label: "1 minute", value: 60 },
  { label: "90 seconds", value: 90 },
  { label: "2 minutes", value: 120 },
];

function PaceClock({ fullscreen }: { fullscreen: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setElapsed((e) => e + 0.01), 10);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const reset = () => { setElapsed(0); setRunning(false); };
  const mm = Math.floor(elapsed / 60);
  const ss = Math.floor(elapsed % 60);
  const hh = Math.round((elapsed * 100) % 100);
  const display = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${String(hh).padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-2">
      <div className={`font-mono font-black tracking-widest text-cyan-400 bg-black/40 px-3 py-1 rounded border border-cyan-900 ${fullscreen ? "text-2xl" : "text-lg"}`}>
        <Clock className="inline h-4 w-4 mr-1.5 text-cyan-500" />
        {display}
      </div>
      <Button size="sm" variant="outline" onClick={() => setRunning((r) => !r)}
        className="bg-transparent border-cyan-800 text-cyan-300 hover:bg-cyan-900/40 h-7 text-xs">
        {running ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
      </Button>
      <Button size="sm" variant="ghost" onClick={reset} className="text-slate-400 hover:text-white h-7 text-xs">RST</Button>
    </div>
  );
}

function AutoAdvanceBar({
  interval,
  onAdvance,
  active,
  setActive,
}: {
  interval: number;
  onAdvance: () => void;
  active: boolean;
  setActive: (v: boolean) => void;
}) {
  const [countdown, setCountdown] = useState(interval);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setCountdown(interval);
  }, [interval]);

  useEffect(() => {
    if (active && interval > 0) {
      setCountdown(interval);
      countdownRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            onAdvance();
            return interval;
          }
          return c - 1;
        });
      }, 1000);
    } else {
      if (countdownRef.current) clearInterval(countdownRef.current);
    }
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [active, interval, onAdvance]);

  if (interval === 0) return null;

  const pct = ((interval - countdown) / interval) * 100;

  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 rounded-full bg-cyan-900 overflow-hidden"
        style={{ width: 80 }}
      >
        <div
          className="h-full bg-cyan-400 transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-cyan-400">{countdown}s</span>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setActive(!active)}
        className="h-6 text-[10px] text-cyan-300 hover:text-white px-1.5"
      >
        {active ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
      </Button>
    </div>
  );
}

export default function Scoreboard() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedMeet, setSelectedMeet] = useState<string>("");
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [selectedHeat, setSelectedHeat] = useState<number>(0);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [autoAdvanceInterval, setAutoAdvanceInterval] = useState(0);
  const [autoAdvanceActive, setAutoAdvanceActive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [clubLogo, setClubLogo] = useState<string>(() => localStorage.getItem(LOGO_KEY) ?? "");
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: meets } = useListMeets();
  const { data: events, refetch: refetchEvents } = useListEvents(
    selectedMeet ? parseInt(selectedMeet) : 0,
    { query: { enabled: !!selectedMeet } }
  );
  const { data: heats, refetch: refetchHeats } = useListHeats(
    selectedEvent ? parseInt(selectedEvent) : 0,
    { query: { enabled: !!selectedEvent } }
  );

  const currentHeatData = heats?.[selectedHeat];
  const currentEvent = events?.find((e) => String(e.id) === selectedEvent);
  const totalHeats = heats?.length ?? 0;
  const selectedEventIdx = events?.findIndex((e) => String(e.id) === selectedEvent) ?? -1;
  const seededEvents = events?.filter((e) => e.status === "seeded" || e.status === "completed") ?? [];

  useEffect(() => {
    if (autoRefresh) {
      refreshRef.current = setInterval(() => { refetchHeats(); refetchEvents(); }, 5000);
    } else {
      if (refreshRef.current) clearInterval(refreshRef.current);
    }
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [autoRefresh, refetchHeats, refetchEvents]);

  const advanceHeat = useCallback(() => {
    if (selectedHeat < totalHeats - 1) {
      setSelectedHeat((h) => h + 1);
    } else {
      const nextEventIdx = seededEvents.findIndex((e) => String(e.id) === selectedEvent) + 1;
      if (nextEventIdx < seededEvents.length) {
        setSelectedEvent(String(seededEvents[nextEventIdx].id));
        setSelectedHeat(0);
      } else {
        setAutoAdvanceActive(false);
      }
    }
  }, [selectedHeat, totalHeats, seededEvents, selectedEvent]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const lanes = currentHeatData?.lanes ?? [];
  const sortedLanes = [...lanes].sort((a: any, b: any) => {
    if (a.place && b.place) return a.place - b.place;
    if (a.place) return -1;
    if (b.place) return 1;
    return (a.lane ?? 0) - (b.lane ?? 0);
  });
  const hasResults = lanes.some((l: any) => l.finishTime != null);

  const currentMeet = meets?.find((m) => String(m.id) === selectedMeet);

  const container = isFullscreen
    ? "fixed inset-0 z-50 bg-[#030d1c] text-white flex flex-col overflow-hidden"
    : "flex flex-col space-y-4 h-full";

  return (
    <div className={container}>
      {/* ===== FULLSCREEN HEADER ===== */}
      {isFullscreen ? (
        <div className="shrink-0 flex items-center justify-between px-8 py-4 border-b border-slate-800 bg-[#040e20]">
          {/* Left: Logo + Club */}
          <div className="flex items-center gap-4 min-w-[200px]">
            {clubLogo ? (
              <img src={clubLogo} alt="Club Logo" className="h-12 w-12 object-contain rounded" />
            ) : (
              <div className="h-12 w-12 rounded bg-cyan-900/40 flex items-center justify-center">
                <Monitor className="h-6 w-6 text-cyan-600" />
              </div>
            )}
            <div>
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-widest">SwimManager Pro</div>
              <div className="text-sm text-slate-300 font-semibold">{customTitle || currentMeet?.name || "Live Scoreboard"}</div>
            </div>
          </div>

          {/* Center: Event + Heat */}
          {currentEvent ? (
            <div className="text-center flex-1">
              <div className="text-4xl font-extrabold tracking-tight text-white">
                <span className="text-cyan-400">Event {currentEvent.eventNumber}</span>
                <span className="mx-3 text-slate-600">·</span>
                <span>
                  {currentEvent.gender === "M" ? "Men's" : currentEvent.gender === "F" ? "Women's" : "Mixed"}{" "}
                  {(currentEvent.ageGroup && currentEvent.ageGroup !== "Open") ? currentEvent.ageGroup + " " : ""}
                  {currentEvent.distance}m {currentEvent.stroke}
                </span>
              </div>
              <div className="text-xl text-slate-400 mt-0.5">
                {currentHeatData ? `Heat ${currentHeatData.heatNumber} of ${totalHeats}` : "No heat selected"}
                {hasResults && <Badge className="ml-2 bg-green-700 text-white text-xs">RESULTS IN</Badge>}
              </div>
            </div>
          ) : (
            <div className="text-center flex-1 text-slate-500 text-3xl font-bold">
              {customTitle || currentMeet?.name || "SwimManager Pro"}
            </div>
          )}

          {/* Right: Controls */}
          <div className="flex items-center gap-3 min-w-[200px] justify-end">
            <PaceClock fullscreen />
            {totalHeats > 0 && (
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-white"
                  onClick={() => setSelectedHeat((h) => Math.max(0, h - 1))} disabled={selectedHeat === 0}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-mono text-sm text-slate-300 w-12 text-center">{selectedHeat + 1}/{totalHeats}</span>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-white"
                  onClick={() => setSelectedHeat((h) => Math.min(totalHeats - 1, h + 1))} disabled={selectedHeat >= totalHeats - 1}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
            {autoAdvanceInterval > 0 && (
              <AutoAdvanceBar
                interval={autoAdvanceInterval}
                onAdvance={advanceHeat}
                active={autoAdvanceActive}
                setActive={setAutoAdvanceActive}
              />
            )}
            <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white h-7"
              onClick={() => setIsFullscreen(false)}>
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        /* ===== NORMAL HEADER ===== */
        <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <Monitor className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Scoreboard</h1>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Select value={selectedMeet} onValueChange={(v) => { setSelectedMeet(v); setSelectedEvent(""); setSelectedHeat(0); }}>
              <SelectTrigger className="w-[180px] text-sm">
                <SelectValue placeholder="Select Meet" />
              </SelectTrigger>
              <SelectContent>
                {meets?.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedEvent} onValueChange={(v) => { setSelectedEvent(v); setSelectedHeat(0); }} disabled={!selectedMeet}>
              <SelectTrigger className="w-[210px] text-sm">
                <SelectValue placeholder="Select Event" />
              </SelectTrigger>
              <SelectContent>
                {seededEvents.map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    Evt {e.eventNumber}: {e.gender} {e.distance} {e.stroke}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {totalHeats > 0 && (
              <div className="flex items-center gap-1">
                <Button size="icon" variant="outline" onClick={() => setSelectedHeat((h) => Math.max(0, h - 1))} disabled={selectedHeat === 0}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2 text-sm font-mono">{selectedHeat + 1}/{totalHeats}</span>
                <Button size="icon" variant="outline" onClick={() => setSelectedHeat((h) => Math.min(totalHeats - 1, h + 1))} disabled={selectedHeat >= totalHeats - 1}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Auto-advance control */}
            <Select value={String(autoAdvanceInterval)} onValueChange={(v) => { setAutoAdvanceInterval(parseInt(v)); setAutoAdvanceActive(false); }}>
              <SelectTrigger className="w-[140px] text-sm">
                <SelectValue placeholder="Auto-advance" />
              </SelectTrigger>
              <SelectContent>
                {AUTO_ADVANCE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {autoAdvanceInterval > 0 && selectedEvent && (
              <Button
                size="sm"
                variant={autoAdvanceActive ? "default" : "outline"}
                onClick={() => setAutoAdvanceActive((v) => !v)}
              >
                {autoAdvanceActive ? <Pause className="h-3.5 w-3.5 mr-1" /> : <Play className="h-3.5 w-3.5 mr-1" />}
                {autoAdvanceActive ? "Pause" : "Start"}
              </Button>
            )}

            <Button size="sm" variant={autoRefresh ? "default" : "outline"} onClick={() => setAutoRefresh((r) => !r)}>
              <RefreshCw className={`h-4 w-4 ${autoRefresh ? "animate-spin" : ""}`} />
            </Button>

            <Button size="sm" variant="outline" onClick={() => setShowSettings((v) => !v)}>
              <Settings className="h-4 w-4" />
            </Button>

            <Button size="sm" onClick={toggleFullscreen}>
              <Maximize2 className="h-4 w-4 mr-1" />
              Fullscreen
            </Button>
          </div>
        </div>
      )}

      {/* Settings Panel (normal mode only) */}
      {!isFullscreen && showSettings && (
        <div className="shrink-0 rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Scoreboard Settings</h3>
            <Button size="sm" variant="ghost" onClick={() => setShowSettings(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Custom Display Title</label>
              <Input
                placeholder={currentMeet?.name ?? "Meet name"}
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Club Logo</label>
              <div className="flex items-center gap-2">
                {clubLogo && <img src={clubLogo} alt="logo" className="h-8 w-8 object-contain rounded border" />}
                <label className="cursor-pointer">
                  <span className="text-xs border rounded px-2 py-1 hover:bg-muted">Upload Logo</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const url = ev.target?.result as string;
                        setClubLogo(url);
                        localStorage.setItem(LOGO_KEY, url);
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
                {clubLogo && (
                  <Button size="sm" variant="ghost" className="h-6 text-xs text-destructive"
                    onClick={() => { setClubLogo(""); localStorage.removeItem(LOGO_KEY); }}>
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">Shown in fullscreen / kiosk mode</p>
            </div>
          </div>
        </div>
      )}

      {/* Pace clock (normal mode) */}
      {!isFullscreen && selectedEvent && (
        <div className="shrink-0 bg-slate-900 rounded-lg px-4 py-2 inline-flex">
          <PaceClock fullscreen={false} />
        </div>
      )}

      {/* ===== LANE TABLE ===== */}
      {!selectedMeet ? (
        <div className={`flex-1 flex items-center justify-center ${isFullscreen ? "text-slate-600" : "text-muted-foreground"}`}>
          <div className="text-center space-y-2">
            <Monitor className={`mx-auto mb-3 ${isFullscreen ? "h-16 w-16 text-slate-800" : "h-10 w-10 opacity-30"}`} />
            <div className={`font-bold ${isFullscreen ? "text-3xl" : "text-lg"}`}>No meet selected</div>
            <div className={`text-sm ${isFullscreen ? "text-slate-700" : ""}`}>Select a meet and seeded event above</div>
          </div>
        </div>
      ) : !selectedEvent ? (
        <div className={`flex-1 flex items-center justify-center ${isFullscreen ? "text-slate-600" : "text-muted-foreground"}`}>
          <div className="text-center">
            <div className={`font-bold ${isFullscreen ? "text-3xl" : "text-lg"}`}>
              {seededEvents.length === 0 ? "No seeded events yet" : "Select an event"}
            </div>
            <div className="text-sm mt-1">{seededEvents.length === 0 ? "Seed events in the Seeding tab first" : "Choose a seeded event from the selector"}</div>
          </div>
        </div>
      ) : !currentHeatData ? (
        <div className={`flex-1 flex items-center justify-center ${isFullscreen ? "text-slate-600" : "text-muted-foreground"}`}>
          <div className="text-center">
            <div className={`font-bold ${isFullscreen ? "text-3xl" : "text-lg"}`}>No heats found</div>
            <div className="text-sm">Seed the event first to generate heats</div>
          </div>
        </div>
      ) : (
        <div className={`flex-1 flex flex-col gap-2 overflow-auto ${isFullscreen ? "px-8 pb-4" : "mt-2"}`}>
          {/* Column Headers */}
          <div className={`grid items-center px-4 py-1 text-xs font-bold uppercase tracking-widest ${isFullscreen ? "text-slate-600 grid-cols-12" : "text-muted-foreground grid-cols-12"}`}>
            <div className="col-span-1">Lane</div>
            <div className="col-span-4">Athlete</div>
            <div className="col-span-2">Team</div>
            <div className="col-span-2">Seed</div>
            <div className="col-span-2">Time</div>
            <div className="col-span-1 text-right">Place</div>
          </div>

          {/* Lanes */}
          {sortedLanes.map((lane: any) => {
            const place = lane.place;
            const hasTime = lane.finishTime != null;
            const isDQ = lane.dq;
            const isNS = lane.ns;
            const isDNF = lane.dnf;
            const placeColor = place ? (PLACE_COLOR[place] ?? "text-white") : "";

            const rowBg = isFullscreen
              ? place === 1
                ? "bg-yellow-900/25 border border-yellow-700/40"
                : place === 2
                ? "bg-slate-700/25 border border-slate-600/30"
                : place === 3
                ? "bg-amber-900/25 border border-amber-700/30"
                : "bg-slate-900/50 border border-slate-800/30"
              : place === 1
              ? "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800"
              : "bg-card border border-border";

            return (
              <div
                key={lane.lane}
                className={`grid grid-cols-12 items-center rounded-xl px-4 ${isFullscreen ? "py-4" : "py-2"} ${rowBg} transition-all`}
              >
                {/* Lane */}
                <div className={`col-span-1 font-mono font-black ${isFullscreen ? "text-4xl text-cyan-500" : "text-xl text-primary"}`}>
                  {lane.lane}
                </div>

                {/* Athlete */}
                <div className="col-span-4">
                  {lane.athleteId ? (
                    <div>
                      <div className={`font-bold leading-tight ${isFullscreen ? "text-3xl" : "text-base"}`}>
                        {lane.athleteName ?? "Unknown"}
                      </div>
                      <div className="flex gap-1 mt-0.5">
                        {isDQ && <Badge className="bg-red-700 text-white text-[10px] px-1.5 py-0">DQ</Badge>}
                        {isNS && <Badge className="bg-slate-600 text-white text-[10px] px-1.5 py-0">NS</Badge>}
                        {isDNF && <Badge className="bg-orange-700 text-white text-[10px] px-1.5 py-0">DNF</Badge>}
                      </div>
                    </div>
                  ) : (
                    <span className={`italic ${isFullscreen ? "text-slate-700 text-xl" : "text-muted-foreground"}`}>Empty</span>
                  )}
                </div>

                {/* Team */}
                <div className={`col-span-2 font-mono font-semibold ${isFullscreen ? "text-xl text-slate-400" : "text-sm text-muted-foreground"}`}>
                  {lane.teamName ?? "—"}
                </div>

                {/* Seed time */}
                <div className={`col-span-2 font-mono ${isFullscreen ? "text-xl text-slate-500" : "text-sm text-muted-foreground"}`}>
                  {lane.seedTime ? formatTime(lane.seedTime) : "NT"}
                </div>

                {/* Finish time */}
                <div className={`col-span-2 font-mono font-black ${isFullscreen ? "text-4xl" : "text-xl"} ${
                  hasTime
                    ? (isFullscreen ? "text-yellow-300" : "text-foreground")
                    : (isFullscreen ? "text-slate-800" : "text-muted-foreground/30")
                }`}>
                  {isDQ ? "DQ" : isNS ? "NS" : isDNF ? "DNF" : hasTime ? formatTime(lane.finishTime) : "—"}
                </div>

                {/* Place */}
                <div className={`col-span-1 text-right font-black ${isFullscreen ? "text-5xl" : "text-2xl"} ${placeColor}`}>
                  {place ? (PLACE_MEDAL[place] ?? place) : ""}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer (fullscreen only) */}
      {isFullscreen && (
        <div className="shrink-0 flex items-center justify-between px-8 py-3 border-t border-slate-800/60 bg-[#040e20] text-xs text-slate-700">
          <div className="flex items-center gap-4">
            <span>SwimManager Pro</span>
            {autoAdvanceInterval > 0 && (
              <AutoAdvanceBar
                interval={autoAdvanceInterval}
                onAdvance={advanceHeat}
                active={autoAdvanceActive}
                setActive={setAutoAdvanceActive}
              />
            )}
          </div>
          <div className="flex items-center gap-4">
            {selectedEvent && totalHeats > 0 && (
              <span className="text-slate-500">
                {selectedHeat + 1} / {totalHeats} heats
              </span>
            )}
            <span className="text-slate-600">{new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
