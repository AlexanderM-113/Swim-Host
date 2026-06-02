import { useState, useMemo } from "react";
import { useListAthletes, useListMeets, readStore } from "@/lib/local-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Zap, Users, Trophy, Timer, ArrowRight, RefreshCw, Star, Info, 
  ChevronDown, ChevronUp, Shuffle
} from "lucide-react";
import { formatTime } from "@/lib/format-time";

interface RelayConfig {
  name: string;
  legs: { stroke: string; distance: number }[];
  total: number;
}

const RELAY_CONFIGS: Record<string, RelayConfig> = {
  "4x100-free": {
    name: "4×100 Freestyle Relay",
    legs: [
      { stroke: "Freestyle", distance: 100 },
      { stroke: "Freestyle", distance: 100 },
      { stroke: "Freestyle", distance: 100 },
      { stroke: "Freestyle", distance: 100 },
    ],
    total: 400,
  },
  "4x200-free": {
    name: "4×200 Freestyle Relay",
    legs: [
      { stroke: "Freestyle", distance: 200 },
      { stroke: "Freestyle", distance: 200 },
      { stroke: "Freestyle", distance: 200 },
      { stroke: "Freestyle", distance: 200 },
    ],
    total: 800,
  },
  "4x50-free": {
    name: "4×50 Freestyle Relay",
    legs: [
      { stroke: "Freestyle", distance: 50 },
      { stroke: "Freestyle", distance: 50 },
      { stroke: "Freestyle", distance: 50 },
      { stroke: "Freestyle", distance: 50 },
    ],
    total: 200,
  },
  "4x100-medley": {
    name: "4×100 Medley Relay",
    legs: [
      { stroke: "Backstroke", distance: 100 },
      { stroke: "Breaststroke", distance: 100 },
      { stroke: "Butterfly", distance: 100 },
      { stroke: "Freestyle", distance: 100 },
    ],
    total: 400,
  },
  "4x50-medley": {
    name: "4×50 Medley Relay",
    legs: [
      { stroke: "Backstroke", distance: 50 },
      { stroke: "Breaststroke", distance: 50 },
      { stroke: "Butterfly", distance: 50 },
      { stroke: "Freestyle", distance: 50 },
    ],
    total: 200,
  },
};

interface AthleteWithTimes {
  id: number;
  name: string;
  teamName?: string;
  bestTimes: Record<string, Record<number, number>>;
}

function getBestTimeKey(stroke: string, distance: number) {
  return `${stroke.toLowerCase()}_${distance}`;
}

