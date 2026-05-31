import { useState, useEffect, useMemo } from "react";
import { useListAthletes } from "@/lib/local-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Heart, Moon, Zap, Activity, AlertTriangle, CheckCircle, 
  AlertCircle, User, Calendar, ChevronRight, Edit3, BarChart2
} from "lucide-react";
import { format } from "date-fns";

interface ReadinessEntry {
  athleteId: number;
  date: string;
  sleep: number;
  energy: number;
  soreness: number;
  workoutCompletion: number;
  attendance: number;
  hrv?: number;
  injured: boolean;
  notes: string;
}

interface ReadinessScore {
  score: number;
  level: "green" | "yellow" | "red";
  label: string;
  emoji: string;
}

const STORAGE_KEY = "swimmanager:readiness";

function readAll(): ReadinessEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); } catch { return []; }
}

function saveAll(data: ReadinessEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function calcScore(e: ReadinessEntry): ReadinessScore {
  if (e.injured) return { score: 0, level: "red", label: "Injured — Do Not Race", emoji: "🚨" };
  const score =
    e.sleep * 10 +
    e.energy * 10 +
    (10 - e.soreness) * 8 +
    e.workoutCompletion * 0.4 +
    e.attendance * 0.3;
  const pct = Math.min(100, score);
  if (pct >= 75) return { score: pct, level: "green", label: "Race Ready", emoji: "🟢" };
  if (pct >= 50) return { score: pct, level: "yellow", label: "Moderate Fatigue", emoji: "🟡" };
  return { score: pct, level: "red", label: "Elevated Risk", emoji: "🔴" };
}

const LEVEL_STYLE: Record<string, string> = {
  green: "border-green-400 bg-green-50 dark:bg-green-900/20",
  yellow: "border-amber-400 bg-amber-50 dark:bg-amber-900/20",
  red: "border-red-400 bg-red-50 dark:bg-red-900/20",
};

const LEVEL_BADGE: Record<string, string> = {
  green: "bg-green-600 text-white",
  yellow: "bg-amber-500 text-white",
  red: "bg-red-600 text-white",
};

function ScoreDial({ score, level }: { score: number; level: string }) {
  const color = level === "green" ? "#16a34a" : level === "yellow" ? "#f59e0b" : "#dc2626";
  const r = 40;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" className="rotate-[-90deg]">
      <circle cx="50" cy="50" r={r} stroke="#e5e7eb" strokeWidth="10" fill="none" />
      <circle
        cx="50" cy="50" r={r}
        stroke={color} strokeWidth="10" fill="none"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      <text x="50" y="55" textAnchor="middle" className="rotate-90" style={{ fill: color, fontSize: "22px", fontWeight: "bold", transform: "rotate(90deg)", transformOrigin: "50px 50px" }}>
        {Math.round(score)}
      </text>
    </svg>
  );
}

