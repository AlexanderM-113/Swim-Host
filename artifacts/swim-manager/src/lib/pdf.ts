import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const POOL_BLUE = [13, 58, 92] as [number, number, number];
const POOL_LIGHT = [26, 106, 156] as [number, number, number];
const POOL_STRIPE = [224, 240, 252] as [number, number, number];
const WHITE = [255, 255, 255] as [number, number, number];

export function fmtTime(seconds: number | null | undefined): string {
  if (seconds == null) return "NT";
  if (seconds < 60) return seconds.toFixed(2);
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(2).padStart(5, "0");
  return `${m}:${s}`;
}

function fmtGender(g: string) {
  return g === "M" ? "Men" : g === "F" ? "Women" : "Mixed";
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function nowStr() {
  return new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function pageHeader(doc: jsPDF, title: string, meetName: string) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...POOL_BLUE);
  doc.rect(0, 0, w, 48, "F");
  doc.setTextColor(...WHITE);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 22);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(meetName, 14, 36);
  doc.setFontSize(8);
  doc.text(`Generated: ${nowStr()}`, w - 14, 36, { align: "right" });
  doc.setTextColor(0, 0, 0);
}

function pageFooter(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text("SwimManager Pro", 14, h - 10);
  doc.text(`Page ${(doc as any).internal.getCurrentPageInfo().pageNumber}`, w - 14, h - 10, { align: "right" });
  doc.setTextColor(0, 0, 0);
}

function tableBase(doc: jsPDF, startY: number, title: string, meetName: string, head: string[][], body: (string | number)[][], colWidths?: number[]) {
  const colStyles: Record<number, { cellWidth: number }> = {};
  if (colWidths) colWidths.forEach((w, i) => { colStyles[i] = { cellWidth: w }; });

  autoTable(doc, {
    head,
    body,
    startY,
    theme: "grid",
    headStyles: { fillColor: POOL_BLUE, textColor: WHITE, fontStyle: "bold", fontSize: 8.5, cellPadding: 3 },
    bodyStyles: { fontSize: 8, cellPadding: 2.5 },
    alternateRowStyles: { fillColor: POOL_STRIPE },
    margin: { top: 55, left: 14, right: 14, bottom: 22 },
    columnStyles: colWidths ? colStyles : {},
    didDrawPage: () => {
      pageHeader(doc, title, meetName);
      pageFooter(doc);
    },
  });
}

function eventBanner(doc: jsPDF, text: string, y: number): number {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...POOL_LIGHT);
  doc.setTextColor(...WHITE);
  doc.rect(14, y, w - 28, 14, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(text, 18, y + 10);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  return y + 14;
}

function startDoc(title: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  return doc;
}

