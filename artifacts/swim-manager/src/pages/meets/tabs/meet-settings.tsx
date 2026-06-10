import { useState, useEffect } from "react";
import { useGetMeet, useUpdateMeet, getGetMeetQueryKey, getGetMeetTeamScoresQueryKey } from "@/lib/local-store";
import {
  MEET_TYPE_PRESETS, getMeetSettings, getPresetByKey, resolvePresetKey,
  serializeMeetSettings, type MeetSeedingScoringSettings,
} from "@/lib/meet-settings";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Settings2, Sparkles, Save } from "lucide-react";

function parsePoints(s: string): number[] {
  return s
    .split(/[,\s]+/)
    .map((x) => parseInt(x.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 0);
}

export default function MeetSettings({ meetId }: { meetId: number }) {
  const { data: meet } = useGetMeet(meetId, { query: { enabled: !!meetId, queryKey: getGetMeetQueryKey(meetId) } });
  const updateMeet = useUpdateMeet();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [settings, setSettings] = useState<MeetSeedingScoringSettings | null>(null);
  const [presetKey, setPresetKey] = useState<string>("standard");
  const [indivText, setIndivText] = useState("");
  const [relayText, setRelayText] = useState("");

  useEffect(() => {
    if (!meet) return;
    const s = getMeetSettings(meet);
    setSettings(s);
    setPresetKey(resolvePresetKey(meet));
    setIndivText(s.individualPoints.join(", "));
    setRelayText(s.relayPoints.join(", "));
  }, [meet?.id]);

  if (!meet || !settings) return <div className="py-8 text-center text-muted-foreground">Loading…</div>;

  function applyPreset(key: string) {
    const preset = getPresetByKey(key);
    setPresetKey(key);
    setSettings({ ...preset.settings });
    setIndivText(preset.settings.individualPoints.join(", "));
    setRelayText(preset.settings.relayPoints.join(", "));
    toast({ title: `Applied "${preset.label}" preset`, description: "Review and Save to keep these settings." });
  }

  function update<K extends keyof MeetSeedingScoringSettings>(key: K, value: MeetSeedingScoringSettings[K]) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function save() {
    if (!settings) return;
    const finalSettings: MeetSeedingScoringSettings = {
      ...settings,
      individualPoints: parsePoints(indivText),
      relayPoints: parsePoints(relayText),
    };
    updateMeet.mutate(
      { id: meetId, data: { scoringRules: serializeMeetSettings(finalSettings), lanes: finalSettings.lanes } },
      {
        onSuccess: () => {
          toast({ title: "Meet settings saved", description: "Seeding and scoring will use these settings." });
          queryClient.invalidateQueries({ queryKey: getGetMeetQueryKey(meetId) });
          queryClient.invalidateQueries({ queryKey: getGetMeetTeamScoresQueryKey(meetId) });
        },
        onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
      }
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-cyan-500" />
          Seeding &amp; Scoring Settings
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Customize how this meet seeds heats and scores teams. Pick a meet-type preset, then fine-tune.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-amber-500" /> Meet-Type Preset
          </CardTitle>
          <CardDescription>Applies sensible seeding &amp; scoring defaults for the chosen style.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {MEET_TYPE_PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => applyPreset(p.key)}
                className={`text-left rounded-lg border p-3 transition hover:border-cyan-500 ${presetKey === p.key ? "border-cyan-500 bg-cyan-500/5" : "border-border"}`}
              >
                <div className="font-medium text-sm">{p.label}</div>
                <div className="text-xs text-muted-foreground mt-1">{p.description}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Seeding</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Lanes</Label>
                <Select value={String(settings.lanes)} onValueChange={(v) => update("lanes", parseInt(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[4, 5, 6, 7, 8, 9, 10].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Heat Order</Label>
                <Select value={settings.heatOrder} onValueChange={(v) => update("heatOrder", v as MeetSeedingScoringSettings["heatOrder"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slow_to_fast">Slow to Fast</SelectItem>
                    <SelectItem value="fast_to_slow">Fast to Slow</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Lane Assignment</Label>
              <Select value={settings.laneAssignment} onValueChange={(v) => update("laneAssignment", v as MeetSeedingScoringSettings["laneAssignment"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="center">Center-out (standard)</SelectItem>
                  <SelectItem value="dual">Dual — teams alternate lanes</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Dual assigns each team its own lanes (odd vs. even) within every heat.
              </p>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label>Circle Seeding</Label>
                <p className="text-xs text-muted-foreground">Center-out lane order for the fastest heats.</p>
              </div>
              <Switch checked={settings.circleSeeding} onCheckedChange={(c) => update("circleSeeding", c)} />
            </div>
            <div className="space-y-1.5">
              <Label>Circle-seeded heats</Label>
              <Input
                type="number" min={0} value={settings.circleSeededHeats}
                onChange={(e) => update("circleSeededHeats", parseInt(e.target.value) || 0)}
                disabled={!settings.circleSeeding}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Scoring</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Individual place points</Label>
              <Input value={indivText} onChange={(e) => setIndivText(e.target.value)} className="font-mono" placeholder="9, 7, 6, 5, 4, 3, 2, 1" />
              <p className="text-xs text-muted-foreground">Comma-separated, 1st place first.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Relay place points</Label>
              <Input value={relayText} onChange={(e) => setRelayText(e.target.value)} className="font-mono" placeholder="18, 14, 12, 10, 8, 6, 4, 2" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Scoring depth</Label>
                <Input
                  type="number" min={0} value={settings.scoringDepth}
                  onChange={(e) => update("scoringDepth", parseInt(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground">Places beyond this don't score (0 = no limit).</p>
              </div>
              <div className="space-y-1.5">
                <Label>Max scorers / team</Label>
                <Input
                  type="number" min={0} value={settings.maxScorersPerTeam}
                  onChange={(e) => update("maxScorersPerTeam", parseInt(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground">Per individual event (0 = no limit).</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={updateMeet.isPending}>
          <Save className="h-4 w-4 mr-2" />
          {updateMeet.isPending ? "Saving…" : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
