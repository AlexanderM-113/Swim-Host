import { useState, useRef } from "react";
import { useListMeets, readStore, writeStore, nextId } from "@/lib/local-store";
import type { Meet, Team, Athlete, Event, Entry } from "@/lib/local-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  parseSDIF, generateSDIF, summarizeSDIF, buildSDIFExportData,
  type SDIFImportSummary, type SDIFFile, STROKE_CODE_TO_NAME, COURSE_CODE_TO_NAME,
} from "@/lib/sdif";
import { formatTime } from "@/lib/format-time";
import {
  Upload, Download, FileText, CheckCircle2, AlertTriangle, Loader2,
  Users, Calendar, Trophy
} from "lucide-react";

// ─── SDIF date parsing (MMDDYYYY → YYYY-MM-DD) ───────────────────────────────

function parseSdifDate(d?: string): string | undefined {
  if (!d || d.length < 8) return undefined;
  const mo = d.substring(0, 2), day = d.substring(2, 4), yr = d.substring(4, 8);
  if (!yr || yr === "0000") return undefined;
  return `${yr}-${mo}-${day}`;
}

const SDIF_STROKE_MAP: Record<number, string> = {
  1: "Freestyle", 2: "Backstroke", 3: "Breaststroke", 4: "Butterfly",
  5: "Individual Medley", 6: "Freestyle Relay", 7: "Medley Relay",
};

// ─── Local SDIF import ────────────────────────────────────────────────────────