function CheckInDialog({
  open, onClose, athlete, existing, onSave,
}: {
  open: boolean;
  onClose: () => void;
  athlete: any;
  existing?: ReadinessEntry;
  onSave: (e: ReadinessEntry) => void;
}) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [form, setForm] = useState<ReadinessEntry>({
    athleteId: athlete?.id ?? 0,
    date: today,
    sleep: existing?.sleep ?? 7,
    energy: existing?.energy ?? 7,
    soreness: existing?.soreness ?? 3,
    workoutCompletion: existing?.workoutCompletion ?? 80,
    attendance: existing?.attendance ?? 90,
    hrv: existing?.hrv,
    injured: existing?.injured ?? false,
    notes: existing?.notes ?? "",
  });

  function set(k: keyof ReadinessEntry, v: any) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const preview = calcScore(form);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Daily Check-In — {athlete?.firstName} {athlete?.lastName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="flex justify-center mb-2">
            <div className="text-center">
              <ScoreDial score={preview.score} level={preview.level} />
              <div className={`text-xs font-semibold mt-1 ${preview.level === "green" ? "text-green-600" : preview.level === "yellow" ? "text-amber-600" : "text-red-600"}`}>
                {preview.emoji} {preview.label}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium flex items-center gap-1.5"><Moon className="h-3.5 w-3.5" /> Sleep Quality</label>
              <div className="flex items-center gap-2 mt-2">
                <Slider min={1} max={10} step={1} value={[form.sleep]} onValueChange={([v]) => set("sleep", v)} />
                <span className="w-6 text-sm font-mono">{form.sleep}</span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" /> Energy Level</label>
              <div className="flex items-center gap-2 mt-2">
                <Slider min={1} max={10} step={1} value={[form.energy]} onValueChange={([v]) => set("energy", v)} />
                <span className="w-6 text-sm font-mono">{form.energy}</span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> Muscle Soreness</label>
              <div className="flex items-center gap-2 mt-2">
                <Slider min={1} max={10} step={1} value={[form.soreness]} onValueChange={([v]) => set("soreness", v)} />
                <span className="w-6 text-sm font-mono">{form.soreness}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">1 = no soreness, 10 = very sore</p>
            </div>
            <div>
              <label className="text-sm font-medium flex items-center gap-1.5"><Heart className="h-3.5 w-3.5" /> HRV (bpm, optional)</label>
              <Input
                type="number"
                className="mt-2 h-8"
                placeholder="e.g. 65"
                value={form.hrv ?? ""}
                onChange={(e) => set("hrv", e.target.value ? parseFloat(e.target.value) : undefined)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Workout Completion (%)</label>
              <div className="flex items-center gap-2 mt-2">
                <Slider min={0} max={100} step={5} value={[form.workoutCompletion]} onValueChange={([v]) => set("workoutCompletion", v)} />
                <span className="w-8 text-sm font-mono">{form.workoutCompletion}%</span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Attendance Rate (%)</label>
              <div className="flex items-center gap-2 mt-2">
                <Slider min={0} max={100} step={5} value={[form.attendance]} onValueChange={([v]) => set("attendance", v)} />
                <span className="w-8 text-sm font-mono">{form.attendance}%</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="injured"
              checked={form.injured}
              onChange={(e) => set("injured", e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="injured" className="text-sm font-medium text-red-600 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Mark as injured / not available
            </label>
          </div>

          <div>
            <label className="text-sm font-medium">Notes</label>
            <Input
              className="mt-1"
              placeholder="e.g. Tight shoulder, tired from travel…"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { onSave(form); onClose(); }}>Save Check-In</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AthleteReadiness() {
  const { data: athletes = [] } = useListAthletes();
  const { toast } = useToast();

  const [entries, setEntries] = useState<ReadinessEntry[]>([]);
  const [checkInAthlete, setCheckInAthlete] = useState<any | null>(null);
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const today = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    setEntries(readAll());
  }, []);

  function saveEntry(e: ReadinessEntry) {
    const all = readAll();
    const idx = all.findIndex((x) => x.athleteId === e.athleteId && x.date === e.date);
    const updated = idx >= 0 ? all.map((x, i) => i === idx ? e : x) : [...all, e];
    saveAll(updated);
    setEntries(updated);
    toast({ title: "Check-in saved", description: `${format(new Date(), "MMM d")} readiness recorded.` });
  }

  const todayEntries = useMemo(() => {
    const map = new Map<number, ReadinessEntry>();
    entries.filter((e) => e.date === today).forEach((e) => map.set(e.athleteId, e));
    return map;
  }, [entries, today]);

  const athleteScores = useMemo(() => {
    return (athletes as any[]).map((a) => {
      const entry = todayEntries.get(a.id);
      const score = entry ? calcScore(entry) : null;
      return { athlete: a, entry, score };
    }).sort((a, b) => {
      if (!a.score && !b.score) return 0;
      if (!a.score) return 1;
      if (!b.score) return -1;
      return b.score.score - a.score.score;
    });
  }, [athletes, todayEntries]);

  const filtered = useMemo(() => {
    if (filterLevel === "all") return athleteScores;
    if (filterLevel === "none") return athleteScores.filter((r) => !r.score);
    return athleteScores.filter((r) => r.score?.level === filterLevel);
  }, [athleteScores, filterLevel]);

  const counts = useMemo(() => ({
    green: athleteScores.filter((r) => r.score?.level === "green").length,
    yellow: athleteScores.filter((r) => r.score?.level === "yellow").length,
    red: athleteScores.filter((r) => r.score?.level === "red").length,
    none: athleteScores.filter((r) => !r.score).length,
  }), [athleteScores]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Heart className="h-7 w-7 text-primary" />
            Athlete Readiness
          </h1>
          <p className="text-muted-foreground mt-1">
            Daily check-ins tracking sleep, energy, soreness, attendance, and injury status
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-green-600 text-white">{counts.green} Race Ready</Badge>
          <Badge className="bg-amber-500 text-white">{counts.yellow} Moderate</Badge>
          <Badge className="bg-red-600 text-white">{counts.red} High Risk</Badge>
        </div>
      </div>

      {/* Filter + Date */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          Today: {format(new Date(), "EEEE, MMMM d")}
        </div>
        <Select value={filterLevel} onValueChange={setFilterLevel}>
          <SelectTrigger className="w-[160px] h-8">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Athletes</SelectItem>
            <SelectItem value="green">🟢 Race Ready</SelectItem>
            <SelectItem value="yellow">🟡 Moderate</SelectItem>
            <SelectItem value="red">🔴 High Risk</SelectItem>
            <SelectItem value="none">No check-in</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(({ athlete, entry, score }) => (
          <Card
            key={athlete.id}
            className={`cursor-pointer hover:shadow-md transition-all border-2 ${score ? LEVEL_STYLE[score.level] : "border-border"}`}
            onClick={() => setCheckInAthlete(athlete)}
          >
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{athlete.firstName} {athlete.lastName}</div>
                    <div className="text-xs text-muted-foreground">{(athlete as any).teamName ?? "—"}</div>
                  </div>
                </div>
                {score ? (
                  <Badge className={`text-[10px] ${LEVEL_BADGE[score.level]}`}>
                    {score.emoji} {score.label}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">No check-in</Badge>
                )}
              </div>

              {entry ? (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-3 gap-1 text-center">
                    <div className="rounded bg-background/60 p-1.5">
                      <Moon className="h-3 w-3 mx-auto text-indigo-400 mb-0.5" />
                      <div className="text-[11px] font-bold">{entry.sleep}/10</div>
                      <div className="text-[9px] text-muted-foreground">Sleep</div>
                    </div>
                    <div className="rounded bg-background/60 p-1.5">
                      <Zap className="h-3 w-3 mx-auto text-yellow-400 mb-0.5" />
                      <div className="text-[11px] font-bold">{entry.energy}/10</div>
                      <div className="text-[9px] text-muted-foreground">Energy</div>
                    </div>
                    <div className="rounded bg-background/60 p-1.5">
                      <Activity className="h-3 w-3 mx-auto text-red-400 mb-0.5" />
                      <div className="text-[11px] font-bold">{entry.soreness}/10</div>
                      <div className="text-[9px] text-muted-foreground">Soreness</div>
                    </div>
                  </div>
                  {entry.injured && (
                    <div className="text-[11px] text-red-600 font-semibold flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Injured — Not Available
                    </div>
                  )}
                  {entry.notes && (
                    <div className="text-[11px] text-muted-foreground italic truncate">"{entry.notes}"</div>
                  )}
                </div>
              ) : (
                <div className="text-center py-2 text-sm text-muted-foreground">
                  <Edit3 className="h-4 w-4 mx-auto mb-1 opacity-50" />
                  Tap to log today's check-in
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Historical */}
      {entries.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart2 className="h-4 w-4" />
              Recent History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...entries].reverse().slice(0, 15).map((e, i) => {
                const a = (athletes as any[]).find((x) => x.id === e.athleteId);
                const s = calcScore(e);
                return (
                  <div key={i} className="flex items-center gap-3 py-1.5 border-b last:border-0 text-sm">
                    <span className="text-muted-foreground text-xs w-24 shrink-0">{format(new Date(e.date + "T00:00:00"), "MMM d")}</span>
                    <span className="font-medium">{a ? `${a.firstName} ${a.lastName}` : "Unknown"}</span>
                    <Badge className={`text-[10px] ml-auto ${LEVEL_BADGE[s.level]}`}>{s.emoji} {s.label}</Badge>
                    <span className="font-mono text-xs text-primary">{Math.round(s.score)}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {checkInAthlete && (
        <CheckInDialog
          open={!!checkInAthlete}
          onClose={() => setCheckInAthlete(null)}
          athlete={checkInAthlete}
          existing={todayEntries.get(checkInAthlete.id)}
          onSave={saveEntry}
        />
      )}
    </div>
  );
}