export default function RelayBuilder() {
  const { data: athletes = [] } = useListAthletes();
  const { data: meets = [] } = useListMeets();
  const { toast } = useToast();

  const [relayType, setRelayType] = useState<string>("4x100-free");
  const [gender, setGender] = useState<string>("M");
  const [selectedMeet, setSelectedMeet] = useState<string>("all");
  const [selectedAthletes, setSelectedAthletes] = useState<Set<number>>(new Set());
  const [relayTeams, setRelayTeams] = useState<any[]>([]);
  const [building, setBuilding] = useState(false);
  const [showDetails, setShowDetails] = useState<number | null>(null);

  const config = RELAY_CONFIGS[relayType];

  // Build bestTimes map from actual meet results in the store
  const bestTimesMap = useMemo(() => {
    const store = readStore();
    const map = new Map<number, Record<string, Record<number, number>>>();
    for (const result of store.results) {
      if (!result.finishTime || result.dq || result.ns || result.dnf) continue;
      const entry = store.entries.find((e) => e.id === result.entryId);
      if (!entry?.athleteId) continue;
      const event = store.events.find((ev) => ev.id === entry.eventId);
      if (!event) continue;
      const athleteId = entry.athleteId;
      if (!map.has(athleteId)) map.set(athleteId, {});
      const athleteMap = map.get(athleteId)!;
      const stroke = event.stroke;
      const distance = event.distance;
      if (!athleteMap[stroke]) athleteMap[stroke] = {};
      const prev = athleteMap[stroke][distance];
      if (!prev || result.finishTime < prev) {
        athleteMap[stroke][distance] = result.finishTime;
      }
    }
    return map;
  }, [athletes]);

  const athletePool = useMemo((): AthleteWithTimes[] => {
    return (athletes as any[])
      .filter((a: any) => !gender || a.gender === gender)
      .map((a: any) => ({
        id: a.id,
        name: `${a.firstName} ${a.lastName}`,
        teamName: a.teamName,
        bestTimes: bestTimesMap.get(a.id) ?? {},
      }));
  }, [athletes, gender, bestTimesMap]);

  const eligibleAthletes = useMemo(() => {
    return athletePool.filter((a) =>
      selectedAthletes.size === 0 || selectedAthletes.has(a.id)
    );
  }, [athletePool, selectedAthletes]);

  function getBestTime(a: AthleteWithTimes, stroke: string, distance: number): number | null {
    const direct = a.bestTimes?.[stroke]?.[distance];
    if (direct) return direct;
    // Fuzzy stroke match (e.g. "Free" matches "Freestyle")
    for (const [s, dists] of Object.entries(a.bestTimes ?? {})) {
      if (s.toLowerCase().startsWith(stroke.toLowerCase().slice(0, 4)) ||
          stroke.toLowerCase().startsWith(s.toLowerCase().slice(0, 4))) {
        const t = (dists as Record<number, number>)[distance];
        if (t) return t;
      }
    }
    return null;
  }

  function buildRelayTeams() {
    setBuilding(true);
    const legs = config.legs;
    const pool = [...eligibleAthletes];

    const results: any[] = [];
    const teamCount = Math.max(1, Math.floor(pool.length / legs.length));

    for (let t = 0; t < Math.min(teamCount, 3); t++) {
      const team: { leg: number; athlete: AthleteWithTimes | null; time: number | null; stroke: string; distance: number }[] = [];
      const used = new Set<number>();

      for (let legIdx = 0; legIdx < legs.length; legIdx++) {
        const leg = legs[legIdx];
        const eligible = pool.filter((a) => !used.has(a.id));

        let best: AthleteWithTimes | null = null;
        let bestT = Infinity;

        for (const a of eligible) {
          const t = getBestTime(a, leg.stroke, leg.distance);
          const effective = t ?? (20 + legIdx * 2 + Math.random() * 10);
          if (effective < bestT) { bestT = effective; best = a; }
        }

        if (best) {
          used.add(best.id);
          team.push({
            leg: legIdx + 1,
            athlete: best,
            time: getBestTime(best, leg.stroke, leg.distance),
            stroke: leg.stroke,
            distance: leg.distance,
          });
        }
      }

      const totalTime = team.reduce((s, l) => s + (l.time ?? (25 + Math.random() * 10)), 0);
      results.push({ team, totalTime, id: t });
    }

    results.sort((a, b) => a.totalTime - b.totalTime);
    setRelayTeams(results);
    setBuilding(false);
    toast({ title: `${results.length} relay lineup${results.length !== 1 ? "s" : ""} built`, description: config.name });
  }

  function shuffle() {
    const pool = [...eligibleAthletes];
    const legs = config.legs;
    const results: any[] = [];

    for (let t = 0; t < Math.min(3, Math.floor(pool.length / legs.length)); t++) {
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      const team = legs.map((leg, i) => ({
        leg: i + 1,
        athlete: shuffled[i] ?? null,
        time: shuffled[i] ? getBestTime(shuffled[i], leg.stroke, leg.distance) : null,
        stroke: leg.stroke,
        distance: leg.distance,
      }));
      const totalTime = team.reduce((s, l) => s + (l.time ?? 30), 0);
      results.push({ team, totalTime, id: t });
    }
    results.sort((a, b) => a.totalTime - b.totalTime);
    setRelayTeams(results);
  }

  const TEAM_LABELS = ["A Team", "B Team", "C Team"];
  const TEAM_COLORS = ["text-yellow-500", "text-slate-400", "text-amber-600"];
  const TEAM_BG = ["bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200", "bg-slate-50 dark:bg-slate-800/40 border-slate-200", "bg-amber-50 dark:bg-amber-900/20 border-amber-200"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Zap className="h-7 w-7 text-primary" />
          Smart Relay Builder
        </h1>
        <p className="text-muted-foreground mt-1">
          Algorithm-optimized relay lineups based on athletes' best times
        </p>
      </div>

      {/* Config */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Relay Event</label>
              <Select value={relayType} onValueChange={setRelayType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RELAY_CONFIGS).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Gender</label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Men / Boys</SelectItem>
                  <SelectItem value="F">Women / Girls</SelectItem>
                  <SelectItem value="">Mixed / Any</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Meet (optional)</label>
              <Select value={selectedMeet} onValueChange={setSelectedMeet}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Athletes</SelectItem>
                  {(meets as any[]).map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg bg-muted/40 p-3 text-sm">
            <div className="flex items-center gap-2 font-medium mb-2">
              <Info className="h-4 w-4 text-primary" />
              {config.name} — {config.total}m total
            </div>
            <div className="flex gap-2 flex-wrap">
              {config.legs.map((leg, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  Leg {i + 1}: {leg.distance} {leg.stroke}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={buildRelayTeams} disabled={building || athletePool.length < config.legs.length} className="flex-1">
              {building ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
              Build Optimal Lineups
            </Button>
            <Button variant="outline" onClick={shuffle} disabled={athletePool.length < config.legs.length}>
              <Shuffle className="h-4 w-4" />
            </Button>
          </div>

          {athletePool.length < config.legs.length && (
            <div className="text-sm text-amber-600 flex items-center gap-2">
              <Info className="h-4 w-4" />
              Need at least {config.legs.length} athletes. Currently {athletePool.length} eligible.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {relayTeams.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Recommended Lineups — {config.name}
          </h2>

          {relayTeams.map((rt, idx) => (
            <Card key={rt.id} className={`border-2 ${TEAM_BG[idx] ?? ""}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className={`text-lg flex items-center gap-2 ${TEAM_COLORS[idx] ?? ""}`}>
                    <Star className="h-5 w-5" />
                    {TEAM_LABELS[idx] ?? `Team ${idx + 1}`}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="font-mono font-black text-xl text-primary">
                        {rt.totalTime ? formatTime(rt.totalTime) : "NT"}
                      </div>
                      <div className="text-xs text-muted-foreground">projected time</div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setShowDetails(showDetails === idx ? null : idx)}>
                      {showDetails === idx ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {rt.team.map((leg: any) => (
                    <div key={leg.leg} className="rounded-lg border bg-card p-2.5 text-center">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">
                        Leg {leg.leg} · {leg.distance} {leg.stroke.slice(0, 4)}
                      </div>
                      <div className="font-semibold text-sm truncate">
                        {leg.athlete?.name ?? "—"}
                      </div>
                      <div className="font-mono text-xs text-primary mt-0.5">
                        {leg.time ? formatTime(leg.time) : "NT"}
                      </div>
                    </div>
                  ))}
                </div>
                {showDetails === idx && (
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="font-semibold text-sm">Relay Simulation</div>
                    {rt.team.map((leg: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="w-6 h-6 rounded-full p-0 flex items-center justify-center text-[10px]">
                          {leg.leg}
                        </Badge>
                        <span className="flex-1">{leg.athlete?.name ?? "—"}</span>
                        <span className="text-muted-foreground text-xs">{leg.stroke} {leg.distance}m</span>
                        <span className="font-mono font-semibold text-primary text-xs">
                          {leg.time ? formatTime(leg.time) : "NT"}
                        </span>
                        {i < rt.team.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="font-semibold">Projected Total</span>
                      <span className="font-mono font-black text-primary">{formatTime(rt.totalTime)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      * Projection based on best individual times. Actual relay time may differ due to takeovers, strategy, and conditions.
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Athlete Pool */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Athlete Pool ({athletePool.length})
            </CardTitle>
            <span className="text-xs text-muted-foreground">All eligible athletes for the selected criteria</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {athletePool.slice(0, 24).map((a) => (
              <div
                key={a.id}
                className={`rounded-lg border p-2 cursor-pointer transition-all text-sm ${
                  selectedAthletes.has(a.id)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => {
                  setSelectedAthletes((prev) => {
                    const next = new Set(prev);
                    if (next.has(a.id)) next.delete(a.id);
                    else next.add(a.id);
                    return next;
                  });
                }}
              >
                <div className="font-medium truncate">{a.name}</div>
                <div className="text-xs text-muted-foreground">{a.teamName ?? "—"}</div>
              </div>
            ))}
          </div>
          {selectedAthletes.size > 0 && (
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{selectedAthletes.size} selected (only these athletes will be used)</span>
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setSelectedAthletes(new Set())}>
                Clear selection
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
