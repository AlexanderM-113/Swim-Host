import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useListTeams } from "@/lib/local-store";
import { Settings, Trophy, Users, Plus, Trash2, Save } from "lucide-react";

interface ScoringRow {
  place: number;
  points: number;
}

interface LaneAssignment {
  teamId: number;
  teamName: string;
  defaultLanes: string;
}

interface MeetSetupData {
  maxRelayEntriesPerTeam: number | "";
  maxIndividualEntries: number | "";
  scoringSystem: "USA Swimming" | "NFHS" | "Custom";
  scoringRows: ScoringRow[];
  laneAssignments: LaneAssignment[];
  allowScratchAfterSeeding: boolean;
  requireTimeEntry: boolean;
  noTimePolicy: "allow" | "back_of_heat" | "reject";
}

const USA_SWIMMING_SCORING: ScoringRow[] = [
  { place: 1, points: 9 }, { place: 2, points: 7 }, { place: 3, points: 6 },
  { place: 4, points: 5 }, { place: 5, points: 4 }, { place: 6, points: 3 },
  { place: 7, points: 2 }, { place: 8, points: 1 },
];

const NFHS_SCORING: ScoringRow[] = [
  { place: 1, points: 6 }, { place: 2, points: 4 }, { place: 3, points: 3 },
  { place: 4, points: 2 }, { place: 5, points: 1 },
];

const RELAY_SCORING_MULTIPLIER = 2;

const STORE_KEY = (meetId: number) => `swimmanager_meet_setup_${meetId}`;

function readSetup(meetId: number): Partial<MeetSetupData> {
  try { return JSON.parse(localStorage.getItem(STORE_KEY(meetId)) ?? "{}"); } catch { return {}; }
}
function writeSetup(meetId: number, data: MeetSetupData) {
  localStorage.setItem(STORE_KEY(meetId), JSON.stringify(data));
}

