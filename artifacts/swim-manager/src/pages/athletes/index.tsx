import { useState, useRef } from "react";
import { useListAthletes, useListTeams, readStore, writeStore, nextId } from "@/lib/local-store";
import type { Athlete } from "@/lib/local-store";
import { parseEv3, ev3Summary } from "@/lib/ev3-parser";
import { Link } from "wouter";
import { Plus, Search, Upload, CheckCircle2, AlertTriangle, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

// ─── CSV athlete import ───────────────────────────────────────────────────────

interface ParsedCSVAthlete {
  firstName: string;
  lastName: string;
  gender?: string;
  dateOfBirth?: string;
  trainingGroup?: string;
  idNumber?: string;
  email?: string;
  phone?: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  healthNotes?: string;
  notes?: string;
  teamName?: string;
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_\-\.]/g, "");
}

const HEADER_MAP: Record<string, keyof ParsedCSVAthlete> = {
  firstname: "firstName",
  first: "firstName",
  fname: "firstName",
  lastname: "lastName",
  last: "lastName",
  lname: "lastName",
  gender: "gender",
  sex: "gender",
  dateofbirth: "dateOfBirth",
  dob: "dateOfBirth",
  birthdate: "dateOfBirth",
  birthday: "dateOfBirth",
  traininggroup: "trainingGroup",
  group: "trainingGroup",
  squad: "trainingGroup",
  idnumber: "idNumber",
  ussid: "idNumber",
  usasid: "idNumber",
  memberid: "idNumber",
  id: "idNumber",
  email: "email",
  phone: "phone",
  telephone: "phone",
  parentname: "parentName",
  guardian: "parentName",
  parentemail: "parentEmail",
  guardianemail: "parentEmail",
  parentphone: "parentPhone",
  guardianphone: "parentPhone",
  healthnotes: "healthNotes",
  health: "healthNotes",
  medical: "healthNotes",
  notes: "notes",
  team: "teamName",
  teamname: "teamName",
  club: "teamName",
};

function parseAthleteCSV(text: string): ParsedCSVAthlete[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  function splitCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; }
      else { current += ch; }
    }
    result.push(current.trim());
    return result;
  }

  const headers = splitCSVLine(lines[0]).map(normalizeHeader);
  const fieldMap: Array<keyof ParsedCSVAthlete | null> = headers.map((h) => HEADER_MAP[h] ?? null);

  const athletes: ParsedCSVAthlete[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = splitCSVLine(lines[i]);
    const a: ParsedCSVAthlete = { firstName: "", lastName: "" };
    fieldMap.forEach((field, idx) => {
      if (field && vals[idx]) {
        (a as any)[field] = vals[idx].replace(/^"|"$/g, "").trim();
      }
    });
    if (!a.firstName && !a.lastName) continue;
    athletes.push(a);
  }
  return athletes;
}

function normalizeGender(g?: string): string {
  if (!g) return "M";
  const up = g.toUpperCase();
  if (up === "F" || up === "FEMALE" || up === "GIRL" || up === "W" || up === "WOMEN") return "F";
  if (up === "X" || up === "NB" || up === "NON-BINARY") return "X";
  return "M";
}

interface CSVImportDialogProps {
  open: boolean;
  onClose: () => void;
}

