import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { formatTime } from "@/lib/format-time";
import { useListEvents, readStore, type RelayTeam } from "@/lib/local-store";
import {
  useListRelayTeams,
  useBuildSmartRelays,
  useUpdateRelayLeg,
  useClearRelayTeams,
  relayInfo,
  legCandidates,
} from "@/lib/relays";
import { Waves, Wand2, Trash2, Users, Trophy } from "lucide-react";

export default function MeetRelays({ meetId }: { meetId: number }) {
  const { data: events = [] } = useListEvents(meetId, { query: { enabled: !!meetId } });
  const { toast } = useToast();

  const relayEvents = (events as any[]).filter((e) => e.isRelay);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [numTeams, setNumTeams] = useState("2");

  const eventId = selectedEvent ? parseInt(selectedEvent) : 0;
  const { data: relayTeams = [] } = useListRelayTeams(eventId, { query: { enabled: !!eventId } });

  const build = useBuildSmartRelays();
  const updateLeg = useUpdateRelayLeg();
  const clear = useClearRelayTeams();

  const event = (events as any[]).find((e) => e.id === eventId);
  const info = useMemo(() => (event ? relayInfo(event) : null), [event]);

  const byTeam = useMemo(() => {
    const map = new Map<string, RelayTeam[]>();
    for (const rt of relayTeams as RelayTeam[]) {
      const arr = map.get(rt.teamName) ?? [];
      arr.push(rt);
      map.set(rt.teamName, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.letter.localeCompare(b.letter));
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [relayTeams]);

  function handleBuild() {
    if (!eventId) {
      toast({ title: "Select a relay event", variant: "destructive" });
      return;
    }
    build.mutate(
      { eventId, numTeams: parseInt(numTeams) },
      {
        onSuccess: (teams) => {
          toast({
            title: teams.length ? "Relays built" : "No relays built",
            description: teams.length
              ? `Created ${teams.length} relay team${teams.length === 1 ? "" : "s"} across clubs.`
              : "No eligible swimmers with times for this relay. Add individual entries/times first.",
            variant: teams.length ? undefined : "destructive",
          });
        },
        onError: (err: any) => toast({ title: "Build failed", description: err?.message, variant: "destructive" }),
      }
    );
  }

  function handleClear() {
    clear.mutate({ eventId, meetId }, { onSuccess: () => toast({ title: "Relays cleared" }) });
  }

  function changeLeg(relayTeamId: number, legNumber: number, value: string) {
    updateLeg.mutate({
      relayTeamId,
      legNumber,
      athleteId: value === "none" ? null : parseInt(value),
    });
  }

  const eventLabel = (e: any) => `#${e.eventNumber} — ${e.distance} ${e.stroke} ${e.gender === "F" ? "Women" : e.gender === "M" ? "Men" : "Mixed"}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Waves className="h-5 w-5 text-cyan-500" />
        <h2 className="text-lg font-bold">Smart Relay Builder</h2>
      </div>
      <p className="text-sm text-muted-foreground -mt-3">
        Auto-builds the fastest legal lineups from each club's roster — freestyle relays take the fastest four; medley relays assign the best swimmer per stroke. Tweak any leg by hand and the total updates.
      </p>

      <Card>
        <CardContent className="flex items-end gap-3 flex-wrap pt-6">
          <div className="min-w-[240px]">
            <Label className="text-xs mb-1 block">Relay Event</Label>
            <Select value={selectedEvent} onValueChange={setSelectedEvent}>
              <SelectTrigger><SelectValue placeholder="Select relay event..." /></SelectTrigger>
              <SelectContent>
                {relayEvents.length === 0 && (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">No relay events. Add one in Events.</div>
                )}
                {relayEvents.map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>{eventLabel(e)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Teams / club</Label>
            <Select value={numTeams} onValueChange={setNumTeams}>
              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">A only</SelectItem>
                <SelectItem value="2">A + B</SelectItem>
                <SelectItem value="3">A + B + C</SelectItem>
                <SelectItem value="4">A–D</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleBuild} disabled={build.isPending || !eventId} className="gap-2">
            <Wand2 className="h-3.5 w-3.5" /> Auto-Build Smart Relays
          </Button>
          {relayTeams.length > 0 && (
            <Button variant="ghost" onClick={handleClear} className="gap-2 text-red-500">
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </Button>
          )}
          {info && (
            <Badge variant="outline" className="ml-auto self-center">
              {info.type === "medley" ? "Medley" : "Freestyle"} · {info.legDistance} per leg
            </Badge>
          )}
        </CardContent>
      </Card>

      {!eventId && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Waves className="h-8 w-8 mx-auto mb-2 opacity-30" />
            Select a relay event to build lineups.
          </CardContent>
        </Card>
      )}

      {eventId && relayTeams.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            No relays built yet. Click <strong>Auto-Build Smart Relays</strong>.
          </CardContent>
        </Card>
      )}

      {byTeam.map(([teamName, teams]) => (
        <Card key={teamName}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" /> {teamName}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {teams.map((rt) => (
              <RelayCard
                key={rt.id}
                rt={rt}
                eventId={eventId}
                onChangeLeg={changeLeg}
              />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RelayCard({
  rt, eventId, onChangeLeg,
}: {
  rt: RelayTeam;
  eventId: number;
  onChangeLeg: (relayTeamId: number, legNumber: number, value: string) => void;
}) {
  // Candidate lists are derived live from the current store per leg stroke.
  const store = readStore();
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 font-semibold">
          {rt.letter === "A" ? <Trophy className="h-4 w-4 text-amber-500" /> : null}
          {rt.teamName} &ldquo;{rt.letter}&rdquo;
        </div>
        <Badge variant={rt.totalSeedTime != null ? "default" : "outline"} className="font-mono">
          {rt.totalSeedTime != null ? formatTime(rt.totalSeedTime) : "Incomplete"}
        </Badge>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14">Leg</TableHead>
            <TableHead className="w-28">Stroke</TableHead>
            <TableHead>Swimmer</TableHead>
            <TableHead className="text-right w-24">Best</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rt.legs.map((leg) => {
            const candidates = legCandidates(store, eventId, rt.teamId, leg.stroke);
            return (
              <TableRow key={leg.legNumber}>
                <TableCell className="font-mono text-muted-foreground">{leg.legNumber}</TableCell>
                <TableCell>{leg.stroke}</TableCell>
                <TableCell>
                  <Select
                    value={leg.athleteId != null ? String(leg.athleteId) : "none"}
                    onValueChange={(v) => onChangeLeg(rt.id, leg.legNumber, v)}
                  >
                    <SelectTrigger className="h-8"><SelectValue placeholder="— empty —" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— empty —</SelectItem>
                      {candidates.map((c) => (
                        <SelectItem key={c.athleteId} value={String(c.athleteId)}>
                          {c.name}{c.time != null ? ` (${formatTime(c.time)})` : " (NT)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {leg.seedTime != null ? formatTime(leg.seedTime) : "NT"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