function importSDIFLocally(sdif: SDIFFile): {
  meetId: number; teams: number; entries: number;
} {
  const store = readStore();
  const courseMap: Record<string, string> = { Y: "SCY", S: "SCM", L: "LCM" };

  const meet: Meet = {
    id: nextId(store.meets),
    name: sdif.meet?.name ?? "Imported Meet",
    startDate: parseSdifDate(sdif.meet?.startDate) ?? new Date().toISOString().split("T")[0],
    endDate: parseSdifDate(sdif.meet?.endDate),
    facility: sdif.meet?.facility,
    course: courseMap[sdif.meet?.course ?? "Y"] ?? "SCY",
    altitude: sdif.meet?.altitude,
    meetType: "open",
    status: "scheduled",
    lanes: 8,
    createdAt: new Date().toISOString(),
  };

  const newTeams: Team[] = [];
  const teamIdMap = new Map<string, number>();
  for (const sdifTeam of sdif.teams) {
    const existing = store.teams.find(
      (t) => t.abbreviation === sdifTeam.code || t.name === sdifTeam.name
    );
    if (existing) {
      teamIdMap.set(sdifTeam.code, existing.id);
    } else {
      const team: Team = {
        id: nextId([...store.teams, ...newTeams]),
        name: sdifTeam.name || sdifTeam.code,
        abbreviation: sdifTeam.abbreviation || sdifTeam.code,
        lsc: sdifTeam.lsc,
        createdAt: new Date().toISOString(),
      };
      newTeams.push(team);
      teamIdMap.set(sdifTeam.code, team.id);
    }
  }

  const allTeams = [...store.teams, ...newTeams];
  const newAthletes: Athlete[] = [];
  const athleteIdMap = new Map<string, number>();
  for (const sdifTeam of sdif.teams) {
    const teamId = teamIdMap.get(sdifTeam.code)!;
    for (const e of sdifTeam.entries) {
      const key = `${e.athleteFirstName}:${e.athleteLastName}:${teamId}`;
      if (!athleteIdMap.has(key)) {
        const existing = store.athletes.find(
          (a) =>
            a.firstName.toLowerCase() === e.athleteFirstName.toLowerCase() &&
            a.lastName.toLowerCase() === e.athleteLastName.toLowerCase() &&
            a.teamId === teamId
        );
        if (existing) {
          athleteIdMap.set(key, existing.id);
        } else {
          const athlete: Athlete = {
            id: nextId([...store.athletes, ...newAthletes]),
            firstName: e.athleteFirstName,
            lastName: e.athleteLastName,
            gender: e.gender,
            teamId,
            idNumber: e.ussNumber || undefined,
            dateOfBirth: parseSdifDate(e.dateOfBirth),
            active: true,
            createdAt: new Date().toISOString(),
          };
          newAthletes.push(athlete);
          athleteIdMap.set(key, athlete.id);
        }
      }
    }
  }

  const newEvents: Event[] = [];
  const eventIdMap = new Map<number, number>();
  const eventMeta = new Map<number, { gender: string; distance: number; stroke: string; ageMin: number; ageMax: number }>();
  for (const sdifTeam of sdif.teams) {
    for (const e of sdifTeam.entries) {
      if (!eventMeta.has(e.eventNumber)) {
        eventMeta.set(e.eventNumber, {
          gender: e.eventGender,
          distance: e.distance,
          stroke: SDIF_STROKE_MAP[e.stroke] ?? "Freestyle",
          ageMin: e.ageMin,
          ageMax: e.ageMax,
        });
      }
    }
  }
  for (const [eventNumber, meta] of eventMeta) {
    const event: Event = {
      id: nextId([...store.events, ...newEvents]),
      meetId: meet.id,
      eventNumber,
      gender: meta.gender,
      distance: meta.distance,
      stroke: meta.stroke,
      ageGroup: meta.ageMin > 0 ? `${meta.ageMin}-${meta.ageMax}` : undefined,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    newEvents.push(event);
    eventIdMap.set(eventNumber, event.id);
  }

  const newEntries: Entry[] = [];
  for (const sdifTeam of sdif.teams) {
    const teamId = teamIdMap.get(sdifTeam.code)!;
    for (const e of sdifTeam.entries) {
      const key = `${e.athleteFirstName}:${e.athleteLastName}:${teamId}`;
      const athleteId = athleteIdMap.get(key);
      const eventId = eventIdMap.get(e.eventNumber);
      if (!athleteId || !eventId) continue;
      newEntries.push({
        id: nextId([...store.entries, ...newEntries]),
        meetId: meet.id,
        eventId,
        athleteId,
        seedTime: e.seedTime ?? undefined,
        seedCourse: e.seedCourse,
        scratched: false,
        createdAt: new Date().toISOString(),
      });
    }
  }

  writeStore({
    ...store,
    meets: [...store.meets, meet],
    teams: [...store.teams, ...newTeams],
    athletes: [...store.athletes, ...newAthletes],
    events: [...store.events, ...newEvents],
    entries: [...store.entries, ...newEntries],
  });

  return { meetId: meet.id, teams: newTeams.length, entries: newEntries.length };
}

// ─── Import Tab ──────────────────────────────────────────────────────────────

function ImportTab() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<SDIFImportSummary | null>(null);
  const [rawFile, setRawFile] = useState<string>("");
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ meetId: number; teams: number; entries: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setImportResult(null);
    setParsed(null);

    try {
      const text = await file.text();
      setRawFile(text);
      const sdif = parseSDIF(text);
      const summary = summarizeSDIF(sdif);
      setParsed(summary);
    } catch (err: any) {
      setError(err?.message ?? "Failed to parse file");
    }
  }

  async function handleImport() {
    if (!parsed || !rawFile) return;
    setImporting(true);
    setError(null);
    try {
      const sdif = parseSDIF(rawFile);
      const result = importSDIFLocally(sdif);
      setImportResult(result);
      toast({ title: "SDIF import complete", description: `${result.entries} entries imported` });
    } catch (err: any) {
      setError(err?.message ?? "Import failed");
      toast({ title: "Import failed", description: err?.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" /> Import SDIF File
          </CardTitle>
          <CardDescription>
            Import meet entries or results from a Hy-Tek (.hy3) or Colorado Timing (.cl2) SDIF file.
            Teams, athletes, and entries will be created automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">
              {fileName ? fileName : "Click to select or drop a .hy3 / .cl2 file"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Supports SDIF v3.0 format — Hy-Tek Meet Manager, Colorado Timing, and compatible software
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".hy3,.cl2,.sd3,.txt"
              className="hidden"
              onChange={handleFile}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {importResult && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-900/20">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-300">
                Import complete: Meet created (ID {importResult.meetId}), {importResult.teams} teams,{" "}
                {importResult.entries} entries imported.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      {parsed && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">File Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Meet</p>
                  <p className="font-semibold text-sm">{parsed.meetName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Course</p>
                  <Badge variant="outline">{parsed.course}</Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Teams</p>
                  <p className="font-bold text-2xl text-primary">{parsed.teamCount}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Entries</p>
                  <p className="font-bold text-2xl text-primary">{parsed.entryCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Teams in File</CardTitle>
                <Button onClick={handleImport} disabled={importing || !!importResult}>
                  {importing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing…</>
                  ) : importResult ? (
                    <><CheckCircle2 className="h-4 w-4 mr-2" /> Imported</>
                  ) : (
                    <><Upload className="h-4 w-4 mr-2" /> Import to Database</>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Team Code</TableHead>
                    <TableHead>Team Name</TableHead>
                    <TableHead className="text-right pr-6">Entries</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.teams.map((t) => (
                    <TableRow key={t.code}>
                      <TableCell className="pl-6 font-mono font-bold">{t.code}</TableCell>
                      <TableCell>{t.name}</TableCell>
                      <TableCell className="text-right pr-6">
                        <Badge variant="secondary">{t.entryCount}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Entry Preview (first 50)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Athlete</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-center">Event</TableHead>
                      <TableHead>Event Type</TableHead>
                      <TableHead className="font-mono">Seed</TableHead>
                      <TableHead>Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.entries.slice(0, 50).map((e, i) => (
                      <TableRow key={i}>
                        <TableCell className="pl-6 font-medium">
                          {e.athleteLastName}, {e.athleteFirstName}
                          <span className="ml-2 text-xs text-muted-foreground">({e.gender})</span>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{e.teamCode}</TableCell>
                        <TableCell className="text-center font-mono">{e.eventNumber}</TableCell>
                        <TableCell className="text-sm">
                          {e.distance} {e.stroke}
                          {e.ageMin > 0 ? ` ${e.ageMin}-${e.ageMax}` : ""}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {e.seedTime ? formatTime(e.seedTime) : "NT"}
                        </TableCell>
                        <TableCell>
                          {e.result ? (
                            e.result.dq ? <Badge className="bg-red-600 text-white text-[10px]">DQ</Badge>
                            : e.result.ns ? <Badge className="bg-slate-500 text-white text-[10px]">NS</Badge>
                            : e.result.finishTime ? (
                              <span className="font-mono text-green-700 dark:text-green-400">
                                {formatTime(e.result.finishTime)}
                                {e.result.place ? ` (${e.result.place})` : ""}
                              </span>
                            ) : "—"
                          ) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {parsed.entries.length > 50 && (
                <p className="text-xs text-muted-foreground text-center py-3">
                  Showing 50 of {parsed.entries.length} entries
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Export Tab ──────────────────────────────────────────────────────────────

function ExportTab() {
  const { data: meets } = useListMeets();
  const [selectedMeet, setSelectedMeet] = useState("");
  const [exportType, setExportType] = useState<"entries" | "results" | "both">("entries");
  const [fileFormat, setFileFormat] = useState<"sd3" | "hy3" | "cl2">("sd3");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  async function handleExport() {
    if (!selectedMeet) return;
    setExporting(true);
    setError(null);
    try {
      // Read all data from localStorage
      const store = readStore();
      const meetId = parseInt(selectedMeet, 10);
      const meet = store.meets.find((m) => m.id === meetId);
      if (!meet) throw new Error("Meet not found");
      const events = store.events.filter((e) => e.meetId === meetId);

      const allEntries: any[] = [];
      for (const event of events) {
        const eventEntries = store.entries.filter((e) => e.eventId === event.id && !e.scratched);
        for (const entry of eventEntries) {
          const athlete = store.athletes.find((a) => a.id === entry.athleteId);
          const team = athlete?.teamId ? store.teams.find((t) => t.id === athlete.teamId) : null;
          const result =
            exportType === "results" || exportType === "both"
              ? store.results.find((r) => r.entryId === entry.id)
              : null;
          allEntries.push({
            ...entry,
            eventId: event.id,
            athleteFirstName: athlete?.firstName ?? "",
            athleteLastName: athlete?.lastName ?? "",
            gender: athlete?.gender ?? event.gender,
            dateOfBirth: athlete?.dateOfBirth,
            ussNumber: athlete?.idNumber,
            teamName: team?.name,
            teamCode: team?.abbreviation ?? team?.name?.substring(0, 4) ?? "UNAT",
            result: result
              ? {
                  finishTime: result.finishTime,
                  place: result.place,
                  dq: result.dq,
                  dqCode: result.dqCode,
                  ns: result.ns,
                  dnf: result.dnf,
                }
              : undefined,
          });
        }
      }

      // Build SDIF export data
      const exportData = buildSDIFExportData(meet, events, allEntries);
      const sdifText = generateSDIF(exportData, {
        type: exportType,
        programName: "SWMP",
        softwareVersion: "SwimManager Pro 1.0",
      });

      // Download
      const blob = new Blob([sdifText], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeName = meet.name.replace(/[^a-zA-Z0-9]/g, "_");
      a.href = url;
      a.download = `${safeName}_${exportType}.${fileFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "SDIF file exported", description: `${allEntries.length} entries exported as .${fileFormat}` });
    } catch (err: any) {
      const msg = err?.message ?? "Export failed";
      setError(msg);
      toast({ title: "Export failed", description: msg, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  const selectedMeetObj = meets?.find((m) => String(m.id) === selectedMeet);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" /> Export SDIF File
          </CardTitle>
          <CardDescription>
            Export meet entries or results as a standard SDIF file (.sd3, .hy3, or .cl2) compatible with
            Hy-Tek Meet Manager, Colorado Timing, and other USA Swimming software.
            <span className="ml-1 font-medium text-primary">.sd3 is the recommended modern format.</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Meet</Label>
              <Select value={selectedMeet} onValueChange={setSelectedMeet}>
                <SelectTrigger>
                  <SelectValue placeholder="Select meet to export…" />
                </SelectTrigger>
                <SelectContent>
                  {meets?.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.name}
                      <span className="ml-1 text-muted-foreground text-xs">({m.status})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Export Type</Label>
              <Select value={exportType} onValueChange={(v) => setExportType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entries">Entries Only (D0 records)</SelectItem>
                  <SelectItem value="results">Results Only (D3 records)</SelectItem>
                  <SelectItem value="both">Entries + Results</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>File Format</Label>
              <Select value={fileFormat} onValueChange={(v) => setFileFormat(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sd3">.sd3 — SDIF v3 (recommended)</SelectItem>
                  <SelectItem value="hy3">.hy3 — Hy-Tek Meet Manager</SelectItem>
                  <SelectItem value="cl2">.cl2 — Colorado Timing System</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedMeetObj && (
            <div className="flex gap-4 p-4 rounded-lg bg-muted/50 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {selectedMeetObj.startDate}
              </div>
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-muted-foreground" />
                {selectedMeetObj.course}
              </div>
              <Badge variant="outline">{selectedMeetObj.status}</Badge>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            size="lg"
            className="w-full sm:w-auto"
            disabled={!selectedMeet || exporting}
            onClick={handleExport}
          >
            {exporting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating…</>
            ) : (
              <><Download className="h-4 w-4 mr-2" />Export .{fileFormat} File</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Format Reference */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">SDIF Format Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">Record Types Generated</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li><span className="font-mono text-foreground">A0</span> — File description</li>
                <li><span className="font-mono text-foreground">B1</span> — Meet information</li>
                <li><span className="font-mono text-foreground">C1</span> — Team identification</li>
                <li><span className="font-mono text-foreground">D0</span> — Individual entry (entries export)</li>
                <li><span className="font-mono text-foreground">D3</span> — Individual result (results export)</li>
                <li><span className="font-mono text-foreground">Z0</span> — End of file</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Compatible With</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>✓ SD3 / SDIF v3.0 standard (.sd3)</li>
                <li>✓ Hy-Tek Meet Manager (.hy3)</li>
                <li>✓ Colorado Timing System (.cl2)</li>
                <li>✓ Team Manager / Team Unify</li>
                <li>✓ Swimtopia, Meet Mobile</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Download App Tab ─────────────────────────────────────────────────────────

function DownloadAppTab() {
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();

  async function handleDownloadApp() {
    setDownloading(true);
    try {
      const r = await fetch(`/api/app/download`);
      if (!r.ok) throw new Error(await r.text());
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "SwimManagerPro.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Download started", description: "SwimManagerPro.zip" });
    } catch (err: any) {
      toast({ title: "Download failed", description: err?.message, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" /> Download Application
          </CardTitle>
          <CardDescription>
            Download SwimManager Pro as a ZIP archive to run locally on any machine with Node.js installed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div className="p-4 rounded-lg border bg-muted/30">
              <h4 className="font-semibold mb-2">What's Included</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>✓ Full frontend (React + Vite build)</li>
                <li>✓ API server (Express + Node.js)</li>
                <li>✓ Database schema &amp; migrations</li>
                <li>✓ All reports &amp; PDF generation</li>
                <li>✓ SDIF import/export</li>
                <li>✓ Scoreboard &amp; live results</li>
              </ul>
            </div>
            <div className="p-4 rounded-lg border bg-muted/30">
              <h4 className="font-semibold mb-2">Requirements</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>Node.js 18+ (nodejs.org)</li>
                <li>PostgreSQL 14+ database</li>
                <li>pnpm (npm install -g pnpm)</li>
              </ul>
              <h4 className="font-semibold mt-4 mb-2">Quick Start</h4>
              <div className="font-mono text-xs bg-background rounded p-2 space-y-1">
                <div>unzip SwimManagerPro.zip</div>
                <div>cd SwimManagerPro</div>
                <div>pnpm install</div>
                <div>pnpm run setup</div>
                <div>pnpm run start</div>
              </div>
            </div>
          </div>

          <Button size="lg" onClick={handleDownloadApp} disabled={downloading}>
            {downloading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Packaging…</>
            ) : (
              <><Download className="h-4 w-4 mr-2" />Download SwimManager Pro (.zip)</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function SDIFPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">SD3 / SDIF Data Exchange</h1>
        <p className="text-muted-foreground">
          Import and export meet data in SD3 / SDIF format (.sd3, .hy3, .cl2) — compatible with Hy-Tek, Colorado Timing, and USA Swimming tools.
        </p>
      </div>

      <Tabs defaultValue="import" className="w-full">
        <TabsList>
          <TabsTrigger value="import" className="gap-2">
            <Upload className="h-3.5 w-3.5" /> Import
          </TabsTrigger>
          <TabsTrigger value="export" className="gap-2">
            <Download className="h-3.5 w-3.5" /> Export
          </TabsTrigger>
          <TabsTrigger value="download" className="gap-2">
            <FileText className="h-3.5 w-3.5" /> Download App
          </TabsTrigger>
        </TabsList>
        <TabsContent value="import" className="mt-6">
          <ImportTab />
        </TabsContent>
        <TabsContent value="export" className="mt-6">
          <ExportTab />
        </TabsContent>
        <TabsContent value="download" className="mt-6">
          <DownloadAppTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
