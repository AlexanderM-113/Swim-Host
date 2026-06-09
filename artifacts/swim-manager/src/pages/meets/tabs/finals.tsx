import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { formatTime } from "@/lib/format-time";
import { broadcastDataChanged } from "@/lib/live-broadcast";
import {
  useListEvents,
  getListFinalsQueryKey,
  getListEventsQueryKey,
  type EventFinals,
} from "@/lib/local-store";
import {
  useListFinals,
  useGenerateFinalists,
  useToggleFinalistScratch,
  useReseedFinals,
  useSetFinalsLock,
  useClearFinals,
  finalNamesFor,
  processMeetScratchDeadline,
} from "@/lib/finals";
import {
  Trophy, Timer, AlertCircle, Lock, Unlock, Shuffle, Play, Square,
  X, RotateCcw, Medal, Star,
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

function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function ScratchDeadlineTimer({ meetId, onExpire }: { meetId: number; onExpire: () => void }) {
  const [deadline, setDeadline] = useState<number | null>(() => readDeadline(meetId));
  const [now, setNow] = useState(Date.now());
  const [minutes, setMinutes] = useState("30");
  const firedRef = useRef(false);
  const { toast } = useToast();

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (deadline == null) return;
    if (now >= deadline && !firedRef.current) {
      firedRef.current = true;
      onExpire();
      localStorage.removeItem(DEADLINE_KEY(meetId));
      setDeadline(null);
    }
  }, [now, deadline, meetId, onExpire]);

  function start() {
    const mins = Math.max(1, parseInt(minutes) || 30);
    const dl = Date.now() + mins * 60 * 1000;
    localStorage.setItem(DEADLINE_KEY(meetId), JSON.stringify({ deadline: dl, minutes: mins }));
    firedRef.current = false;
    setDeadline(dl);
    toast({ title: "Scratch deadline started", description: `Auto-processes scratches in ${mins} min.` });
  }

  function cancel() {
    localStorage.removeItem(DEADLINE_KEY(meetId));
    setDeadline(null);
    toast({ title: "Scratch deadline cancelled" });
  }

  const remaining = deadline != null ? deadline - now : 0;
  const running = deadline != null && remaining > 0;

  return (
    <Card className="border-2 border-amber-300 dark:border-amber-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Timer className="h-4 w-4 text-amber-500" />
          Scratch Deadline
        </CardTitle>
      </CardHeader>
      <CardContent>
        {running ? (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="font-mono text-4xl font-black tabular-nums text-amber-500">
                {fmtCountdown(remaining)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                When the timer expires, scratches are processed, alternates promoted, and finals re-seeded &amp; locked automatically.
              </p>
            </div>
            <Button variant="outline" onClick={cancel} className="gap-2">
              <Square className="h-3.5 w-3.5" /> Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <Label className="text-xs mb-1 block">Minutes</Label>
              <Select value={minutes} onValueChange={setMinutes}>
                <SelectTrigger className="w-[90px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[5, 10, 15, 20, 30, 45, 60].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={start} className="gap-2 bg-amber-600 hover:bg-amber-500">
              <Play className="h-3.5 w-3.5" /> Start {minutes}-min Timer
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FinalistTable({
  finals, onToggleScratch, busy,
}: {
  finals: EventFinals;
  onToggleScratch: (entryId: number) => void;
  busy: boolean;
}) {
  const names = finalNamesFor(finals.numFinals);
  const byFinal = (name: string) =>
    finals.finalists
      .filter((f) => f.finalName === name && f.qualified)
      .sort((a, b) => a.prelimRank - b.prelimRank);
  const alternates = finals.finalists
    .filter((f) => f.alternate && !f.scratched)
    .sort((a, b) => a.prelimRank - b.prelimRank);
  const scratched = finals.finalists.filter((f) => f.scratched);

  const labelFor = (name: string, idx: number) =>
    name === names[0]
      ? `Championship Final (${name})`
      : `Consolation Final ${name}`;

  return (
    <div className="space-y-4">
      {names.map((name, idx) => {
        const members = byFinal(name);
        return (
          <Card key={name}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                {name === names[0]
                  ? <Trophy className="h-4 w-4 text-amber-500" />
                  : <Medal className="h-4 w-4 text-slate-400" />}
                {labelFor(name, idx)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Seed</TableHead>
                    <TableHead>Athlete</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-right">Prelim</TableHead>
                    <TableHead className="text-right w-24">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-4">
                        No qualifiers
                      </TableCell>
                    </TableRow>
                  )}
                  {members.map((f) => (
                    <TableRow key={f.entryId}>
                      <TableCell className="font-mono text-muted-foreground">#{f.prelimRank}</TableCell>
                      <TableCell className="font-medium">{f.athleteName}</TableCell>
                      <TableCell className="text-muted-foreground">{f.teamName}</TableCell>
                      <TableCell className="text-right font-mono">{formatTime(f.prelimTime)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-red-500 hover:text-red-600"
                          disabled={busy || finals.locked}
                          onClick={() => onToggleScratch(f.entryId)}
                        >
                          <X className="h-3.5 w-3.5 mr-1" /> Scratch
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}

      {alternates.length > 0 && (
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="h-4 w-4 text-cyan-500" /> Alternates (standby)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {alternates.map((f) => (
                  <TableRow key={f.entryId}>
                    <TableCell className="font-mono text-muted-foreground w-12">#{f.prelimRank}</TableCell>
                    <TableCell className="font-medium">{f.athleteName}</TableCell>
                    <TableCell className="text-muted-foreground">{f.teamName}</TableCell>
                    <TableCell className="text-right font-mono">{formatTime(f.prelimTime)}</TableCell>
                    <TableCell className="text-right w-24">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-red-500 hover:text-red-600"
                        disabled={busy || finals.locked}
                        onClick={() => onToggleScratch(f.entryId)}
                      >
                        <X className="h-3.5 w-3.5 mr-1" /> Scratch
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {scratched.length > 0 && (
        <Card className="border-dashed border-red-300 dark:border-red-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-red-500">
              <X className="h-4 w-4" /> Scratched from Finals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {scratched.map((f) => (
                  <TableRow key={f.entryId} className="opacity-60">
                    <TableCell className="font-mono text-muted-foreground w-12">#{f.prelimRank}</TableCell>
                    <TableCell className="font-medium line-through">{f.athleteName}</TableCell>
                    <TableCell className="text-muted-foreground">{f.teamName}</TableCell>
                    <TableCell className="text-right font-mono">{formatTime(f.prelimTime)}</TableCell>
                    <TableCell className="text-right w-24">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7"
                        disabled={busy || finals.locked}
                        onClick={() => onToggleScratch(f.entryId)}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function MeetFinals({ meetId }: { meetId: number }) {
  const { data: events = [] } = useListEvents(meetId, { query: { enabled: !!meetId } });
  const { data: finalsList = [] } = useListFinals(meetId, { query: { enabled: !!meetId } });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedEvent, setSelectedEvent] = useState("");
  const [numFinals, setNumFinals] = useState("2");
  const [finalSize, setFinalSize] = useState("8");

  const generate = useGenerateFinalists();
  const toggleScratch = useToggleFinalistScratch();
  const reseed = useReseedFinals();
  const setLock = useSetFinalsLock();
  const clear = useClearFinals();

  const eventId = selectedEvent ? parseInt(selectedEvent) : 0;
  const finals = useMemo(
    () => finalsList.find((f) => f.eventId === eventId),
    [finalsList, eventId]
  );

  const eventLabel = (e: any) => `#${e.eventNumber} — ${e.distance} ${e.stroke} ${e.gender}`;

  function handleGenerate() {
    if (!eventId) {
      toast({ title: "Select an event", variant: "destructive" });
      return;
    }
    generate.mutate(
      { eventId, numFinals: parseInt(numFinals), finalSize: parseInt(finalSize) },
      {
        onSuccess: (f) => {
          broadcastDataChanged(meetId);
          toast({ title: "Finalists generated", description: `${f.finalists.filter((x) => x.qualified).length} qualifiers seeded into finals.` });
        },
        onError: (err: any) => toast({ title: "Could not generate finalists", description: err?.message, variant: "destructive" }),
      }
    );
  }

  function handleToggleScratch(entryId: number) {
    toggleScratch.mutate(
      { eventId, entryId },
      {
        onSuccess: () => {
          broadcastDataChanged(meetId);
        },
        onError: (err: any) => toast({ title: "Could not update scratch", description: err?.message, variant: "destructive" }),
      }
    );
  }

  function handleReseed() {
    reseed.mutate(
      { eventId },
      {
        onSuccess: () => {
          broadcastDataChanged(meetId);
          toast({ title: "Finals re-seeded", description: "Alternates promoted and lanes reassigned." });
        },
        onError: (err: any) => toast({ title: "Re-seed failed", description: err?.message, variant: "destructive" }),
      }
    );
  }

  function handleLock(locked: boolean) {
    setLock.mutate(
      { eventId, locked },
      { onSuccess: () => toast({ title: locked ? "Finalists locked" : "Finalists unlocked" }) }
    );
  }

  function handleClear() {
    clear.mutate(
      { eventId, meetId },
      {
        onSuccess: () => {
          broadcastDataChanged(meetId);
          toast({ title: "Finals cleared" });
        },
      }
    );
  }

  function handleDeadlineExpire() {
    const count = processMeetScratchDeadline(meetId);
    broadcastDataChanged(meetId);
    queryClient.invalidateQueries({ queryKey: getListFinalsQueryKey(meetId) });
    queryClient.invalidateQueries({ queryKey: getListEventsQueryKey(meetId) });
    queryClient.invalidateQueries({ queryKey: ["heats"] });
    toast({
      title: "Scratch deadline reached",
      description: count > 0
        ? `Processed scratches and re-seeded ${count} final${count === 1 ? "" : "s"}.`
        : "No finals to process.",
    });
  }

  const busy = generate.isPending || toggleScratch.isPending || reseed.isPending || setLock.isPending;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-amber-500" />
        <h2 className="text-lg font-bold">Finals Manager</h2>
      </div>
      <p className="text-sm text-muted-foreground -mt-3">
        Generate finalists from prelim results, run the scratch deadline, promote alternates, and re-seed the championship / consolation finals.
      </p>

      <ScratchDeadlineTimer meetId={meetId} onExpire={handleDeadlineExpire} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Generate Finalists</CardTitle>
        </CardHeader>
        <CardContent className="flex items-end gap-3 flex-wrap">
          <div className="min-w-[220px]">
            <Label className="text-xs mb-1 block">Event</Label>
            <Select value={selectedEvent} onValueChange={setSelectedEvent}>
              <SelectTrigger><SelectValue placeholder="Select event..." /></SelectTrigger>
              <SelectContent>
                {(events as any[]).map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>{eventLabel(e)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Finals</Label>
            <Select value={numFinals} onValueChange={setNumFinals}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">A only</SelectItem>
                <SelectItem value="2">A + B</SelectItem>
                <SelectItem value="3">A + B + C</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Lanes</Label>
            <Select value={finalSize} onValueChange={setFinalSize}>
              <SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[4, 6, 8, 10].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleGenerate} disabled={busy} className="gap-2">
            <Shuffle className="h-3.5 w-3.5" />
            {finals ? "Regenerate" : "Generate Finalists"}
          </Button>
        </CardContent>
      </Card>

      {!selectedEvent && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
            Select an event to generate or manage its finals.
          </CardContent>
        </Card>
      )}

      {selectedEvent && !finals && (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            No finals generated yet. Import prelim times, then click <strong>Generate Finalists</strong>.
          </CardContent>
        </Card>
      )}

      {finals && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="gap-1">
              {finals.finalists.filter((f) => f.qualified && !f.scratched).length} qualifiers
            </Badge>
            <Badge variant="outline" className="gap-1">
              {finals.finalists.filter((f) => f.alternate && !f.scratched).length} alternates
            </Badge>
            <Badge variant="outline" className="gap-1 text-red-500">
              {finals.finalists.filter((f) => f.scratched).length} scratched
            </Badge>
            {finals.locked
              ? <Badge className="bg-slate-700 text-white gap-1"><Lock className="h-3 w-3" /> Locked</Badge>
              : <Badge variant="outline" className="text-emerald-600 border-emerald-400">Open</Badge>}
            <div className="flex-1" />
            <Button size="sm" variant="outline" onClick={handleReseed} disabled={busy} className="gap-1.5">
              <Shuffle className="h-3.5 w-3.5" /> Re-seed
            </Button>
            {finals.locked
              ? <Button size="sm" variant="outline" onClick={() => handleLock(false)} className="gap-1.5"><Unlock className="h-3.5 w-3.5" /> Unlock</Button>
              : <Button size="sm" variant="outline" onClick={() => handleLock(true)} className="gap-1.5"><Lock className="h-3.5 w-3.5" /> Lock</Button>}
            <Button size="sm" variant="ghost" onClick={handleClear} className="gap-1.5 text-red-500">
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          </div>

          <FinalistTable finals={finals} onToggleScratch={handleToggleScratch} busy={busy} />
        </>
      )}
    </div>
  );
}
