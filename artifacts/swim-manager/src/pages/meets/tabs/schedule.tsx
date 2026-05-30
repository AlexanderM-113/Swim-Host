import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListEvents, useListSessions } from "@/lib/local-store";
import { Clock, Calendar, ChevronDown, ChevronUp, Printer, AlertCircle } from "lucide-react";

interface ScheduleConfig {
  sessionStartTime: string;
  warmupDuration: number;
  avgTimePerHeat: number;
  breakBetweenEvents: number;
  lanesPerHeat: number;
}

const DEFAULT_CONFIG: ScheduleConfig = {
  sessionStartTime: "09:00",
  warmupDuration: 60,
  avgTimePerHeat: 4,
  breakBetweenEvents: 2,
  lanesPerHeat: 8,
};

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const totalMinutes = h * 60 + m + Math.round(minutes);
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;
  const period = newH >= 12 ? "PM" : "AM";
  const displayH = newH > 12 ? newH - 12 : newH === 0 ? 12 : newH;
  return `${displayH}:${String(newM).padStart(2, "0")} ${period}`;
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${Math.round(mins)}m`;
  return `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`;
}

export default function MeetSchedule({ meetId }: { meetId: number }) {
  const { data: events = [], isLoading } = useListEvents(meetId, { query: { enabled: !!meetId } });
  const { data: sessions = [] } = useListSessions(meetId, { query: { enabled: !!meetId } });
  const [config, setConfig] = useState<ScheduleConfig>(DEFAULT_CONFIG);
  const [showConfig, setShowConfig] = useState(true);

  const schedule = useMemo(() => {
    if (!events.length) return [];
    const sorted = [...(events as any[])].sort((a, b) => (a.eventNumber ?? 0) - (b.eventNumber ?? 0));
    let minutesElapsed = config.warmupDuration;

    return sorted.map(evt => {
      const entriesCount = evt.entryCount ?? 0;
      const heats = Math.max(1, Math.ceil(entriesCount / config.lanesPerHeat));
      const durationMins = heats * config.avgTimePerHeat + config.breakBetweenEvents;
      const projectedStart = addMinutes(config.sessionStartTime, minutesElapsed);
      const projectedEnd = addMinutes(config.sessionStartTime, minutesElapsed + heats * config.avgTimePerHeat);
      minutesElapsed += durationMins;
      return { ...evt, heats, durationMins: heats * config.avgTimePerHeat, projectedStart, projectedEnd };
    });
  }, [events, config]);

  const totalDuration = schedule.reduce((acc, s) => acc + s.durationMins + config.breakBetweenEvents, config.warmupDuration);
  const sessionEndTime = addMinutes(config.sessionStartTime, totalDuration);

  function cf<K extends keyof ScheduleConfig>(key: K, value: ScheduleConfig[K]) {
    setConfig(c => ({ ...c, [key]: value }));
  }

  const strokeColor: Record<string, string> = {
    Freestyle: "bg-blue-500/10 text-blue-400",
    Backstroke: "bg-green-500/10 text-green-400",
    Breaststroke: "bg-yellow-500/10 text-yellow-400",
    Butterfly: "bg-purple-500/10 text-purple-400",
    IM: "bg-red-500/10 text-red-400",
    "Medley Relay": "bg-pink-500/10 text-pink-400",
    "Freestyle Relay": "bg-cyan-500/10 text-cyan-400",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Meet Schedule</h2>
          <Badge variant="secondary">{schedule.length} events</Badge>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-3.5 w-3.5 mr-1" />Print Schedule</Button>
          <Button size="sm" variant="ghost" onClick={() => setShowConfig(c => !c)}>
            {showConfig ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Config
          </Button>
        </div>
      </div>

      {showConfig && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Schedule Configuration</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Session Start</Label>
                <Input type="time" value={config.sessionStartTime} onChange={e => cf("sessionStartTime", e.target.value)} className="h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Warmup (min)</Label>
                <Input type="number" value={config.warmupDuration} onChange={e => cf("warmupDuration", parseInt(e.target.value) || 60)} className="h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Avg Min / Heat</Label>
                <Input type="number" value={config.avgTimePerHeat} step="0.5" onChange={e => cf("avgTimePerHeat", parseFloat(e.target.value) || 4)} className="h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Break Between Events</Label>
                <Input type="number" value={config.breakBetweenEvents} onChange={e => cf("breakBetweenEvents", parseInt(e.target.value) || 2)} className="h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Lanes / Heat</Label>
                <Input type="number" value={config.lanesPerHeat} onChange={e => cf("lanesPerHeat", parseInt(e.target.value) || 8)} className="h-8" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />Warmup ends: {addMinutes(config.sessionStartTime, config.warmupDuration)}</span>
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />Session end (est.): {sessionEndTime}</span>
              <span className="flex items-center gap-1">Total: {formatDuration(totalDuration)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && <div className="py-8 text-center text-muted-foreground">Loading events...</div>}

      {!isLoading && schedule.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>No events found. Add events first, then view the projected schedule here.</p>
          </CardContent>
        </Card>
      )}

      {schedule.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Event #</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead className="text-right">Entries</TableHead>
                  <TableHead className="text-right">Heats</TableHead>
                  <TableHead>Est. Start</TableHead>
                  <TableHead>Est. End</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedule.map((evt: any, idx: number) => (
                  <TableRow key={evt.id}>
                    <TableCell className="font-mono font-bold text-muted-foreground">#{evt.eventNumber ?? idx + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{evt.distance}{evt.stroke}</span>
                        <Badge variant="outline" className="text-xs">{evt.gender}</Badge>
                        {evt.ageGroup && <Badge variant="outline" className="text-xs">{evt.ageGroup}</Badge>}
                        {evt.isRelay && <Badge className="text-xs bg-orange-500/20 text-orange-400 border-orange-500/30">Relay</Badge>}
                      </div>
                      {evt.stroke && <span className={`inline-block mt-0.5 px-1.5 py-0 rounded text-xs font-medium ${strokeColor[evt.stroke] || ""}`}>{evt.stroke}</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {(sessions as any[]).find(s => s.id === evt.sessionId)?.name || "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">{evt.entryCount ?? 0}</TableCell>
                    <TableCell className="text-right font-mono">{evt.heats}</TableCell>
                    <TableCell className="font-mono text-primary font-semibold">{evt.projectedStart}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">{evt.projectedEnd}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDuration(evt.durationMins)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card className="bg-muted/30">
        <CardContent className="py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{schedule.length}</div>
              <div className="text-xs text-muted-foreground">Total Events</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{schedule.reduce((a, s) => a + s.heats, 0)}</div>
              <div className="text-xs text-muted-foreground">Total Heats</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{formatDuration(totalDuration - config.warmupDuration)}</div>
              <div className="text-xs text-muted-foreground">Racing Time (est.)</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{sessionEndTime}</div>
              <div className="text-xs text-muted-foreground">Estimated End</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
