import { useState } from "react";
import { useListMeets, useListAthletes, useListWorkouts, useGetClub } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Globe, Download, QrCode, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateMeetWebsite, generateFamilyPortal } from "@/lib/webgen";

const API = "/api";

async function apiFetch(path: string) {
  const resp = await fetch(`${API}${path}`);
  if (!resp.ok) throw new Error(`API error: ${resp.status}`);
  return resp.json();
}

export default function WebGen() {
  const { toast } = useToast();

  // Meet website state
  const [selectedMeet, setSelectedMeet] = useState("");
  const [meetOptions, setMeetOptions] = useState({
    includeHeatSheet: true,
    includeResults: true,
    includePsychSheet: true,
    includeScratchForm: true,
  });
  const [apiBaseUrl, setApiBaseUrl] = useState(typeof window !== "undefined" ? window.location.origin : "");
  const [meetLoading, setMeetLoading] = useState(false);

  // Family portal state
  const [selectedAthlete, setSelectedAthlete] = useState("");
  const [portalUrl, setPortalUrl] = useState("https://yourclub.com/portal");
  const [portalLoading, setPortalLoading] = useState(false);

  const { data: meets } = useListMeets();
  const { data: athletes } = useListAthletes();
  const { data: workouts } = useListWorkouts();
  const { data: club } = useGetClub();

  const clubName = (club as any)?.name ?? "SwimManager Pro";
  const meetObj = meets?.find(m => m.id === parseInt(selectedMeet));
  const athleteObj = athletes?.find(a => a.id === parseInt(selectedAthlete));
  const athleteName = athleteObj ? `${athleteObj.firstName} ${athleteObj.lastName}` : "";

  async function generateMeetSite() {
    if (!selectedMeet) { toast({ title: "Select a meet first", variant: "destructive" }); return; }
    setMeetLoading(true);
    try {
      const [meet, psychSheet, heatSheet, results] = await Promise.all([
        apiFetch(`/meets/${selectedMeet}`),
        meetOptions.includePsychSheet ? apiFetch(`/meets/${selectedMeet}/psych-sheet`) : Promise.resolve(null),
        meetOptions.includeHeatSheet ? apiFetch(`/meets/${selectedMeet}/heat-sheet`) : Promise.resolve(null),
        meetOptions.includeResults ? apiFetch(`/meets/${selectedMeet}/results-report`) : Promise.resolve(null),
      ]);

      await generateMeetWebsite({
        meet,
        psychSheet,
        heatSheet,
        results,
        ...meetOptions,
        apiBaseUrl,
      });

      toast({ title: "Meet website generated", description: "ZIP file downloaded. Extract and open index.html to preview." });
    } catch (e: any) {
      toast({ title: "Generation failed", description: e?.message, variant: "destructive" });
    } finally {
      setMeetLoading(false);
    }
  }

  async function generatePortal() {
    if (!selectedAthlete) { toast({ title: "Select an athlete first", variant: "destructive" }); return; }
    setPortalLoading(true);
    try {
      const fullReport = await apiFetch(`/athletes/${selectedAthlete}/full-report`);
      const athleteWorkouts = workouts?.filter(w => w.teamId === fullReport.athlete.teamId) ?? [];

      await generateFamilyPortal({
        athlete: fullReport.athlete,
        workouts: athleteWorkouts,
        invoices: fullReport.invoices,
        portalUrl: `${portalUrl}/${selectedAthlete}`,
        clubName,
      });

      toast({ title: "Family portal generated", description: "ZIP file downloaded. Extract and share index.html or host online." });
    } catch (e: any) {
      toast({ title: "Generation failed", description: e?.message, variant: "destructive" });
    } finally {
      setPortalLoading(false);
    }
  }

  function OptionRow({ id, label, description, checked, onCheckedChange }: {
    id: string; label: string; description: string;
    checked: boolean; onCheckedChange: (v: boolean) => void;
  }) {
    return (
      <div className="flex items-start gap-3 py-2">
        <Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} className="mt-0.5" />
        <div>
          <label htmlFor={id} className="text-sm font-medium cursor-pointer">{label}</label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Website Generation</h1>
        <p className="text-muted-foreground">
          Generate standalone HTML websites for meet results and family athlete portals. Downloads as a ZIP — host anywhere.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── MEET RESULTS WEBSITE ─────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Meet Results Website</CardTitle>
                <CardDescription>Full HTML site with results, heat sheets, psych sheets, and a finals scratch form</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label>Select Meet</Label>
              <Select value={selectedMeet} onValueChange={setSelectedMeet}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a meet…" />
                </SelectTrigger>
                <SelectContent>
                  {meets?.map(m => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.name}
                      <Badge variant="outline" className="ml-2 text-[10px]">{m.status}</Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-semibold">Include Sections</Label>
              <div className="border rounded-md px-3 divide-y">
                <OptionRow
                  id="psych" label="Psych Sheet" description="Pre-meet entry list sorted by seed time"
                  checked={meetOptions.includePsychSheet}
                  onCheckedChange={v => setMeetOptions(p => ({ ...p, includePsychSheet: !!v }))}
                />
                <OptionRow
                  id="heat" label="Heat Sheet" description="Seeded heat/lane assignments for all events"
                  checked={meetOptions.includeHeatSheet}
                  onCheckedChange={v => setMeetOptions(p => ({ ...p, includeHeatSheet: !!v }))}
                />
                <OptionRow
                  id="results" label="Results" description="Final results with times, places, and points"
                  checked={meetOptions.includeResults}
                  onCheckedChange={v => setMeetOptions(p => ({ ...p, includeResults: !!v }))}
                />
                <OptionRow
                  id="scratch" label="Finals Scratch Form" description="Online form for swimmers to scratch from finals"
                  checked={meetOptions.includeScratchForm}
                  onCheckedChange={v => setMeetOptions(p => ({ ...p, includeScratchForm: !!v }))}
                />
              </div>
            </div>

            {meetOptions.includeScratchForm && (
              <div className="space-y-1.5">
                <Label>API Server URL (for scratch form submissions)</Label>
                <Input
                  value={apiBaseUrl}
                  onChange={e => setApiBaseUrl(e.target.value)}
                  placeholder="https://yourserver.com"
                />
                <p className="text-xs text-muted-foreground">
                  The scratch form will POST to this URL. Your API server must be publicly accessible.
                </p>
              </div>
            )}

            <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3">
              <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">
                Generates a complete HTML/CSS website as a ZIP file. Open <code className="text-xs bg-muted px-1 rounded">index.html</code> locally or upload to any web host (GitHub Pages, Netlify, Apache, etc.).
              </p>
            </div>

            <Button className="w-full" onClick={generateMeetSite} disabled={meetLoading || !selectedMeet}>
              {meetLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {meetLoading ? "Generating Website…" : "Generate & Download ZIP"}
            </Button>
          </CardContent>
        </Card>

        {/* ── FAMILY PORTAL ────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <QrCode className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Family Athlete Portal</CardTitle>
                <CardDescription>Per-athlete webpage with contact info, workouts, billing, and a QR code for easy sharing</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label>Select Athlete</Label>
              <Select value={selectedAthlete} onValueChange={setSelectedAthlete}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an athlete…" />
                </SelectTrigger>
                <SelectContent>
                  {athletes?.map(a => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.firstName} {a.lastName}
                      <span className="text-muted-foreground text-xs ml-1">({a.gender})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Portal Base URL</Label>
              <Input
                value={portalUrl}
                onChange={e => setPortalUrl(e.target.value)}
                placeholder="https://yourclub.com/portal"
              />
              <p className="text-xs text-muted-foreground">
                QR code will point to <code className="text-xs bg-muted px-1 rounded">{portalUrl}/{selectedAthlete || "{athleteId}"}</code>
              </p>
            </div>

            <div className="border rounded-md p-4 space-y-2">
              <p className="text-sm font-semibold">Portal includes:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2"><span className="text-green-600">✓</span> Athlete contact & parent info</li>
                <li className="flex items-center gap-2"><span className="text-green-600">✓</span> Balance outstanding / total paid</li>
                <li className="flex items-center gap-2"><span className="text-green-600">✓</span> Full invoice history</li>
                <li className="flex items-center gap-2"><span className="text-green-600">✓</span> Recent team workouts</li>
                <li className="flex items-center gap-2"><span className="text-green-600">✓</span> Scannable QR code</li>
                <li className="flex items-center gap-2"><span className="text-green-600">✓</span> Payment instructions</li>
              </ul>
            </div>

            <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3">
              <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">
                Generates a self-contained HTML portal as a ZIP. Share the QR code with families so they can access their athlete's information from any device.
              </p>
            </div>

            <Button className="w-full" onClick={generatePortal} disabled={portalLoading || !selectedAthlete}>
              {portalLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {portalLoading ? "Generating Portal…" : "Generate & Download ZIP"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Hosting Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hosting Guide</CardTitle>
          <CardDescription>Options for making the generated websites accessible to families and coaches</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                name: "Local Preview",
                steps: ["Extract the ZIP file", "Open index.html in any browser", "Share the file directly"],
                badge: "Free / Offline",
              },
              {
                name: "GitHub Pages",
                steps: ["Create a GitHub repository", "Upload extracted files", "Enable Pages in Settings → Pages", "Share the .github.io URL"],
                badge: "Free / Online",
              },
              {
                name: "Club Web Server",
                steps: ["FTP/SFTP into your server", "Upload to a meet subfolder", "Set correct file permissions", "Share the URL with families"],
                badge: "Full Control",
              },
            ].map(opt => (
              <div key={opt.name} className="border rounded-md p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{opt.name}</span>
                  <Badge variant="secondary" className="text-[10px]">{opt.badge}</Badge>
                </div>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  {opt.steps.map(s => <li key={s}>{s}</li>)}
                </ol>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
