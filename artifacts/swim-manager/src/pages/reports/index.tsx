import { useState } from "react";
import { useListMeets, useListTeams, useListAthletes, useGetClub, useListTimeStandards } from "@/lib/local-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { FileText, Download, Loader2, Users, Trophy, ReceiptText, BookOpen, ClipboardList } from "lucide-react";
import {
  generatePsychSheet, generateHeatSheet, generateResults, generateEntryListByTeam,
  generateDQList, generateDQSlips, generateSplitSheet, generateAwardCounts,
  generateAwardLabels, generateTeamRoster, generateAthleteReport, generateInvoicePDF,
  generateBillingSummary, generateOutstandingInvoices, generateOfficialMemo,
  generateTimeStandardsReport, generateTimeline,
} from "@/lib/pdf";
import {
  buildPsychSheet, buildHeatSheet, buildResults, buildEntryListByTeam, buildDQs,
  buildSplitSheet, buildAwardCounts, buildAwardLabels, buildTeamFullReport,
  buildAthleteFullReport, buildBillingFullReport, buildTimeline,
} from "@/lib/report-data";

function ReportCard({
  title, description, icon: Icon, onGenerate, disabled, disabledReason,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  onGenerate: () => Promise<void>;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handle() {
    setLoading(true);
    try {
      await onGenerate();
    } catch (e: any) {
      toast({ title: "Report failed", description: e?.message ?? "Unexpected error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 p-2 rounded-md bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-sm">{title}</CardTitle>
            <CardDescription className="text-xs mt-1">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 mt-auto">
        {disabledReason && <p className="text-xs text-muted-foreground mb-2">{disabledReason}</p>}
        <Button size="sm" className="w-full" onClick={handle} disabled={disabled || loading}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Download className="h-3 w-3 mr-2" />}
          {loading ? "Generating..." : "Generate PDF"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState("meet");
  const [selectedMeet, setSelectedMeet] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [selectedAthlete, setSelectedAthlete] = useState("");
  const [memoOpen, setMemoOpen] = useState(false);
  const [memoForm, setMemoForm] = useState({ to: "", from: "", re: "", body: "" });

  const { data: meets } = useListMeets();
  const { data: teams } = useListTeams();
  const { data: athletes } = useListAthletes();
  const { data: club } = useGetClub();
  const { data: timestandards } = useListTimeStandards();
  const { toast } = useToast();

  const clubName = (club as any)?.name ?? "SwimManager Pro";
  const meetName = meets?.find(m => m.id === parseInt(selectedMeet))?.name ?? "Selected Meet";
  const teamName = teams?.find(t => t.id === parseInt(selectedTeam))?.name ?? "Selected Team";
  const athleteObj = athletes?.find(a => a.id === parseInt(selectedAthlete));
  const athleteName = athleteObj ? `${athleteObj.firstName} ${athleteObj.lastName}` : "Selected Athlete";

  // ── Meet report generators ─────────────────────────────────────────────────
  // All meet/team/athlete/billing reports are built client-side from local-store
  // (the app is localStorage-based — there is no backend serving report payloads).
  async function genPsychSheet() {
    generatePsychSheet(buildPsychSheet(parseInt(selectedMeet)));
  }
  async function genHeatSheet() {
    generateHeatSheet(buildHeatSheet(parseInt(selectedMeet)));
  }
  async function genResults() {
    generateResults(buildResults(parseInt(selectedMeet)));
  }
  async function genEntryListByTeam() {
    generateEntryListByTeam(buildEntryListByTeam(parseInt(selectedMeet)));
  }
  async function genTimeline() {
    generateTimeline(buildTimeline(parseInt(selectedMeet)));
  }
  async function genDQList() {
    generateDQList(buildDQs(parseInt(selectedMeet)));
  }
  async function genDQSlips() {
    const data = buildDQs(parseInt(selectedMeet));
    if (data.dqs.length === 0) { toast({ title: "No DQ/NS/DNF results to print", variant: "destructive" }); return; }
    generateDQSlips(data);
  }
  async function genSplitSheet() {
    generateSplitSheet(buildSplitSheet(parseInt(selectedMeet)));
  }
  async function genAwardCounts() {
    generateAwardCounts(buildAwardCounts(parseInt(selectedMeet)));
  }
  async function genAwardLabels() {
    generateAwardLabels(buildAwardLabels(parseInt(selectedMeet)));
  }

  // ── Team report generators ─────────────────────────────────────────────────
  async function genTeamRoster() {
    generateTeamRoster(buildTeamFullReport(parseInt(selectedTeam)));
  }
  async function genContactList() {
    const data = buildTeamFullReport(parseInt(selectedTeam));
    generateTeamRoster({ team: data.team, athletes: data.athletes });
  }
  async function genTeamEntryReport() {
    const meetData = buildEntryListByTeam(parseInt(selectedMeet));
    const team = meetData.teams.find((t) => t.team.id === parseInt(selectedTeam));
    if (!team) { toast({ title: "No entries found for this team in the selected meet", variant: "destructive" }); return; }
    generateEntryListByTeam({ meet: meetData.meet, teams: [team] });
  }

  // ── Athlete report generators ──────────────────────────────────────────────
  async function genAthleteReport() {
    generateAthleteReport(buildAthleteFullReport(parseInt(selectedAthlete)));
  }

  // ── Billing report generators ──────────────────────────────────────────────
  async function genAllInvoices() {
    generateBillingSummary(buildBillingFullReport().invoices, clubName);
  }
  async function genOutstanding() {
    generateOutstandingInvoices(buildBillingFullReport().invoices, clubName);
  }
  async function genAthleteInvoice() {
    const fullReport = buildAthleteFullReport(parseInt(selectedAthlete));
    if (!fullReport.invoices?.length) {
      toast({ title: "No invoices for this athlete", variant: "destructive" }); return;
    }
    const latestInvoice = fullReport.invoices[fullReport.invoices.length - 1];
    generateInvoicePDF(latestInvoice, athleteName, fullReport.athlete.teamName ?? "", clubName);
  }

  // ── Records / Time Standards ───────────────────────────────────────────────
  async function genTimeStandards() {
    generateTimeStandardsReport(timestandards ?? [], clubName);
  }
  async function genMemo() {
    setMemoOpen(true);
  }
  function submitMemo() {
    if (!memoForm.to || !memoForm.from || !memoForm.re || !memoForm.body) {
      toast({ title: "Please fill all memo fields", variant: "destructive" }); return;
    }
    generateOfficialMemo({ ...memoForm, clubName });
    setMemoOpen(false);
    setMemoForm({ to: "", from: "", re: "", body: "" });
  }

  const noMeet = !selectedMeet;
  const noTeam = !selectedTeam;
  const noAthlete = !selectedAthlete;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports & Documents</h1>
        <p className="text-muted-foreground">Generate professional PDF reports for meets, teams, athletes, and billing.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="meet" className="gap-2"><Trophy className="h-3.5 w-3.5" />Meet Reports</TabsTrigger>
          <TabsTrigger value="team" className="gap-2"><Users className="h-3.5 w-3.5" />Team Reports</TabsTrigger>
          <TabsTrigger value="athlete" className="gap-2"><FileText className="h-3.5 w-3.5" />Athlete Reports</TabsTrigger>
          <TabsTrigger value="billing" className="gap-2"><ReceiptText className="h-3.5 w-3.5" />Billing Reports</TabsTrigger>
          <TabsTrigger value="records" className="gap-2"><BookOpen className="h-3.5 w-3.5" />Records & Standards</TabsTrigger>
        </TabsList>

        {/* ── MEET REPORTS ─────────────────────────────────────────────────── */}
        <TabsContent value="meet" className="mt-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 max-w-xs">
              <Select value={selectedMeet} onValueChange={setSelectedMeet}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a meet…" />
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
            {selectedMeet && (
              <span className="text-sm text-muted-foreground">
                Reports for: <strong>{meetName}</strong>
              </span>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ReportCard
              title="Psych Sheet"
              description="Pre-meet entry list for each event, sorted by seed time. For distribution to coaches and families."
              icon={ClipboardList}
              onGenerate={genPsychSheet}
              disabled={noMeet}
              disabledReason={noMeet ? "Select a meet above" : undefined}
            />
            <ReportCard
              title="Heat Sheet"
              description="Complete heat-by-heat lane assignments after seeding. Shows each heat with athlete, team, and seed time."
              icon={ClipboardList}
              onGenerate={genHeatSheet}
              disabled={noMeet}
              disabledReason={noMeet ? "Select a meet above" : undefined}
            />
            <ReportCard
              title="Official Results"
              description="Final results for all events, including place, time, points, DQ/NS/DNF annotations."
              icon={Trophy}
              onGenerate={genResults}
              disabled={noMeet}
              disabledReason={noMeet ? "Select a meet above" : undefined}
            />
            <ReportCard
              title="Entry List by Team"
              description="All entries organized by team and athlete. Standard admin and entry verification report."
              icon={Users}
              onGenerate={genEntryListByTeam}
              disabled={noMeet}
              disabledReason={noMeet ? "Select a meet above" : undefined}
            />
            <ReportCard
              title="Timeline"
              description="Estimated meet run-order timeline by session, with event entry/heat counts and projected start times."
              icon={ClipboardList}
              onGenerate={genTimeline}
              disabled={noMeet}
              disabledReason={noMeet ? "Select a meet above" : undefined}
            />
            <ReportCard
              title="Split Sheet"
              description="Coach copy with per-heat split times for each athlete. For detailed race analysis after the meet."
              icon={FileText}
              onGenerate={genSplitSheet}
              disabled={noMeet}
              disabledReason={noMeet ? "Select a meet above" : undefined}
            />
            <ReportCard
              title="DQ / NS / DNF List"
              description="Complete list of all disqualifications, no-shows, and did-not-finishes with DQ codes. For admin use."
              icon={FileText}
              onGenerate={genDQList}
              disabled={noMeet}
              disabledReason={noMeet ? "Select a meet above" : undefined}
            />
            <ReportCard
              title="DQ Slips"
              description="Individual printable disqualification slip for each DQ — to hand to athlete and coach per USAS rules."
              icon={FileText}
              onGenerate={genDQSlips}
              disabled={noMeet}
              disabledReason={noMeet ? "Select a meet above" : undefined}
            />
            <ReportCard
              title="Award Counts"
              description="Number of 1st–6th place awards earned per team. Used for ordering ribbons, medals, and trophies."
              icon={Trophy}
              onGenerate={genAwardCounts}
              disabled={noMeet}
              disabledReason={noMeet ? "Select a meet above" : undefined}
            />
            <ReportCard
              title="Award Label Sheets"
              description="Printable Avery-style labels (3×10 per page) for ribbons and medals. Shows place, event, athlete, time."
              icon={ClipboardList}
              onGenerate={genAwardLabels}
              disabled={noMeet}
              disabledReason={noMeet ? "Select a meet above" : undefined}
            />
          </div>
        </TabsContent>

        {/* ── TEAM REPORTS ─────────────────────────────────────────────────── */}
        <TabsContent value="team" className="mt-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 max-w-xs">
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a team…" />
                </SelectTrigger>
                <SelectContent>
                  {teams?.map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedTeam && (
              <span className="text-sm text-muted-foreground">Reports for: <strong>{teamName}</strong></span>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ReportCard
              title="Team Roster"
              description="Complete active roster with name, gender, DOB, age, phone, email, parent info, and ID number."
              icon={Users}
              onGenerate={genTeamRoster}
              disabled={noTeam}
              disabledReason={noTeam ? "Select a team above" : undefined}
            />
            <ReportCard
              title="Contact List"
              description="Athlete and parent contact information for coaches and administrators."
              icon={Users}
              onGenerate={genContactList}
              disabled={noTeam}
              disabledReason={noTeam ? "Select a team above" : undefined}
            />
            <ReportCard
              title="Team Entry Report"
              description="All entries for this team in the selected meet, organized by athlete."
              icon={ClipboardList}
              onGenerate={genTeamEntryReport}
              disabled={noTeam || noMeet}
              disabledReason={noTeam || noMeet ? "Select both a team and a meet above" : undefined}
            />
          </div>
        </TabsContent>

        {/* ── ATHLETE REPORTS ───────────────────────────────────────────────── */}
        <TabsContent value="athlete" className="mt-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 max-w-xs">
              <Select value={selectedAthlete} onValueChange={setSelectedAthlete}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an athlete…" />
                </SelectTrigger>
                <SelectContent>
                  {athletes?.map(a => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.firstName} {a.lastName}
                      <span className="text-muted-foreground ml-1 text-xs">({a.gender})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedAthlete && (
              <span className="text-sm text-muted-foreground">Reports for: <strong>{athleteName}</strong></span>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ReportCard
              title="Athlete Profile Report"
              description="Complete athlete profile including contact info, parent info, health notes, and billing history."
              icon={FileText}
              onGenerate={genAthleteReport}
              disabled={noAthlete}
              disabledReason={noAthlete ? "Select an athlete above" : undefined}
            />
            <ReportCard
              title="Individual Invoice PDF"
              description="Generate a printable invoice for the athlete's most recent invoice. Professional invoice format."
              icon={ReceiptText}
              onGenerate={genAthleteInvoice}
              disabled={noAthlete}
              disabledReason={noAthlete ? "Select an athlete above" : undefined}
            />
          </div>
        </TabsContent>

        {/* ── BILLING REPORTS ───────────────────────────────────────────────── */}
        <TabsContent value="billing" className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ReportCard
              title="Billing Summary Report"
              description="Full billing summary for all athletes — total outstanding, overdue, paid, and line-item table."
              icon={ReceiptText}
              onGenerate={genAllInvoices}
            />
            <ReportCard
              title="Outstanding Invoices"
              description="List of all pending and overdue invoices only. Quick view of amounts owed across the club."
              icon={ReceiptText}
              onGenerate={genOutstanding}
            />
            <ReportCard
              title="Official Memo"
              description="Generate a professional formatted memo for billing notices, club communications, or policy updates."
              icon={FileText}
              onGenerate={genMemo}
            />
          </div>
        </TabsContent>

        {/* ── RECORDS & STANDARDS ───────────────────────────────────────────── */}
        <TabsContent value="records" className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ReportCard
              title="Time Standards Report"
              description="All configured time standards with course, gender, age group, event, and cut times."
              icon={BookOpen}
              onGenerate={genTimeStandards}
            />
            <ReportCard
              title="Official Memo"
              description="Generate a formatted official memo — for communications about records, policy changes, or announcements."
              icon={FileText}
              onGenerate={genMemo}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Memo Dialog */}
      <Dialog open={memoOpen} onOpenChange={setMemoOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Official Memo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>TO</Label>
              <Input value={memoForm.to} onChange={e => setMemoForm(p => ({ ...p, to: e.target.value }))} placeholder="All Coaches / Athlete Families / Board" />
            </div>
            <div className="space-y-1.5">
              <Label>FROM</Label>
              <Input value={memoForm.from} onChange={e => setMemoForm(p => ({ ...p, from: e.target.value }))} placeholder="Head Coach / Meet Director" />
            </div>
            <div className="space-y-1.5">
              <Label>RE (Subject)</Label>
              <Input value={memoForm.re} onChange={e => setMemoForm(p => ({ ...p, re: e.target.value }))} placeholder="e.g. Entry Deadline Reminder" />
            </div>
            <div className="space-y-1.5">
              <Label>Body</Label>
              <Textarea
                rows={6}
                value={memoForm.body}
                onChange={e => setMemoForm(p => ({ ...p, body: e.target.value }))}
                placeholder="Type memo body here…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMemoOpen(false)}>Cancel</Button>
            <Button onClick={submitMemo}><Download className="mr-2 h-4 w-4" />Generate PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
