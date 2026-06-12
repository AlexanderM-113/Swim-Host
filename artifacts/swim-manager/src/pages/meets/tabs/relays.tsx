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
  useUpdateRelayLeg,
  useClearRelayTeams,
  relayInfo,
  legCandidates,
} from "@/lib/relays";
import { Waves, Trash2, Users, Trophy, Plus, ChevronUp, ChevronDown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { writeStore } from "@/lib/local-store";

export default function MeetRelays({ meetId }: { meetId: number }) {
  const { data: events = [] } = useListEvents(meetId, { query: { enabled: !!meetId } });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const relayEvents = (events as any[]).filter((e) => e.isRelay);
  const [selectedEvent, setSelectedEvent] = useState("");

  const eventId = selectedEvent ? parseInt(selectedEvent) : 0;
  const { data: relayTeams = [] } = useListRelayTeams(eventId, { query: { enabled: !!eventId } });

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

  function handleClear() {
    if (!confirm("Remove all relay lineups for this event?")) return;
    clear.mutate({ eventId, meetId }, { onSuccess: () => toast({ title: "Relay lineups cleared" }) });
  }

  function changeLeg(relayTeamId: number, legNumber: number, value: string) {
    updateLeg.mutate({
      relayTeamId,
      legNumber,
      athleteId: value === "none" ? null : parseInt(value),
    });
  }

  function addRelayTeam(teamId: number, teamName: string) {
    if (!info) return;
    const store = readStore();
    const existingLetters = (relayTeams as RelayTeam[])
      .filter((rt) => rt.teamId === teamId)
      .map((rt) => rt.letter);
    const nextLetter = ["A", "B", "C", "D"].find((l) => !existingLetters.includes(l));
    if (!nextLetter) {
      toast({ title: "Maximum relay teams reached for this club", variant: "destructive" });
      return;
    }
    const legs = info.type === "medley"
      ? [
          { legNumber: 1, stroke: "Backstroke", athleteId: null, athleteName: "", seedTime: null },
          { legNumber: 2, stroke: "Breaststroke", athleteId: null, athleteName: "", seedTime: null },
          { legNumber: 3, stroke: "Butterfly", athleteId: null, athleteName: "", seedTime: null },
          { legNumber: 4, stroke: "Freestyle", athleteId: null, athleteName: "", seedTime: null },
        ]
      : Array.from({ length: 4 }, (_, i) => ({
          legNumber: i + 1,
          stroke: "Freestyle",
          athleteId: null,
          athleteName: "",
          seedTime: null,
        }));
    const newTeam: RelayTeam = {
      id: (store.relayTeams ?? []).reduce((mx, r) => Math.max(mx, r.id), 0) + 1,
      eventId,
      meetId,
      teamId,
      teamName,
      letter: nextLetter,
      legs,
      totalSeedTime: null,
    };
    writeStore({ ...store, relayTeams: [...(store.relayTeams ?? []), newTeam] });
    queryClient.invalidateQueries({ queryKey: ["relay-teams", eventId] });
    toast({ title: `${teamName} "${nextLetter}" relay team added` });
  }

  // Distinct teams in the roster for this meet
  const meetTeams = useMemo(() => {
    const store = readStore();
    const seen = new Map<number, string>();
    for (const a of store.athletes.filter((a) => a.meetId === meetId)) {
      if (a.teamId && !seen.has(a.teamId)) {
        const team = store.teams.find((t) => t.id === a.teamId);
        if (team) seen.set(team.id, team.name);
      }
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [meetId, relayTeams]);

  const eventLabel = (e: any) =>
    `#${e.eventNumber} — ${e.distance} ${e.stroke} ${e.gender === "F" ? "Women" : e.gender === "M" ? "Men" : "Mixed"}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Waves className="h-5 w-5 text-cyan-500" />
        <h2 className="text-lg font-bold">Relay Events</h2>
      </div>
      <p className="text-sm text-muted-foreground -mt-3">
        View relay events for this meet. Select a relay event to manage lineups — assign swimmers to each leg and reorder as needed.
      </p>

      {relayEvents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Waves className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No relay events yet</p>
            <p className="text-sm mt-1">Add relay events in the <strong>Events</strong> tab first.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Event selector */}
          <Card>
            <CardContent className="flex items-end gap-3 flex-wrap pt-6">
              <div className="min-w-[260px]">
                <Label className="text-xs mb-1 block">Relay Event</Label>
                <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                  <SelectTrigger><SelectValue placeholder="Select relay event…" /></SelectTrigger>
                  <SelectContent>
                    {relayEvents.map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>{eventLabel(e)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {info && (
                <Badge variant="outline" className="self-center">
                  {info.type === "medley" ? "Medley" : "Freestyle"} · {info.legDistance} per leg
                </Badge>
              )}
              {eventId > 0 && relayTeams.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="gap-1.5 text-destructive hover:text-destructive ml-auto"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Clear All Lineups
                </Button>
              )}
            </CardContent>
          </Card>

          {!eventId && (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-muted-foreground">
                <Waves className="h-7 w-7 mx-auto mb-2 opacity-30" />
                Select a relay event to manage lineups.
              </CardContent>
            </Card>
          )}

          {/* Add relay team buttons */}
          {eventId > 0 && meetTeams.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground font-medium">Add lineup:</span>
              {meetTeams.map((t) => (
                <Button
                  key={t.id}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => addRelayTeam(t.id, t.name)}
                >
                  <Plus className="h-3 w-3 mr-1" /> {t.name}
                </Button>
              ))}
            </div>
          )}

          {eventId > 0 && relayTeams.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-muted-foreground">
                No relay lineups yet for this event.
                {meetTeams.length > 0
                  ? " Use the buttons above to add a lineup."
                  : " Add athletes to the meet roster first."}
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
        </>
      )}
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
                <TableCell className="text-sm">{leg.stroke}</TableCell>
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
                <TableCell className="text-right font-mono text-sm">
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
