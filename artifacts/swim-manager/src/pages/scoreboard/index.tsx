import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Maximize2, Minimize2, Clock, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useListMeets, useListEvents, useListHeats } from "@workspace/api-client-react";
import { formatTime } from "@/lib/format-time";

const PLACE_MEDAL: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

const PLACE_COLOR: Record<number, string> = {
  1: "text-yellow-400",
  2: "text-slate-300",
  3: "text-amber-500",
};

function PaceClock() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setElapsed((e) => e + 0.01), 10);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const reset = () => { setElapsed(0); setRunning(false); };

  const mm = Math.floor(elapsed / 60);
  const ss = Math.floor(elapsed % 60);
  const hh = Math.round((elapsed * 100) % 100);
  const display = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${String(hh).padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-3">
      <div className="font-mono text-2xl font-black tracking-widest text-cyan-400 bg-black/40 px-4 py-1 rounded border border-cyan-900">
        <Clock className="inline h-5 w-5 mr-2 text-cyan-500" />
        {display}
      </div>
      <Button size="sm" variant="outline" onClick={() => setRunning((r) => !r)}
        className="bg-transparent border-cyan-800 text-cyan-300 hover:bg-cyan-900/40">
        {running ? "STOP" : "START"}
      </Button>
      <Button size="sm" variant="ghost" onClick={reset}
        className="text-slate-400 hover:text-white">
        RESET
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

  useEffect(() => {
    if (autoRefresh) {
      refreshRef.current = setInterval(() => {
        refetchHeats();
        refetchEvents();
      }, 5000);
    } else {
      if (refreshRef.current) clearInterval(refreshRef.current);
    }
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [autoRefresh, refetchHeats, refetchEvents]);

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

  const container = isFullscreen
    ? "fixed inset-0 z-50 bg-[#040d1a] text-white flex flex-col p-6 overflow-hidden"
    : "flex flex-col space-y-4 h-full";

  const hasResults = lanes.some((l: any) => l.finishTime != null);

  return (
    <div className={container}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          {currentEvent ? (
            <>
              <h1 className={`font-extrabold tracking-tight ${isFullscreen ? "text-4xl" : "text-2xl"}`}>
                <span className="text-cyan-400">Event {currentEvent.eventNumber}</span>
                <span className="mx-2 text-slate-400">·</span>
                <span>{currentEvent.gender === "M" ? "Men's" : currentEvent.gender === "F" ? "Women's" : "Mixed"}{" "}
                {currentEvent.distance}m {currentEvent.stroke}</span>
              </h1>
              <p className={`mt-0.5 ${isFullscreen ? "text-xl text-slate-400" : "text-sm text-muted-foreground"}`}>
                {currentHeatData ? `Heat ${currentHeatData.heatNumber} of ${totalHeats}` : "No heat selected"}
                {hasResults && <Badge className="ml-2 bg-green-700 text-white text-[10px]">RESULTS IN</Badge>}
              </p>
            </>
          ) : (
            <h1 className={`font-extrabold tracking-tight ${isFullscreen ? "text-4xl text-slate-500" : "text-2xl text-muted-foreground"}`}>
              Scoreboard
            </h1>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isFullscreen && <PaceClock />}

          {!isFullscreen && (
            <>
              <Select value={selectedMeet} onValueChange={(v) => { setSelectedMeet(v); setSelectedEvent(""); setSelectedHeat(0); }}>
                <SelectTrigger className="w-[200px] text-sm">
                  <SelectValue placeholder="Select Meet" />
                </SelectTrigger>
                <SelectContent>
                  {meets?.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedEvent} onValueChange={(v) => { setSelectedEvent(v); setSelectedHeat(0); }}
                disabled={!selectedMeet}>
                <SelectTrigger className="w-[220px] text-sm">
                  <SelectValue placeholder="Select Event" />
                </SelectTrigger>
                <SelectContent>
                  {events?.filter((e) => e.status === "seeded" || e.status === "completed").map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      Evt {e.eventNumber}: {e.gender} {e.distance} {e.stroke}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

          {/* Heat nav */}
          {totalHeats > 0 && (
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" onClick={() => setSelectedHeat((h) => Math.max(0, h - 1))} disabled={selectedHeat === 0}
                className={isFullscreen ? "bg-slate-800 border-slate-700 text-white hover:bg-slate-700" : ""}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className={`px-2 text-sm font-mono ${isFullscreen ? "text-white" : ""}`}>
                {selectedHeat + 1} / {totalHeats}
              </span>
              <Button size="icon" variant="outline" onClick={() => setSelectedHeat((h) => Math.min(totalHeats - 1, h + 1))} disabled={selectedHeat >= totalHeats - 1}
                className={isFullscreen ? "bg-slate-800 border-slate-700 text-white hover:bg-slate-700" : ""}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          <Button size="sm" variant={autoRefresh ? "default" : "outline"} onClick={() => setAutoRefresh((r) => !r)}
            title="Auto-refresh every 5 seconds"
            className={isFullscreen ? "bg-slate-800 border-slate-700 text-white hover:bg-slate-700" : ""}>
            <RefreshCw className={`h-4 w-4 ${autoRefresh ? "animate-spin" : ""}`} />
          </Button>

          <Button size="sm" variant={isFullscreen ? "secondary" : "default"} onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 className="h-4 w-4 mr-1" /> : <Maximize2 className="h-4 w-4 mr-1" />}
            {isFullscreen ? "Exit" : "Fullscreen"}
          </Button>
        </div>
      </div>

      {/* Pace clock in non-fullscreen */}
      {!isFullscreen && selectedEvent && (
        <div className="shrink-0">
          <PaceClock />
        </div>
      )}

      {/* Lane table */}
      {!selectedMeet ? (
        <div className={`flex-1 flex items-center justify-center ${isFullscreen ? "text-slate-600" : "text-muted-foreground"}`}>
          <div className="text-center space-y-2">
            <div className={`font-bold ${isFullscreen ? "text-2xl" : "text-lg"}`}>No meet selected</div>
            <div className={`text-sm ${isFullscreen ? "text-slate-700" : ""}`}>Select a meet and event to display the scoreboard</div>
          </div>
        </div>
      ) : !selectedEvent ? (
        <div className={`flex-1 flex items-center justify-center ${isFullscreen ? "text-slate-600" : "text-muted-foreground"}`}>
          <div className="text-center">
            <div className={`font-bold ${isFullscreen ? "text-2xl" : "text-lg"}`}>Select an event</div>
          </div>
        </div>
      ) : !currentHeatData ? (
        <div className={`flex-1 flex items-center justify-center ${isFullscreen ? "text-slate-600" : "text-muted-foreground"}`}>
          <div className="text-center">
            <div className={`font-bold ${isFullscreen ? "text-2xl" : "text-lg"}`}>No heats found</div>
            <div className="text-sm">Seed the event first</div>
          </div>
        </div>
      ) : (
        <div className={`flex-1 flex flex-col gap-2 overflow-auto ${isFullscreen ? "mt-4" : "mt-2"}`}>
          {/* Column headers */}
          <div className={`grid grid-cols-12 px-4 py-1 text-xs font-bold uppercase tracking-widest ${isFullscreen ? "text-slate-500" : "text-muted-foreground"}`}>
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
                ? "bg-yellow-900/30 border border-yellow-700/40"
                : place === 2
                ? "bg-slate-700/30 border border-slate-600/40"
                : place === 3
                ? "bg-amber-900/30 border border-amber-700/40"
                : "bg-slate-900/60 border border-slate-800/40"
              : place === 1
              ? "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800"
              : "bg-card border border-border";

            return (
              <div
                key={lane.lane}
                className={`grid grid-cols-12 items-center rounded-lg px-4 ${isFullscreen ? "py-3" : "py-2"} ${rowBg}`}
              >
                {/* Lane */}
                <div className={`col-span-1 font-mono font-black ${isFullscreen ? "text-3xl text-cyan-500" : "text-xl text-primary"}`}>
                  {lane.lane}
                </div>

                {/* Athlete */}
                <div className="col-span-4">
                  {lane.athleteId ? (
                    <div>
                      <div className={`font-bold ${isFullscreen ? "text-2xl" : "text-base"}`}>
                        {lane.athleteName ?? "Unknown"}
                      </div>
                      {isDQ && <Badge className="mt-0.5 bg-red-700 text-white text-[10px]">DQ</Badge>}
                      {isNS && <Badge className="mt-0.5 bg-slate-600 text-white text-[10px]">NS</Badge>}
                      {isDNF && <Badge className="mt-0.5 bg-orange-700 text-white text-[10px]">DNF</Badge>}
                    </div>
                  ) : (
                    <span className={`italic ${isFullscreen ? "text-slate-600" : "text-muted-foreground"}`}>Empty</span>
                  )}
                </div>

                {/* Team */}
                <div className={`col-span-2 font-mono ${isFullscreen ? "text-lg text-slate-400" : "text-sm text-muted-foreground"}`}>
                  {lane.teamName ?? "-"}
                </div>

                {/* Seed time */}
                <div className={`col-span-2 font-mono ${isFullscreen ? "text-lg text-slate-400" : "text-sm text-muted-foreground"}`}>
                  {lane.seedTime ? formatTime(lane.seedTime) : "NT"}
                </div>

                {/* Finish time */}
                <div className={`col-span-2 font-mono font-bold ${isFullscreen ? "text-3xl" : "text-lg"} ${hasTime ? (isFullscreen ? "text-yellow-300" : "text-foreground") : (isFullscreen ? "text-slate-700" : "text-muted-foreground/40")}`}>
                  {isDQ ? "DQ" : isNS ? "NS" : isDNF ? "DNF" : hasTime ? formatTime(lane.finishTime) : "—"}
                </div>

                {/* Place */}
                <div className={`col-span-1 text-right font-black ${isFullscreen ? "text-4xl" : "text-2xl"} ${placeColor}`}>
                  {place ? (PLACE_MEDAL[place] ?? place) : ""}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer bar in fullscreen */}
      {isFullscreen && (
        <div className="shrink-0 flex items-center justify-between pt-3 border-t border-slate-800 text-xs text-slate-600">
          <span>SwimManager Pro — Scoreboard</span>
          <span>{new Date().toLocaleTimeString()}</span>
        </div>
      )}
    </div>
  );
}