function CSVImportDialog({ open, onClose }: CSVImportDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ParsedCSVAthlete[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [defaultTeamId, setDefaultTeamId] = useState<string>("");
  const [imported, setImported] = useState(false);
  const { data: teams } = useListTeams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setPreview([]);
    setImported(false);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const parsed = parseAthleteCSV(text);
        if (parsed.length === 0) {
          setError("No athletes found. Check that the CSV has firstName and lastName columns.");
          return;
        }
        setPreview(parsed);
      } catch (err: any) {
        setError(err?.message ?? "Failed to parse CSV");
      }
    };
    reader.readAsText(file);
  }

  function handleImport() {
    if (preview.length === 0) return;
    try {
      const store = readStore();
      const newAthletes: Athlete[] = [];
      const now = new Date().toISOString();

      for (const p of preview) {
        let teamId: number | undefined = defaultTeamId ? parseInt(defaultTeamId, 10) : undefined;

        if (p.teamName && !teamId) {
          const found = store.teams.find((t) =>
            t.name.toLowerCase() === p.teamName!.toLowerCase() ||
            t.abbreviation?.toLowerCase() === p.teamName!.toLowerCase()
          );
          if (found) teamId = found.id;
        }

        const athlete: Athlete = {
          id: nextId([...store.athletes, ...newAthletes]),
          firstName: p.firstName,
          lastName: p.lastName,
          gender: normalizeGender(p.gender),
          dateOfBirth: p.dateOfBirth || undefined,
          trainingGroup: p.trainingGroup || undefined,
          idNumber: p.idNumber || undefined,
          email: p.email || undefined,
          phone: p.phone || undefined,
          parentName: p.parentName || undefined,
          parentEmail: p.parentEmail || undefined,
          parentPhone: p.parentPhone || undefined,
          healthNotes: p.healthNotes || undefined,
          notes: p.notes || undefined,
          teamId,
          active: true,
          createdAt: now,
        };
        newAthletes.push(athlete);
      }

      writeStore({ ...store, athletes: [...store.athletes, ...newAthletes] });
      queryClient.invalidateQueries({ queryKey: ["athletes"] });
      setImported(true);
      toast({ title: "Athletes imported", description: `${newAthletes.length} athletes added to roster.` });
    } catch (err: any) {
      setError(err?.message ?? "Import failed");
    }
  }

  function handleClose() {
    setPreview([]);
    setFileName("");
    setError(null);
    setImported(false);
    setDefaultTeamId("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Import Athletes from CSV
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
          <div
            className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="font-medium text-sm">{fileName || "Click to select a .csv file"}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Columns: firstName, lastName, gender, dateOfBirth, trainingGroup, idNumber, email, phone, parentName, team, notes…
            </p>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {imported && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-900/20">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-300">
                {preview.length} athletes imported successfully.
              </AlertDescription>
            </Alert>
          )}

          {preview.length > 0 && !imported && (
            <>
              <div className="flex items-center gap-3">
                <div className="space-y-1 flex-1 max-w-xs">
                  <Label className="text-xs">Default Team (for athletes without a team column)</Label>
                  <Select value={defaultTeamId} onValueChange={setDefaultTeamId}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="No default team" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No default team</SelectItem>
                      {teams?.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-sm text-muted-foreground pt-5">
                  <Badge variant="secondary">{preview.length} athletes found</Badge>
                </div>
              </div>

              <div className="border rounded-md overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4">Name</TableHead>
                        <TableHead>Gender</TableHead>
                        <TableHead>DOB</TableHead>
                        <TableHead>Group</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead>ID #</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.slice(0, 100).map((a, i) => (
                        <TableRow key={i}>
                          <TableCell className="pl-4 font-medium">
                            {a.lastName ? `${a.lastName}, ${a.firstName}` : a.firstName}
                          </TableCell>
                          <TableCell>{a.gender || "—"}</TableCell>
                          <TableCell className="text-xs">{a.dateOfBirth || "—"}</TableCell>
                          <TableCell className="text-xs">{a.trainingGroup || "—"}</TableCell>
                          <TableCell className="text-xs">{a.teamName || "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{a.idNumber || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {preview.length > 100 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Showing 100 of {preview.length}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="pt-2 border-t border-border">
          <DialogClose asChild>
            <Button variant="outline" onClick={handleClose}>
              <X className="h-4 w-4 mr-1" /> Close
            </Button>
          </DialogClose>
          {preview.length > 0 && !imported && (
            <Button onClick={handleImport}>
              <Upload className="h-4 w-4 mr-1" /> Import {preview.length} Athletes
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── EV3 / Hy-Tek import dialog ───────────────────────────────────────────────

interface Ev3ImportDialogProps {
  open: boolean;
  onClose: () => void;
}

function Ev3ImportDialog({ open, onClose }: Ev3ImportDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [athleteCount, setAthleteCount] = useState(0);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState(false);
  const [defaultTeamId, setDefaultTeamId] = useState<string>("");
  const [parsedData, setParsedData] = useState<ReturnType<typeof parseEv3> | null>(null);
  const { data: teams } = useListTeams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setSummary(null);
    setImported(false);
    setParsedData(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const result = parseEv3(text);
        if (result.athletes.length === 0 && result.entries.length === 0) {
          setError("No athletes or entries found in this file. Ensure it's a valid EV3/HY3 file.");
          return;
        }
        setParsedData(result);
        setSummary(ev3Summary(result));
        setAthleteCount(result.athletes.length);
      } catch (err: any) {
        setError(err?.message ?? "Failed to parse EV3 file");
      }
    };
    reader.readAsText(file);
  }

  function handleImport() {
    if (!parsedData || parsedData.athletes.length === 0) return;
    try {
      const store = readStore();
      const newAthletes: Athlete[] = [];
      const now = new Date().toISOString();

      for (const p of parsedData.athletes) {
        // Try to match team by abbreviation
        let teamId: number | undefined = defaultTeamId ? parseInt(defaultTeamId, 10) : undefined;
        if (p.teamAbbr && !teamId) {
          const found = store.teams.find((t) =>
            t.abbreviation?.toLowerCase() === p.teamAbbr.toLowerCase() ||
            t.name.toLowerCase().includes(p.teamAbbr.toLowerCase())
          );
          if (found) teamId = found.id;
        }

        // Parse birthdate from MMDDYYYY
        let dob: string | undefined;
        if (p.birthDate && p.birthDate.length === 8) {
          dob = `${p.birthDate.slice(4, 8)}-${p.birthDate.slice(0, 2)}-${p.birthDate.slice(2, 4)}`;
        }

        const athlete: Athlete = {
          id: nextId([...store.athletes, ...newAthletes]),
          firstName: p.firstName,
          lastName: p.lastName,
          gender: p.sex === "M" ? "M" : p.sex === "F" ? "F" : "X",
          dateOfBirth: dob,
          idNumber: p.ussNumber || undefined,
          teamId,
          active: true,
          createdAt: now,
        };
        newAthletes.push(athlete);
      }

      writeStore({ ...store, athletes: [...store.athletes, ...newAthletes] });
      queryClient.invalidateQueries({ queryKey: ["athletes"] });
      setImported(true);
      toast({ title: "EV3 import complete", description: `${newAthletes.length} athletes added from ${fileName}.` });
    } catch (err: any) {
      setError(err?.message ?? "Import failed");
    }
  }

  function handleClose() {
    setSummary(null);
    setAthleteCount(0);
    setFileName("");
    setError(null);
    setImported(false);
    setDefaultTeamId("");
    setParsedData(null);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Import from EV3 / Hy-Tek File
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div
            className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="font-medium text-sm">{fileName || "Click to select an EV3/HY3 file"}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Accepts Hy-Tek .ev3, .ev4, .hy3 swimmer entry files
            </p>
            <input ref={fileRef} type="file" accept=".ev3,.ev4,.hy3,.txt" className="hidden" onChange={handleFile} />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {summary && !imported && (
            <Alert className="border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20">
              <CheckCircle2 className="h-4 w-4 text-cyan-600" />
              <AlertDescription className="text-cyan-800 dark:text-cyan-300 text-xs">{summary}</AlertDescription>
            </Alert>
          )}

          {imported && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-900/20">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-300">
                {athleteCount} athletes imported successfully.
              </AlertDescription>
            </Alert>
          )}

          {parsedData && parsedData.athletes.length > 0 && !imported && (
            <div>
              <Label className="text-xs mb-1.5 block">Default Team (if not matched by abbreviation)</Label>
              <Select value={defaultTeamId} onValueChange={setDefaultTeamId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Auto-match by abbreviation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-match by abbreviation</SelectItem>
                  {teams?.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name} ({t.abbreviation})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {parsedData && parsedData.errors.length > 0 && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">{parsedData.errors.length} parse warnings (click to expand)</summary>
              <ul className="mt-1 space-y-0.5 pl-3">
                {parsedData.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </details>
          )}
        </div>

        <DialogFooter className="pt-2 border-t border-border">
          <DialogClose asChild>
            <Button variant="outline" onClick={handleClose}><X className="h-4 w-4 mr-1" /> Close</Button>
          </DialogClose>
          {parsedData && parsedData.athletes.length > 0 && !imported && (
            <Button onClick={handleImport}>
              <Upload className="h-4 w-4 mr-1" /> Import {parsedData.athletes.length} Athletes
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Athletes page ────────────────────────────────────────────────────────────

export default function Athletes() {
  const [search, setSearch] = useState("");
  const [csvOpen, setCsvOpen] = useState(false);
  const [ev3Open, setEv3Open] = useState(false);
  const { data: allAthletes, isLoading } = useListAthletes();
  const athletes = search
    ? allAthletes?.filter((a: any) => `${a.firstName} ${a.lastName}`.toLowerCase().includes(search.toLowerCase()))
    : allAthletes;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Roster</h1>
          <p className="text-muted-foreground">Manage athlete profiles, medical information, and records.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCsvOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEv3Open(true)}>
            <FileText className="mr-2 h-4 w-4" />
            Import EV3
          </Button>
          <Link href="/athletes/new" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
            <Plus className="mr-2 h-4 w-4" />
            Add Athlete
          </Link>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            type="search" 
            placeholder="Search athletes by name..." 
            className="pl-8" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Age / DOB</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>ID Number</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">Loading...</TableCell>
              </TableRow>
            ) : athletes?.map((athlete) => (
              <TableRow key={athlete.id}>
                <TableCell className="font-medium">
                  <Link href={`/athletes/${athlete.id}`} className="text-primary hover:underline">
                    {athlete.lastName}, {athlete.firstName}
                  </Link>
                </TableCell>
                <TableCell>{athlete.gender}</TableCell>
                <TableCell>
                  {(athlete as any).age || (athlete.dateOfBirth ? new Date().getFullYear() - new Date(athlete.dateOfBirth).getFullYear() : "—")} 
                  {athlete.dateOfBirth && <span className="text-muted-foreground text-xs ml-2">({athlete.dateOfBirth})</span>}
                </TableCell>
                <TableCell>{(athlete as any).teamName || "Unattached"}</TableCell>
                <TableCell className="font-mono text-xs">{athlete.idNumber || "-"}</TableCell>
              </TableRow>
            ))}
            {!isLoading && (!athletes || athletes.length === 0) && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No athletes found. Add one or import from CSV.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <CSVImportDialog open={csvOpen} onClose={() => setCsvOpen(false)} />
      <Ev3ImportDialog open={ev3Open} onClose={() => setEv3Open(false)} />
    </div>
  );
}