// ─── PSYCH SHEET ──────────────────────────────────────────────────────────────
export function generatePsychSheet(data: { meet: any; events: any[] }) {
  const doc = startDoc("Psych Sheet");
  const title = "Psych Sheet";
  const meetName = `${data.meet.name} — ${fmtDate(data.meet.startDate)} — ${data.meet.course}`;

  pageHeader(doc, title, meetName);
  pageFooter(doc);

  let y = 58;
  for (const event of data.events) {
    if (!event.entries || event.entries.length === 0) continue;
    if (y > 680) { doc.addPage(); y = 58; }
    y = eventBanner(doc, `Event ${event.eventNumber} — ${fmtGender(event.gender)} ${event.ageGroup || "Open"} ${event.distance} ${event.stroke} (${event.eventType || "Standard"})`, y);

    const head = [["#", "Athlete", "Team", "Age", "Seed Time", "Course"]];
    const body = event.entries.map((e: any) => [
      e.rank,
      e.athleteName,
      e.teamAbbreviation ?? "-",
      e.age ?? "-",
      fmtTime(e.seedTime),
      e.seedCourse ?? "-",
    ]);

    autoTable(doc, {
      head, body,
      startY: y,
      theme: "grid",
      headStyles: { fillColor: POOL_BLUE, textColor: WHITE, fontStyle: "bold", fontSize: 8, cellPadding: 2.5 },
      bodyStyles: { fontSize: 7.5, cellPadding: 2 },
      alternateRowStyles: { fillColor: POOL_STRIPE },
      margin: { top: 55, left: 14, right: 14, bottom: 22 },
      columnStyles: { 0: { cellWidth: 28 }, 3: { cellWidth: 28 }, 4: { cellWidth: 58 }, 5: { cellWidth: 38 } },
      didDrawPage: () => { pageHeader(doc, title, meetName); pageFooter(doc); },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  doc.save(`psych-sheet-${data.meet.name.replace(/\s+/g, "-")}.pdf`);
}

// ─── HEAT SHEET ───────────────────────────────────────────────────────────────
export function generateHeatSheet(data: { meet: any; events: any[] }) {
  const doc = startDoc("Heat Sheet");
  const title = "Heat Sheet";
  const meetName = `${data.meet.name} — ${fmtDate(data.meet.startDate)} — ${data.meet.course}`;

  pageHeader(doc, title, meetName);
  pageFooter(doc);

  let y = 58;
  for (const event of data.events) {
    if (!event.heats || event.heats.length === 0) continue;
    if (y > 680) { doc.addPage(); y = 58; }
    y = eventBanner(doc, `Event ${event.eventNumber} — ${fmtGender(event.gender)} ${event.ageGroup || "Open"} ${event.distance} ${event.stroke} — ${event.heats.length} Heat(s)`, y);

    for (const heat of event.heats) {
      if (y > 650) { doc.addPage(); y = 58; }
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setFillColor(240, 240, 240);
      doc.rect(14, y, doc.internal.pageSize.getWidth() - 28, 12, "F");
      doc.text(`Heat ${heat.heatNumber}`, 18, y + 9);
      doc.setFont("helvetica", "normal");
      y += 12;

      const head = [["Lane", "Athlete", "Team", "Age", "Seed Time", "Course", "Finish Time"]];
      const body = heat.lanes.map((l: any) => [
        l.lane ?? "-",
        l.athleteName,
        l.teamAbbreviation ?? "-",
        l.age ?? "-",
        fmtTime(l.seedTime),
        l.seedCourse ?? "-",
        "",
      ]);

      autoTable(doc, {
        head, body,
        startY: y,
        theme: "grid",
        headStyles: { fillColor: POOL_BLUE, textColor: WHITE, fontStyle: "bold", fontSize: 7.5, cellPadding: 2 },
        bodyStyles: { fontSize: 7.5, cellPadding: 2 },
        alternateRowStyles: { fillColor: POOL_STRIPE },
        margin: { top: 55, left: 14, right: 14, bottom: 22 },
        columnStyles: { 0: { cellWidth: 32 }, 3: { cellWidth: 28 }, 4: { cellWidth: 54 }, 5: { cellWidth: 38 }, 6: { cellWidth: 60 } },
        didDrawPage: () => { pageHeader(doc, title, meetName); pageFooter(doc); },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }
    y += 6;
  }

  doc.save(`heat-sheet-${data.meet.name.replace(/\s+/g, "-")}.pdf`);
}

// ─── RESULTS REPORT ───────────────────────────────────────────────────────────
export function generateResults(data: { meet: any; events: any[] }) {
  const doc = startDoc("Results");
  const title = "Official Results";
  const meetName = `${data.meet.name} — ${fmtDate(data.meet.startDate)} — ${data.meet.course}`;

  pageHeader(doc, title, meetName);
  pageFooter(doc);

  let y = 58;
  for (const event of data.events) {
    if (!event.results || event.results.length === 0) continue;
    if (y > 680) { doc.addPage(); y = 58; }
    const roundSuffix = event.roundLabel ? ` — ${event.roundLabel}` : "";
    y = eventBanner(doc, `Event ${event.eventNumber} — ${fmtGender(event.gender)} ${event.ageGroup || "Open"} ${event.distance} ${event.stroke}${roundSuffix}`, y);

    // Show a Prelim column only on finals blocks where prelim times are present.
    const showPrelim = event.results.some((r: any) => r.prelimTime != null);
    const head = showPrelim
      ? [["Place", "Athlete", "Team", "Age", "Seed Time", "Prelim", "Finals Time", "Points", "Notes"]]
      : [["Place", "Athlete", "Team", "Age", "Seed Time", "Finish Time", "Points", "Notes"]];
    const body = event.results.map((r: any) => {
      const base = [
        r.dq ? "DQ" : r.ns ? "NS" : r.dnf ? "DNF" : r.place ?? "-",
        r.athleteName,
        r.teamAbbreviation ?? "-",
        r.age ?? "-",
        fmtTime(r.seedTime),
      ];
      const tail = [
        r.points != null ? r.points.toFixed(1) : "-",
        r.dq ? (r.dqCode ?? "DQ") : r.ns ? "No Show" : r.dnf ? "Did Not Finish" : "",
      ];
      return showPrelim
        ? [...base, fmtTime(r.prelimTime), fmtTime(r.finishTime), ...tail]
        : [...base, fmtTime(r.finishTime), ...tail];
    });

    autoTable(doc, {
      head, body,
      startY: y,
      theme: "grid",
      headStyles: { fillColor: POOL_BLUE, textColor: WHITE, fontStyle: "bold", fontSize: 8, cellPadding: 2.5 },
      bodyStyles: { fontSize: 7.5, cellPadding: 2 },
      alternateRowStyles: { fillColor: POOL_STRIPE },
      margin: { top: 55, left: 14, right: 14, bottom: 22 },
      columnStyles: { 0: { cellWidth: 36 }, 3: { cellWidth: 28 }, 4: { cellWidth: 54 } },
      didDrawPage: () => { pageHeader(doc, title, meetName); pageFooter(doc); },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  doc.save(`results-${data.meet.name.replace(/\s+/g, "-")}.pdf`);
}

// ─── ENTRY LIST BY TEAM ───────────────────────────────────────────────────────
export function generateEntryListByTeam(data: { meet: any; teams: any[] }) {
  const doc = startDoc("Entry List");
  const title = "Entry List by Team";
  const meetName = `${data.meet.name} — ${fmtDate(data.meet.startDate)} — ${data.meet.course}`;

  pageHeader(doc, title, meetName);
  pageFooter(doc);

  let y = 58;
  for (const teamGroup of data.teams) {
    if (y > 680) { doc.addPage(); y = 58; }
    y = eventBanner(doc, `${teamGroup.team.name} (${teamGroup.team.abbreviation ?? "—"}) — Coach: ${teamGroup.team.coachName ?? "—"} — ${teamGroup.athletes.length} Athlete(s)`, y);

    for (const ath of teamGroup.athletes) {
      if (y > 660) { doc.addPage(); y = 58; }
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(`${ath.athleteName}  (${ath.gender === "M" ? "Male" : "Female"}, Age ${ath.age})`, 18, y + 8);
      doc.setFont("helvetica", "normal");
      y += 14;

      const head = [["Event #", "Event", "Seed Time", "Course"]];
      const body = ath.events.map((e: any) => [e.eventNumber ?? "-", e.eventName, fmtTime(e.seedTime), e.seedCourse ?? "-"]);

      autoTable(doc, {
        head, body,
        startY: y,
        theme: "grid",
        headStyles: { fillColor: POOL_LIGHT, textColor: WHITE, fontStyle: "bold", fontSize: 7.5, cellPadding: 2 },
        bodyStyles: { fontSize: 7.5, cellPadding: 2 },
        alternateRowStyles: { fillColor: POOL_STRIPE },
        margin: { top: 55, left: 14, right: 14, bottom: 22 },
        columnStyles: { 0: { cellWidth: 40 }, 2: { cellWidth: 60 }, 3: { cellWidth: 45 } },
        didDrawPage: () => { pageHeader(doc, title, meetName); pageFooter(doc); },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }
    y += 8;
  }

  doc.save(`entry-list-by-team-${data.meet.name.replace(/\s+/g, "-")}.pdf`);
}

// ─── DQ LIST ──────────────────────────────────────────────────────────────────
export function generateDQList(data: { meet: any; dqs: any[] }) {
  const doc = startDoc("DQ List");
  const title = "Disqualification / NS / DNF Report";
  const meetName = `${data.meet.name} — ${fmtDate(data.meet.startDate)}`;

  pageHeader(doc, title, meetName);
  pageFooter(doc);

  const head = [["Event #", "Event", "Athlete", "Team", "Heat", "Lane", "Status", "DQ Code"]];
  const body = data.dqs.map((d: any) => [
    d.eventNumber ?? "-",
    d.eventName,
    d.athleteName,
    d.teamAbbreviation ?? "-",
    d.heatNumber ?? "-",
    d.lane ?? "-",
    d.dq ? "DQ" : d.ns ? "NS" : d.dnf ? "DNF" : "-",
    d.dqCode ?? "-",
  ]);

  tableBase(doc, 58, title, meetName, head, body, [28, 100, 100, 50, 30, 30, 32, 100]);
  doc.save(`dq-list-${data.meet.name.replace(/\s+/g, "-")}.pdf`);
}

// ─── DQ SLIPS ─────────────────────────────────────────────────────────────────
export function generateDQSlips(data: { meet: any; dqs: any[] }) {
  const doc = startDoc("DQ Slips");
  const slipH = 200;

  let isFirst = true;
  for (const dq of data.dqs) {
    if (!isFirst) doc.addPage();
    isFirst = false;

    const w = doc.internal.pageSize.getWidth();
    doc.setFillColor(...POOL_BLUE);
    doc.rect(0, 0, w, 30, "F");
    doc.setTextColor(...WHITE);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("DISQUALIFICATION SLIP — SwimManager Pro", 14, 20);
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(10);
    const line = (label: string, value: string, y: number) => {
      doc.setFont("helvetica", "bold");
      doc.text(`${label}:`, 14, y);
      doc.setFont("helvetica", "normal");
      doc.text(value, 120, y);
    };

    line("Meet", data.meet.name, 52);
    line("Date", fmtDate(data.meet.startDate), 68);
    line("Event", `${dq.eventNumber} — ${dq.eventName}`, 84);
    line("Athlete", dq.athleteName, 100);
    line("Team", dq.teamAbbreviation ?? "-", 116);
    line("Heat / Lane", `Heat ${dq.heatNumber ?? "?"}, Lane ${dq.lane ?? "?"}`, 132);
    line("Status", dq.dq ? "DISQUALIFICATION" : dq.ns ? "NO SHOW" : "DID NOT FINISH", 148);
    line("DQ Code", dq.dqCode ?? "—", 164);

    doc.setDrawColor(...POOL_BLUE);
    doc.setLineWidth(0.5);
    doc.rect(14, 40, w - 28, 140);

    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("Official Signature: ___________________________   Date: ________________", 14, 198);
    doc.setTextColor(0, 0, 0);

    doc.setDrawColor(180, 180, 180);
    doc.setLineDashPattern([4, 4], 0);
    doc.line(0, slipH + 10, w, slipH + 10);
    doc.setLineDashPattern([], 0);
  }

  doc.save(`dq-slips-${data.meet.name.replace(/\s+/g, "-")}.pdf`);
}

// ─── SPLIT SHEET ──────────────────────────────────────────────────────────────
export function generateSplitSheet(data: { meet: any; events: any[] }) {
  const doc = startDoc("Split Sheet");
  const title = "Split Sheet — Coach Copy";
  const meetName = `${data.meet.name} — ${fmtDate(data.meet.startDate)} — ${data.meet.course}`;

  pageHeader(doc, title, meetName);
  pageFooter(doc);

  let y = 58;
  for (const event of data.events) {
    if (!event.heats || event.heats.length === 0) continue;
    if (y > 680) { doc.addPage(); y = 58; }
    y = eventBanner(doc, `Event ${event.eventNumber} — ${fmtGender(event.gender)} ${event.ageGroup || "Open"} ${event.distance} ${event.stroke}`, y);

    for (const heat of event.heats) {
      if (y > 650) { doc.addPage(); y = 58; }
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setFillColor(240, 240, 240);
      doc.rect(14, y, doc.internal.pageSize.getWidth() - 28, 12, "F");
      doc.text(`Heat ${heat.heatNumber}`, 18, y + 9);
      doc.setFont("helvetica", "normal");
      y += 12;

      const numSplits = Math.max(...heat.lanes.map((l: any) => l.splits?.length ?? 0), 0);
      const splitHeaders = numSplits > 0
        ? Array.from({ length: numSplits }, (_, i) => `Split ${i + 1}`)
        : ["Split 1", "Split 2", "Split 3", "Split 4"];

      const head = [["Pl", "Ln", "Athlete", "Team", "Finish", ...splitHeaders]];
      const body = heat.lanes.map((l: any) => {
        const splitsArr = l.splits ?? Array(splitHeaders.length).fill(null);
        return [
          l.place ?? "-",
          l.lane ?? "-",
          l.athleteName,
          l.teamAbbreviation ?? "-",
          fmtTime(l.finishTime),
          ...splitsArr.map((s: number | null) => fmtTime(s)),
        ];
      });

      autoTable(doc, {
        head, body,
        startY: y,
        theme: "grid",
        headStyles: { fillColor: POOL_BLUE, textColor: WHITE, fontStyle: "bold", fontSize: 7, cellPadding: 2 },
        bodyStyles: { fontSize: 7, cellPadding: 2 },
        alternateRowStyles: { fillColor: POOL_STRIPE },
        margin: { top: 55, left: 14, right: 14, bottom: 22 },
        columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 24 }, 4: { cellWidth: 48 } },
        didDrawPage: () => { pageHeader(doc, title, meetName); pageFooter(doc); },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }
    y += 6;
  }

  doc.save(`split-sheet-${data.meet.name.replace(/\s+/g, "-")}.pdf`);
}

// ─── AWARD COUNTS ─────────────────────────────────────────────────────────────
export function generateAwardCounts(data: { meet: any; teamAwards: any[] }) {
  const doc = startDoc("Award Counts");
  const title = "Award Counts by Team";
  const meetName = `${data.meet.name} — ${fmtDate(data.meet.startDate)}`;

  pageHeader(doc, title, meetName);
  pageFooter(doc);

  const head = [["Team", "Abbr", "1st", "2nd", "3rd", "4th", "5th", "6th", "Total"]];
  const body = data.teamAwards.map((t: any) => [
    t.teamName, t.teamAbbreviation ?? "-",
    t.first, t.second, t.third, t.fourth, t.fifth, t.sixth, t.total,
  ]);

  tableBase(doc, 58, title, meetName, head, body, [130, 40, 36, 36, 36, 36, 36, 36, 46]);
  doc.save(`award-counts-${data.meet.name.replace(/\s+/g, "-")}.pdf`);
}

// ─── AWARD LABELS ─────────────────────────────────────────────────────────────
export function generateAwardLabels(data: { meet: any; events: any[] }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const labelW = 189;
  const labelH = 72;
  const cols = 3;
  const rows = 10;
  const marginL = 21;
  const marginT = 36;

  let col = 0;
  let row = 0;

  function addLabel(place: number, athlete: string, team: string, eventDesc: string, time: string) {
    const x = marginL + col * labelW;
    const y = marginT + row * labelH;

    doc.setFillColor(...POOL_BLUE);
    doc.rect(x, y, labelW - 6, 18, "F");
    doc.setTextColor(...WHITE);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    const placeLabel = ["1st PLACE", "2nd PLACE", "3rd PLACE", "4th PLACE", "5th PLACE", "6th PLACE"][place - 1] ?? `${place}th PLACE`;
    doc.text(placeLabel, x + (labelW - 6) / 2, y + 12, { align: "center" });

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(athlete, x + 4, y + 30, { maxWidth: labelW - 14 });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(team, x + 4, y + 41);
    doc.text(eventDesc, x + 4, y + 52, { maxWidth: labelW - 14 });
    doc.text(time, x + 4, y + 63);

    doc.setDrawColor(200, 200, 200);
    doc.rect(x, y, labelW - 6, labelH - 4);

    col++;
    if (col >= cols) { col = 0; row++; }
    if (row >= rows) { doc.addPage(); col = 0; row = 0; }
  }

  for (const event of data.events) {
    if (!event.results) continue;
    const desc = `Ev ${event.eventNumber} ${fmtGender(event.gender)} ${event.ageGroup || "Open"} ${event.distance} ${event.stroke}`;
    for (const r of event.results) {
      if (!r.place || r.place > 6 || r.dq || r.ns || r.dnf) continue;
      addLabel(r.place, r.athleteName, r.teamAbbreviation ?? "-", desc, fmtTime(r.finishTime));
    }
  }

  doc.save(`award-labels-${data.meet.name.replace(/\s+/g, "-")}.pdf`);
}

// ─── TEAM ROSTER ──────────────────────────────────────────────────────────────
export function generateTeamRoster(data: { team: any; athletes: any[] }) {
  const doc = startDoc("Team Roster");
  const title = "Team Roster";
  const subtitle = `${data.team.name}${data.team.abbreviation ? ` (${data.team.abbreviation})` : ""}`;

  pageHeader(doc, title, subtitle);
  pageFooter(doc);

  const head = [["Name", "Gender", "DOB", "Age", "Phone", "Email", "Parent", "ID Number"]];
  const body = data.athletes.map((a: any) => [
    `${a.lastName}, ${a.firstName}`,
    a.gender === "M" ? "Male" : "Female",
    fmtDate(a.dateOfBirth),
    a.dateOfBirth ? String(new Date().getFullYear() - new Date(a.dateOfBirth).getFullYear()) : "-",
    a.phone ?? "-",
    a.email ?? "-",
    a.parentName ?? "-",
    a.idNumber ?? "-",
  ]);

  tableBase(doc, 58, title, subtitle, head, body);
  doc.save(`roster-${data.team.name.replace(/\s+/g, "-")}.pdf`);
}

// ─── ATHLETE REPORT ───────────────────────────────────────────────────────────
export function generateAthleteReport(data: { athlete: any; entries: any[]; invoices: any[] }) {
  const doc = startDoc("Athlete Report");
  const { athlete, entries, invoices } = data;
  const fullName = `${athlete.firstName} ${athlete.lastName}`;

  pageHeader(doc, "Athlete Report", fullName);
  pageFooter(doc);

  let y = 60;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Personal Information", 14, y);
  y += 14;

  const info = [
    ["Name", fullName], ["Gender", athlete.gender === "M" ? "Male" : "Female"],
    ["Date of Birth", fmtDate(athlete.dateOfBirth)], ["Team", athlete.teamName ?? "-"],
    ["Coach", athlete.coachName ?? "-"], ["ID Number", athlete.idNumber ?? "-"],
    ["Phone", athlete.phone ?? "-"], ["Email", athlete.email ?? "-"],
    ["Parent / Guardian", athlete.parentName ?? "-"], ["Parent Phone", athlete.parentPhone ?? "-"],
    ["Parent Email", athlete.parentEmail ?? "-"],
  ];

  autoTable(doc, {
    body: info, startY: y, theme: "plain",
    bodyStyles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 120 } },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  if (athlete.healthNotes) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Health Notes:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(athlete.healthNotes, 14, y + 12, { maxWidth: 540 });
    y += 30;
  }

  if (invoices.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Billing History", 14, y);
    y += 6;
    const head = [["Invoice ID", "Description", "Type", "Amount", "Due Date", "Status"]];
    const body = invoices.map((i: any) => [
      `INV-${String(i.id).padStart(5, "0")}`, i.description, i.invoiceType,
      `$${Number(i.amount).toFixed(2)}`, fmtDate(i.dueDate), i.status?.toUpperCase() ?? "-",
    ]);
    autoTable(doc, {
      head, body, startY: y, theme: "grid",
      headStyles: { fillColor: POOL_BLUE, textColor: WHITE, fontStyle: "bold", fontSize: 8, cellPadding: 2.5 },
      bodyStyles: { fontSize: 8, cellPadding: 2 },
      alternateRowStyles: { fillColor: POOL_STRIPE },
      margin: { left: 14, right: 14, bottom: 22 },
      didDrawPage: () => { pageHeader(doc, "Athlete Report", fullName); pageFooter(doc); },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  doc.save(`athlete-report-${fullName.replace(/\s+/g, "-")}.pdf`);
}

// ─── INVOICE PDF ──────────────────────────────────────────────────────────────
export function generateInvoicePDF(invoice: any, athleteName: string, teamName: string, clubName: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const w = doc.internal.pageSize.getWidth();

  doc.setFillColor(...POOL_BLUE);
  doc.rect(0, 0, w, 70, "F");
  doc.setTextColor(...WHITE);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", 14, 38);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(clubName, w - 14, 30, { align: "right" });
  doc.text(`INV-${String(invoice.id).padStart(5, "0")}`, w - 14, 46, { align: "right" });
  doc.setTextColor(0, 0, 0);

  const status = (invoice.status ?? "").toUpperCase();
  const statusColor: [number, number, number] =
    status === "PAID" ? [34, 139, 34] : status === "OVERDUE" ? [200, 30, 30] : [200, 140, 0];
  doc.setFillColor(...statusColor);
  doc.roundedRect(w - 90, 76, 76, 22, 4, 4, "F");
  doc.setTextColor(...WHITE);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(status, w - 52, 91, { align: "center" });
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");

  let y = 82;
  const field = (label: string, val: string, yy: number) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
    doc.text(label, 14, yy);
    doc.setFont("helvetica", "normal");
    doc.text(val, 140, yy);
  };
  field("Billed To:", athleteName, y);
  field("Team:", teamName, y + 16);
  field("Description:", invoice.description, y + 32);
  field("Invoice Type:", invoice.invoiceType, y + 48);
  field("Due Date:", fmtDate(invoice.dueDate), y + 64);
  if (invoice.paidDate) field("Paid Date:", fmtDate(invoice.paidDate), y + 80);

  y += 120;
  doc.setFillColor(245, 245, 245);
  doc.rect(14, y, w - 28, 50, "F");
  doc.setDrawColor(...POOL_BLUE);
  doc.setLineWidth(1.5);
  doc.rect(14, y, w - 28, 50);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Amount Due:", 22, y + 20);
  doc.setFontSize(22);
  doc.text(`$${Number(invoice.amount).toFixed(2)}`, w - 22, y + 36, { align: "right" });

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("SwimManager Pro — Billing System", 14, doc.internal.pageSize.getHeight() - 20);

  doc.save(`invoice-INV-${String(invoice.id).padStart(5, "0")}.pdf`);
}

// ─── BILLING SUMMARY ──────────────────────────────────────────────────────────
export function generateBillingSummary(invoices: any[], clubName: string) {
  const doc = startDoc("Billing Summary");
  const title = "Billing Summary Report";
  pageHeader(doc, title, clubName);
  pageFooter(doc);

  const totalOutstanding = invoices.filter(i => i.status !== "paid").reduce((s, i) => s + Number(i.amount), 0);
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);
  const totalOverdue = invoices.filter(i => i.status === "overdue").reduce((s, i) => s + Number(i.amount), 0);

  let y = 60;
  const summaryData = [
    ["Total Invoices", String(invoices.length)],
    ["Total Outstanding", `$${totalOutstanding.toFixed(2)}`],
    ["Total Overdue", `$${totalOverdue.toFixed(2)}`],
    ["Total Collected", `$${totalPaid.toFixed(2)}`],
  ];
  autoTable(doc, {
    body: summaryData, startY: y, theme: "grid",
    bodyStyles: { fontSize: 10, cellPadding: 5 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 160, fillColor: POOL_STRIPE } },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 16;

  const head = [["Invoice ID", "Athlete", "Team", "Type", "Amount", "Due Date", "Status"]];
  const body = invoices.map((i: any) => [
    `INV-${String(i.id).padStart(5, "0")}`,
    i.athleteName ?? "-",
    i.teamName ?? "-",
    i.invoiceType ?? "-",
    `$${Number(i.amount).toFixed(2)}`,
    fmtDate(i.dueDate),
    (i.status ?? "-").toUpperCase(),
  ]);

  tableBase(doc, y, title, clubName, head, body);
  doc.save(`billing-summary-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─── OUTSTANDING INVOICES ─────────────────────────────────────────────────────
export function generateOutstandingInvoices(invoices: any[], clubName: string) {
  const outstanding = invoices.filter(i => i.status !== "paid");
  const doc = startDoc("Outstanding Invoices");
  const title = "Outstanding & Overdue Invoices";
  pageHeader(doc, title, clubName);
  pageFooter(doc);

  const head = [["Invoice ID", "Athlete", "Team", "Description", "Amount", "Due Date", "Status"]];
  const body = outstanding.map((i: any) => [
    `INV-${String(i.id).padStart(5, "0")}`,
    i.athleteName ?? "-",
    i.teamName ?? "-",
    i.description,
    `$${Number(i.amount).toFixed(2)}`,
    fmtDate(i.dueDate),
    (i.status ?? "-").toUpperCase(),
  ]);

  tableBase(doc, 58, title, clubName, head, body);
  doc.save(`outstanding-invoices-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─── OFFICIAL MEMO ────────────────────────────────────────────────────────────
export function generateOfficialMemo(opts: { clubName: string; to: string; from: string; re: string; body: string; date?: string }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const w = doc.internal.pageSize.getWidth();

  doc.setFillColor(...POOL_BLUE);
  doc.rect(0, 0, w, 60, "F");
  doc.setTextColor(...WHITE);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("OFFICIAL MEMORANDUM", 14, 30);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(opts.clubName, 14, 48);
  doc.setTextColor(0, 0, 0);

  let y = 80;
  const field = (label: string, val: string) => {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(val, 80, y);
    y += 20;
  };
  field("TO", opts.to);
  field("FROM", opts.from);
  field("DATE", opts.date ?? fmtDate(new Date().toISOString()));
  field("RE", opts.re);

  doc.setDrawColor(...POOL_BLUE);
  doc.setLineWidth(1);
  doc.line(14, y + 4, w - 14, y + 4);
  y += 20;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const lines = doc.splitTextToSize(opts.body, w - 28);
  doc.text(lines, 14, y);
  y += lines.length * 14 + 30;

  doc.setFontSize(10);
  doc.text("Signature: ___________________________", 14, y);
  doc.text(`Date: ___________________`, 14, y + 20);

  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text("SwimManager Pro — Official Memo", 14, doc.internal.pageSize.getHeight() - 20);

  doc.save(`memo-${opts.date ?? new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─── TIME STANDARDS ───────────────────────────────────────────────────────────
export function generateTimeStandardsReport(standards: any[], clubName: string) {
  const doc = startDoc("Time Standards");
  const title = "Time Standards Report";
  pageHeader(doc, title, clubName);
  pageFooter(doc);

  const head = [["Name", "Course", "Gender", "Age Group", "Distance", "Stroke", "Standard Time", "Cut Type"]];
  const body = standards.map((s: any) => [
    s.name ?? "-", s.course ?? "-",
    s.gender === "M" ? "Male" : s.gender === "F" ? "Female" : "Mixed",
    s.ageGroup ?? "Open", s.distance ?? "-", s.stroke ?? "-",
    fmtTime(s.standardTime), s.cutType ?? "-",
  ]);

  tableBase(doc, 58, title, clubName, head, body);
  doc.save(`time-standards-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─── TIMELINE ─────────────────────────────────────────────────────────────────
export function generateTimeline(data: { meet: any; sessions: any[] }) {
  const doc = startDoc("Timeline");
  const title = "Meet Timeline";
  const meetName = `${data.meet.name} — ${fmtDate(data.meet.startDate)} — ${data.meet.course}`;

  pageHeader(doc, title, meetName);
  pageFooter(doc);

  let y = 58;
  for (const session of data.sessions) {
    if (!session.events || session.events.length === 0) continue;
    if (y > 660) { doc.addPage(); y = 58; }

    const parts = [
      session.name,
      session.sessionType,
      session.date ? fmtDate(session.date) : null,
      session.warmupTime ? `Warm-up ${session.warmupTime}` : null,
      session.startTime ? `Start ${session.startTime}` : null,
    ].filter(Boolean);
    y = eventBanner(doc, parts.join("  •  "), y);

    const head = [["Est. Start", "Event #", "Event", "Entries", "Heats"]];
    const body = session.events.map((e: any) => [
      e.estStart ?? "-",
      e.eventNumber,
      e.eventName,
      e.entryCount ?? "-",
      e.heatCount ?? "-",
    ]);

    autoTable(doc, {
      head, body,
      startY: y,
      theme: "grid",
      headStyles: { fillColor: POOL_BLUE, textColor: WHITE, fontStyle: "bold", fontSize: 8, cellPadding: 2.5 },
      bodyStyles: { fontSize: 8, cellPadding: 2 },
      alternateRowStyles: { fillColor: POOL_STRIPE },
      margin: { top: 55, left: 14, right: 14, bottom: 22 },
      columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 50 }, 3: { cellWidth: 50 }, 4: { cellWidth: 45 } },
      didDrawPage: () => { pageHeader(doc, title, meetName); pageFooter(doc); },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    if (session.estEndMinutes > 0) {
      doc.setFontSize(7.5);
      doc.setTextColor(100, 100, 100);
      const hrs = Math.floor(session.estEndMinutes / 60);
      const mins = Math.round(session.estEndMinutes % 60);
      doc.text(`Estimated session duration: ${hrs > 0 ? `${hrs}h ` : ""}${mins}m`, 18, y + 8);
      doc.setTextColor(0, 0, 0);
      y += 14;
    }
    y += 6;
  }

  doc.save(`timeline-${data.meet.name.replace(/\s+/g, "-")}.pdf`);
}