export default function MeetSetup({ meetId, meet }: { meetId: number; meet: any }) {
  const { toast } = useToast();
  const { data: allTeams = [] } = useListTeams();

  const [setup, setSetup] = useState<MeetSetupData>(() => {
    const saved = readSetup(meetId);
    return {
      maxRelayEntriesPerTeam: saved.maxRelayEntriesPerTeam ?? 1,
      maxIndividualEntries: saved.maxIndividualEntries ?? "",
      scoringSystem: saved.scoringSystem ?? "USA Swimming",
      scoringRows: saved.scoringRows ?? USA_SWIMMING_SCORING,
      laneAssignments: saved.laneAssignments ?? [],
      allowScratchAfterSeeding: saved.allowScratchAfterSeeding ?? true,
      requireTimeEntry: saved.requireTimeEntry ?? false,
      noTimePolicy: saved.noTimePolicy ?? "back_of_heat",
    };
  });

  const [dirty, setDirty] = useState(false);

  function update<K extends keyof MeetSetupData>(key: K, value: MeetSetupData[K]) {
    setSetup((s) => ({ ...s, [key]: value }));
    setDirty(true);
  }

  function applyScoringPreset(preset: "USA Swimming" | "NFHS") {
    const rows = preset === "NFHS" ? NFHS_SCORING : USA_SWIMMING_SCORING;
    setSetup((s) => ({ ...s, scoringSystem: preset === "NFHS" ? "NFHS" : "USA Swimming", scoringRows: rows }));
    setDirty(true);
  }

  function updateScoringRow(idx: number, field: "place" | "points", val: number) {
    const rows = setup.scoringRows.map((r, i) => i === idx ? { ...r, [field]: val } : r);
    update("scoringRows", rows);
    update("scoringSystem", "Custom");
  }

  function addScoringRow() {
    const nextPlace = (setup.scoringRows.at(-1)?.place ?? 0) + 1;
    update("scoringRows", [...setup.scoringRows, { place: nextPlace, points: 0 }]);
    update("scoringSystem", "Custom");
  }

  function removeScoringRow(idx: number) {
    update("scoringRows", setup.scoringRows.filter((_, i) => i !== idx));
    update("scoringSystem", "Custom");
  }

  function addLaneAssignment() {
    const used = new Set(setup.laneAssignments.map((a) => a.teamId));
    const team = allTeams.find((t: any) => !used.has(t.id));
    if (!team) { toast({ title: "All teams already assigned", variant: "destructive" }); return; }
    update("laneAssignments", [
      ...setup.laneAssignments,
      { teamId: (team as any).id, teamName: (team as any).name, defaultLanes: "" },
    ]);
  }

  function updateLaneAssignment(idx: number, field: keyof LaneAssignment, value: string | number) {
    const updated = setup.laneAssignments.map((a, i) => {
      if (i !== idx) return a;
      if (field === "teamId") {
        const t = allTeams.find((t: any) => t.id === Number(value));
        return { ...a, teamId: Number(value), teamName: (t as any)?.name ?? "" };
      }
      return { ...a, [field]: value };
    });
    update("laneAssignments", updated);
  }

  function removeLaneAssignment(idx: number) {
    update("laneAssignments", setup.laneAssignments.filter((_, i) => i !== idx));
  }

  function save() {
    writeSetup(meetId, setup);
    setDirty(false);
    toast({ title: "Meet setup saved" });
  }

  const lanes = meet?.lanes ?? 8;
  const laneList = Array.from({ length: lanes }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Meet Setup
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure entry limits, scoring rules, and team lane assignments.
          </p>
        </div>
        <Button onClick={save} disabled={!dirty} size="sm">
          <Save className="h-4 w-4 mr-2" />
          {dirty ? "Save Changes" : "Saved"}
        </Button>
      </div>

      {/* Entry Limits */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Entry Limits</CardTitle>
          <CardDescription>Control how many events each athlete or team may enter.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <Label>Max Relay Entries Per Team Per Event</Label>
            <Input
              type="number" min={1} max={10}
              placeholder="1"
              value={setup.maxRelayEntriesPerTeam}
              onChange={(e) => update("maxRelayEntriesPerTeam", e.target.value === "" ? "" : parseInt(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              How many relay teams a single club may enter per relay event. Default: 1.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Max Individual Events Per Athlete</Label>
            <Input
              type="number" min={1} max={20}
              placeholder="No limit"
              value={setup.maxIndividualEntries}
              onChange={(e) => update("maxIndividualEntries", e.target.value === "" ? "" : parseInt(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank for no limit. Enforced at entry time.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>No-Time (NT) Policy</Label>
            <div className="flex gap-2 flex-wrap">
              {(["allow", "back_of_heat", "reject"] as const).map((opt) => (
                <Button
                  key={opt}
                  size="sm"
                  variant={setup.noTimePolicy === opt ? "default" : "outline"}
                  className="text-xs h-8"
                  onClick={() => update("noTimePolicy", opt)}
                >
                  {opt === "allow" ? "Allow NT" : opt === "back_of_heat" ? "Back of Heat" : "Reject NT"}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              How to handle athletes with no seed time. "Back of Heat" seeds NT entries last.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Scratch After Seeding</Label>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={setup.allowScratchAfterSeeding ? "default" : "outline"}
                className="text-xs h-8"
                onClick={() => update("allowScratchAfterSeeding", true)}
              >
                Allowed
              </Button>
              <Button
                size="sm"
                variant={!setup.allowScratchAfterSeeding ? "destructive" : "outline"}
                className="text-xs h-8"
                onClick={() => update("allowScratchAfterSeeding", false)}
              >
                Locked
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Whether athletes may scratch from events after the seeding deadline.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Scoring System */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                Scoring System
              </CardTitle>
              <CardDescription className="mt-1">
                Points awarded per place finish. Relay events typically score double (×2).
              </CardDescription>
            </div>
            <Badge variant="outline" className="shrink-0 text-xs mt-1">{setup.scoringSystem}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant={setup.scoringSystem === "USA Swimming" ? "default" : "outline"} className="text-xs h-7"
              onClick={() => applyScoringPreset("USA Swimming")}>
              USA Swimming (8-place)
            </Button>
            <Button size="sm" variant={setup.scoringSystem === "NFHS" ? "default" : "outline"} className="text-xs h-7"
              onClick={() => applyScoringPreset("NFHS")}>
              NFHS High School (5-place)
            </Button>
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={addScoringRow}>
              <Plus className="h-3 w-3 mr-1" />
              Add Place
            </Button>
          </div>

          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Place</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Individual Points</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Relay Points (×2)</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {setup.scoringRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-muted/20">
                    <td className="px-3 py-1.5">
                      <Input
                        type="number" min={1} className="h-7 w-16 text-xs"
                        value={row.place}
                        onChange={(e) => updateScoringRow(idx, "place", parseInt(e.target.value) || 1)}
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <Input
                        type="number" min={0} className="h-7 w-20 text-xs"
                        value={row.points}
                        onChange={(e) => updateScoringRow(idx, "points", parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground font-mono text-xs">
                      {(row.points * RELAY_SCORING_MULTIPLIER).toFixed(0)}
                    </td>
                    <td className="px-2">
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => removeScoringRow(idx)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {setup.scoringRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-xs text-muted-foreground">
                      No scoring rows. Add a place to begin.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Team Lane Assignments */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-cyan-500" />
                Team Lane Assignments
              </CardTitle>
              <CardDescription className="mt-1">
                Assign default lanes to teams — useful for dual meets with circuit seeding.
                This pool has <strong>{lanes}</strong> lanes.
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" className="text-xs h-8 shrink-0" onClick={addLaneAssignment}>
              <Plus className="h-3 w-3 mr-1" />
              Add Team
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {setup.laneAssignments.length === 0 && (
            <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-lg">
              No lane assignments. Click "Add Team" to assign a team to specific lanes.
            </div>
          )}
          {setup.laneAssignments.map((a, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 rounded-md border bg-card">
              <div className="flex-1 min-w-0 space-y-1">
                <Label className="text-xs">Team</Label>
                <select
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={a.teamId}
                  onChange={(e) => updateLaneAssignment(idx, "teamId", Number(e.target.value))}
                >
                  {allTeams.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <Label className="text-xs">Default Lanes (e.g. 1,2,3 or 1-4)</Label>
                <Input
                  className="h-8 text-sm"
                  placeholder={`e.g. 1-${Math.ceil(lanes / 2)}`}
                  value={a.defaultLanes}
                  onChange={(e) => updateLaneAssignment(idx, "defaultLanes", e.target.value)}
                />
              </div>
              <div className="pt-5">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeLaneAssignment(idx)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          {setup.laneAssignments.length > 0 && (
            <>
              <Separator />
              <div className="text-xs text-muted-foreground">
                <strong>Available lanes:</strong> {laneList.join(", ")}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
