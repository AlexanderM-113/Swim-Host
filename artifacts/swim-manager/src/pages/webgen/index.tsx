import { useState } from "react";
import { readStore, useListMeets, useListAthletes, useListWorkouts, useGetClub, useGetSettings } from "@/lib/local-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Loader2, Globe, Download, QrCode, Info, Wifi, WifiOff, FileCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateMeetWebsite, generateFamilyPortal } from "@/lib/webgen";
import QRCode from "qrcode";

// ─── Data Builders ────────────────────────────────────────────────────────────

function calcAge(dob?: string | null, meetDate?: string): string {
  if (!dob) return "—";
  const ref = meetDate ? new Date(meetDate) : new Date();
  const birth = new Date(dob);
  let age = ref.getFullYear() - birth.getFullYear();
  const m = ref.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--;
  return String(age);
}

function buildPsychSheet(meetId: number) {
  const store = readStore();
  const meet = store.meets.find((m) => m.id === meetId);
  const events = store.events
    .filter((e) => e.meetId === meetId)
    .sort((a, b) => a.eventNumber - b.eventNumber);

  return {
    events: events.map((event) => {
      const entries = store.entries
        .filter((e) => e.eventId === event.id && !e.scratched)
        .map((entry) => {
          const athlete = store.athletes.find((a) => a.id === entry.athleteId);
          const team = athlete?.teamId ? store.teams.find((t) => t.id === athlete.teamId) : null;
          return {
            athleteName: athlete ? `${athlete.firstName} ${athlete.lastName}` : "Unknown",
            teamAbbreviation: team?.abbreviation ?? team?.name?.substring(0, 5) ?? "UNAT",
            age: calcAge(athlete?.dateOfBirth, meet?.startDate),
            seedTime: entry.seedTime,
            seedCourse: entry.seedCourse ?? meet?.course ?? "SCY",
          };
        })
        .sort((a, b) => {
          if (!a.seedTime && !b.seedTime) return 0;
          if (!a.seedTime) return 1;
          if (!b.seedTime) return -1;
          return a.seedTime - b.seedTime;
        })
        .map((e, i) => ({ ...e, rank: i + 1 }));
      return { ...event, entries };
    }),
  };
}

function buildHeatSheet(meetId: number) {
  const store = readStore();
  const meet = store.meets.find((m) => m.id === meetId);
  const events = store.events
    .filter((e) => e.meetId === meetId)
    .sort((a, b) => a.eventNumber - b.eventNumber);

  return {
    events: events.map((event) => {
      const heats = store.heats
        .filter((h) => h.eventId === event.id)
        .sort((a, b) => a.heatNumber - b.heatNumber)
        .map((heat) => ({
          heatNumber: heat.heatNumber,
          lanes: (heat.lanes ?? []).map((lane) => {
            const entry = lane.entryId ? store.entries.find((e) => e.id === lane.entryId) : null;
            const athlete = entry ? store.athletes.find((a) => a.id === entry.athleteId) : null;
            const team = athlete?.teamId ? store.teams.find((t) => t.id === athlete.teamId) : null;
            return {
              lane: lane.laneNumber,
              athleteName: athlete ? `${athlete.firstName} ${athlete.lastName}` : "Empty",
              teamAbbreviation: team?.abbreviation ?? (lane.athleteId ? "UNAT" : "—"),
              age: calcAge(athlete?.dateOfBirth, meet?.startDate),
              seedTime: entry?.seedTime,
              seedCourse: entry?.seedCourse,
            };
          }),
        }));
      return { ...event, heats };
    }),
  };
}

function buildResultsSheet(meetId: number) {
  const store = readStore();
  const meet = store.meets.find((m) => m.id === meetId);
  const events = store.events
    .filter((e) => e.meetId === meetId)
    .sort((a, b) => a.eventNumber - b.eventNumber);

  return {
    events: events.map((event) => {
      const results = store.entries
        .filter((e) => e.eventId === event.id && !e.scratched)
        .map((entry) => {
          const result = store.results.find((r) => r.entryId === entry.id);
          const athlete = store.athletes.find((a) => a.id === entry.athleteId);
          const team = athlete?.teamId ? store.teams.find((t) => t.id === athlete.teamId) : null;
          return {
            place: result?.place ?? null,
            athleteName: athlete ? `${athlete.firstName} ${athlete.lastName}` : "Unknown",
            teamAbbreviation: team?.abbreviation ?? "UNAT",
            age: calcAge(athlete?.dateOfBirth, meet?.startDate),
            seedTime: entry.seedTime,
            finishTime: result?.finishTime ?? null,
            points: result?.points ?? null,
            dq: result?.dq ?? false,
            dqCode: result?.dqCode,
            ns: result?.ns ?? false,
            dnf: result?.dnf ?? false,
            hasResult: !!result,
          };
        })
        .filter((r) => r.hasResult)
        .sort((a, b) => {
          if (a.dq || a.ns || a.dnf) return 1;
          if (b.dq || b.ns || b.dnf) return -1;
          return (a.place ?? 999) - (b.place ?? 999);
        });
      return { ...event, results };
    }),
  };
}

// ─── All-in-One Live HTML Generator ──────────────────────────────────────────

function formatSecs(secs: number | null | undefined): string {
  if (!secs || secs <= 0) return "NT";
  const hundredths = Math.round(secs * 100);
  const h = hundredths % 100;
  const totalSec = Math.floor(hundredths / 100);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60);
  const hh = String(h).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return m > 0 ? `${m}:${ss}.${hh}` : `${ss}.${hh}`;
}

async function generateAllInOneHTML(opts: {
  meetId: number;
  apiServerUrl: string;
  includeHeatSheet: boolean;
  includeResults: boolean;
  includePsychSheet: boolean;
  includeScratchForm: boolean;
}) {
  const store = readStore();
  const meet = store.meets.find((m) => m.id === opts.meetId);
  if (!meet) throw new Error("Meet not found");

  const club = store.club;
  const psychSheet = opts.includePsychSheet ? buildPsychSheet(opts.meetId) : null;
  const heatSheet = opts.includeHeatSheet ? buildHeatSheet(opts.meetId) : null;
  const results = opts.includeResults ? buildResultsSheet(opts.meetId) : null;

  const liveUrl = opts.apiServerUrl ? `${opts.apiServerUrl}/api/live/${opts.meetId}` : "";
  let qrDataUrl = "";
  if (liveUrl) {
    try {
      qrDataUrl = await QRCode.toDataURL(liveUrl, { width: 200, margin: 1, color: { dark: "#0d3a5c" } });
    } catch { qrDataUrl = ""; }
  }

  const fmtDate = (d?: string | null) => {
    if (!d) return "—";
    try { return new Date(d + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); }
    catch { return d; }
  };
  const fmtGender = (g: string) => g === "M" ? "Men" : g === "F" ? "Women" : "Mixed";

  function buildPsychHTML() {
    if (!psychSheet) return "";
    return psychSheet.events.map((ev) => {
      if (!ev.entries?.length) return "";
      return `<div class="event-block">
<div class="event-title">Event ${ev.eventNumber} — ${fmtGender(ev.gender)} ${ev.ageGroup || "Open"} ${ev.distance} ${ev.stroke}</div>
<table class="data-table"><thead><tr><th>#</th><th>Athlete</th><th>Team</th><th>Age</th><th>Seed</th><th>Course</th></tr></thead><tbody>
${ev.entries.map((e: any) => `<tr><td>${e.rank}</td><td class="name">${e.athleteName}</td><td class="team">${e.teamAbbreviation}</td><td>${e.age}</td><td class="time">${formatSecs(e.seedTime)}</td><td>${e.seedCourse ?? "—"}</td></tr>`).join("")}
</tbody></table></div>`;
    }).join("");
  }

  function buildHeatHTML() {
    if (!heatSheet) return "";
    return heatSheet.events.map((ev) => {
      if (!ev.heats?.length) return "";
      const heatsHtml = ev.heats.map((h: any) =>
        `<div class="heat-label">Heat ${h.heatNumber}</div>
<table class="data-table"><thead><tr><th>Lane</th><th>Athlete</th><th>Team</th><th>Age</th><th>Seed</th></tr></thead><tbody>
${h.lanes.map((l: any) => `<tr><td class="lane">${l.lane}</td><td class="name">${l.athleteName}</td><td class="team">${l.teamAbbreviation}</td><td>${l.age}</td><td class="time">${formatSecs(l.seedTime)}</td></tr>`).join("")}
</tbody></table>`
      ).join("");
      return `<div class="event-block"><div class="event-title">Event ${ev.eventNumber} — ${fmtGender(ev.gender)} ${ev.ageGroup || "Open"} ${ev.distance} ${ev.stroke}</div>${heatsHtml}</div>`;
    }).join("");
  }

  function buildResultsHTML() {
    if (!results) return "";
    return results.events.map((ev) => {
      if (!ev.results?.length) return "";
      return `<div class="event-block" id="evt-${ev.eventNumber}">
<div class="event-title">Event ${ev.eventNumber} — ${fmtGender(ev.gender)} ${ev.ageGroup || "Open"} ${ev.distance} ${ev.stroke}</div>
<table class="data-table"><thead><tr><th>Place</th><th>Athlete</th><th>Team</th><th>Age</th><th>Seed</th><th>Time</th></tr></thead><tbody>
${ev.results.map((r: any) => {
  const p = r.dq ? '<span class="badge-dq">DQ</span>' : r.ns ? '<span class="badge-ns">NS</span>' : r.dnf ? '<span class="badge-ns">DNF</span>' : `<b>${r.place ?? "—"}</b>`;
  return `<tr class="${r.place === 1 ? "gold" : r.place === 2 ? "silver" : r.place === 3 ? "bronze" : ""}"><td>${p}</td><td class="name">${r.athleteName}</td><td class="team">${r.teamAbbreviation}</td><td>${r.age}</td><td class="time dim">${formatSecs(r.seedTime)}</td><td class="time">${r.dq || r.ns || r.dnf ? "" : formatSecs(r.finishTime)}</td></tr>`;
}).join("")}
</tbody></table></div>`;
    }).join("");
  }

  const scratchFormHtml = opts.includeScratchForm && opts.apiServerUrl ? `
<form id="scratchForm" class="scratch-form" onsubmit="return submitScratch(event)">
  <div class="form-notice"><strong>Important:</strong> Scratching from a final after the deadline may incur a late scratch fee per USAS rules.</div>
  <div class="form-grid">
    <div class="form-group"><label>Full Name *</label><input type="text" name="fullName" required placeholder="First Last"></div>
    <div class="form-group"><label>Date of Birth *</label><input type="date" name="dob" required></div>
    <div class="form-group"><label>Event Number *</label><input type="number" name="eventNum" required placeholder="e.g. 12"></div>
    <div class="form-group"><label>Event Description *</label><input type="text" name="eventName" required placeholder="e.g. Women 200 Freestyle"></div>
    <div class="form-group full"><label>Reason (Optional)</label><textarea name="reason" rows="2" placeholder="Medical, scheduling conflict…"></textarea></div>
    <div class="form-group full"><label>Digital Signature (Type Full Name) *</label><input type="text" name="signature" required></div>
  </div>
  <button type="submit" class="btn">Submit Scratch Request</button>
  <div id="scratchConfirm" class="scratch-confirm" style="display:none"></div>
</form>
<script>
async function submitScratch(e) {
  e.preventDefault();
  const f = e.target;
  const data = { fullName: f.fullName.value, dob: f.dob.value, eventNumber: f.eventNum.value, eventName: f.eventName.value, reason: f.reason.value, signature: f.signature.value, timestamp: new Date().toISOString(), meetId: "${opts.meetId}" };
  try {
    const r = await fetch('${opts.apiServerUrl}/api/live/${opts.meetId}/scratch', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
    if (r.ok) { document.getElementById('scratchConfirm').style.display='block'; document.getElementById('scratchConfirm').innerHTML='<strong>✅ Scratch request submitted.</strong><br>' + data.fullName + ' — Event ' + data.eventNumber + ' ' + data.eventName; f.style.display='none'; }
    else alert('Submission failed. Please contact the meet director.');
  } catch { alert('Network error. Contact meet director or submit paper scratch.'); }
  return false;
}
</script>` : "<p>Scratch form requires a live server URL to be configured.</p>";

  const liveScript = liveUrl ? `
<script>
var LIVE_URL = '${liveUrl}';
var lastUpdate = null;
function fetchLive() {
  fetch(LIVE_URL).then(function(r){ return r.json(); }).then(function(data) {
    if (!data.updatedAt || data.updatedAt === lastUpdate) return;
    lastUpdate = data.updatedAt;
    document.getElementById('liveStatus').innerHTML = '🟢 Live — Updated ' + new Date(data.updatedAt).toLocaleTimeString();
    updateLiveResults(data.events);
  }).catch(function() {
    document.getElementById('liveStatus').innerHTML = '🔴 Offline — Showing embedded data';
  });
}
function updateLiveResults(events) {
  if (!events || !events.length) return;
  var container = document.getElementById('resultsContent');
  if (!container) return;
  var html = '';
  events.forEach(function(ev) {
    if (!ev.results || !ev.results.length) return;
    html += '<div class="event-block" id="live-evt-' + ev.eventNumber + '"><div class="event-title live-badge">&#128315; Live — Event ' + ev.eventNumber + ' — ' + ev.description + '</div><table class="data-table"><thead><tr><th>Place</th><th>Athlete</th><th>Team</th><th>Time</th></tr></thead><tbody>';
    ev.results.forEach(function(r) {
      html += '<tr><td>' + (r.place || '—') + '</td><td class="name">' + r.athleteName + '</td><td class="team">' + r.teamAbbreviation + '</td><td class="time">' + (r.finishTime || '—') + '</td></tr>';
    });
    html += '</tbody></table></div>';
  });
  if (html) container.innerHTML = html;
}
fetchLive();
setInterval(fetchLive, 30000);
</script>` : "";

  const tabs = [
    { id: "home", label: "🏠 Home" },
    opts.includePsychSheet ? { id: "psych", label: "📋 Psych Sheet" } : null,
    opts.includeHeatSheet ? { id: "heat", label: "🏊 Heat Sheet" } : null,
    opts.includeResults ? { id: "results", label: "🏆 Results" } : null,
    opts.includeScratchForm ? { id: "scratch", label: "✏️ Scratch" } : null,
  ].filter(Boolean) as { id: string; label: string }[];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${meet.name} — Meet Results</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f6fc;color:#1a1a2e;min-height:100vh}
header{background:#0d3a5c;color:white;padding:0}
.hdr{max-width:1100px;margin:0 auto;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.hdr-title{font-size:20px;font-weight:700}
.hdr-sub{font-size:12px;opacity:.75;margin-top:3px}
.hdr-badge{background:#1a6a9c;border-radius:6px;padding:4px 12px;font-size:11px;font-weight:600;white-space:nowrap}
nav{background:#09294a}
.nav-inner{max-width:1100px;margin:0 auto;display:flex;overflow-x:auto;gap:0}
.tab-btn{background:none;border:none;color:rgba(255,255,255,.8);padding:11px 18px;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap;transition:all .15s;font-family:inherit}
.tab-btn:hover,.tab-btn.active{background:#1a6a9c;color:white}
main{max-width:1100px;margin:20px auto;padding:0 16px}
.tab-content{display:none}.tab-content.active{display:block}
.home-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:20px}
.home-card{background:white;border-radius:8px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
.home-card .label{font-size:11px;font-weight:600;color:#666;margin-bottom:4px;text-transform:uppercase}
.home-card .val{font-size:15px;font-weight:600}
.info-table{width:100%;border-collapse:collapse;font-size:13px}
.info-table th,.info-table td{padding:8px 12px;border-bottom:1px solid #e8f0f8}
.info-table th{text-align:left;font-weight:600;width:180px;color:#0d3a5c;background:#f5faff}
.card{background:white;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.08);margin-bottom:20px;overflow:hidden}
.card-hdr{background:#0d3a5c;color:white;padding:12px 18px;display:flex;align-items:center;justify-content:space-between}
.card-hdr h2{font-size:14px;font-weight:600}
.event-block{margin-bottom:24px}
.event-title{background:#1a6a9c;color:white;padding:10px 18px;font-size:13px;font-weight:600;border-radius:6px 6px 0 0}
.event-title.live-badge::before{content:'';margin-right:6px}
.heat-label{background:#e8f0f8;padding:6px 12px;font-size:12px;font-weight:600;color:#0d3a5c;border-top:1px solid #d0e4f4}
.data-table{width:100%;border-collapse:collapse;font-size:13px;background:white}
.data-table thead tr{background:#e0f0fc}
.data-table th{padding:8px 12px;text-align:left;font-weight:600;font-size:12px;color:#0d3a5c;border-bottom:2px solid #1a6a9c}
.data-table td{padding:7px 12px;border-bottom:1px solid #e8f0f8}
.data-table tr:last-child td{border-bottom:none}
.data-table tr:nth-child(even){background:#f8fbff}
.data-table tr.gold td{background:#fffdf0}
.data-table tr.silver td{background:#f8f8f8}
.data-table tr.bronze td{background:#fff9f5}
.time{font-family:'Courier New',monospace;font-weight:600}
.time.dim{color:#999;font-weight:400}
.name{font-weight:500}
.team{font-family:monospace;font-size:11px;color:#555}
.lane{font-weight:700;color:#0d3a5c;text-align:center}
.badge-dq{background:#fee;color:#c00;border-radius:4px;padding:1px 6px;font-size:11px;font-weight:600}
.badge-ns{background:#fef9e0;color:#b8860b;border-radius:4px;padding:1px 6px;font-size:11px;font-weight:600}
#liveStatus{font-size:12px;padding:6px 12px;background:#f0f9e8;border-radius:4px;margin-bottom:12px;display:inline-block}
.scratch-form{background:white;border-radius:8px;padding:24px;max-width:620px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
.form-notice{background:#fffbeb;border:1px solid #f0d060;border-radius:5px;padding:10px 14px;font-size:12px;color:#7a6000;margin-bottom:16px}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px}
.form-group{display:flex;flex-direction:column;gap:5px}
.form-group.full{grid-column:1/-1}
.form-group label{font-size:12px;font-weight:600;color:#0d3a5c}
.form-group input,.form-group textarea,.form-group select{padding:8px 11px;border:1px solid #c0d8ec;border-radius:4px;font-size:13px;font-family:inherit}
.btn{background:#0d3a5c;color:white;border:none;padding:10px 24px;border-radius:5px;font-size:13px;font-weight:600;cursor:pointer}
.btn:hover{background:#1a6a9c}
.scratch-confirm{background:#e8f8e8;border:1px solid #5a5;border-radius:6px;padding:14px;margin-top:14px;font-size:13px}
.qr-box{background:white;border-radius:8px;padding:20px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.08);max-width:240px;margin:0 auto 20px}
.quick-links{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:20px}
.ql{display:block;padding:14px;border-radius:7px;text-align:center;color:white;font-weight:600;font-size:13px;text-decoration:none;cursor:pointer;border:none;font-family:inherit}
footer{text-align:center;padding:24px;font-size:11px;color:#888;margin-top:20px}
@media(max-width:600px){.form-grid{grid-template-columns:1fr}.hdr{flex-direction:column;align-items:flex-start}}
</style>
</head>
<body>
<header>
  <div class="hdr">
    <div>
      <div class="hdr-title">${meet.name}</div>
      <div class="hdr-sub">${fmtDate(meet.startDate)}${meet.endDate && meet.endDate !== meet.startDate ? ` – ${fmtDate(meet.endDate)}` : ""} &nbsp;·&nbsp; ${meet.facility ?? ""} ${meet.city ? `, ${meet.city}` : ""} &nbsp;·&nbsp; ${meet.course}</div>
    </div>
    <div class="hdr-badge">${club.name ?? "SwimManager Pro"}</div>
  </div>
</header>
<nav>
  <div class="nav-inner">
    ${tabs.map((t, i) => `<button class="tab-btn${i === 0 ? " active" : ""}" onclick="showTab('${t.id}',this)">${t.label}</button>`).join("")}
  </div>
</nav>
<main>
${liveUrl ? `<div id="liveStatus">🔄 Connecting to live results…</div>` : ""}

<!-- HOME -->
<div id="tab-home" class="tab-content active">
  <div class="home-grid">
    <div class="home-card"><div class="label">Course</div><div class="val">${meet.course}</div></div>
    <div class="home-card"><div class="label">Meet Type</div><div class="val">${meet.meetType ?? "—"}</div></div>
    <div class="home-card"><div class="label">Facility</div><div class="val">${meet.facility ?? "—"}</div></div>
    ${meet.entryDeadline ? `<div class="home-card"><div class="label">Entry Deadline</div><div class="val">${fmtDate(meet.entryDeadline)}</div></div>` : ""}
  </div>
  <div class="quick-links">
    ${tabs.filter(t => t.id !== "home").map(t => {
      const colors: Record<string,string> = { psych: "#0d3a5c", heat: "#1a6a9c", results: "#0a5c2a", scratch: "#8b1a1a" };
      return `<button class="ql" style="background:${colors[t.id] ?? "#0d3a5c"}" onclick="showTab('${t.id}',null)">${t.label}</button>`;
    }).join("")}
  </div>
  <div class="card">
    <div class="card-hdr"><h2>Meet Details</h2></div>
    <table class="info-table">
      <tr><th>Facility</th><td>${meet.facility ?? "—"}</td></tr>
      <tr><th>Dates</th><td>${fmtDate(meet.startDate)}${meet.endDate && meet.endDate !== meet.startDate ? ` – ${fmtDate(meet.endDate)}` : ""}</td></tr>
      <tr><th>Course</th><td>${meet.course}</td></tr>
      <tr><th>Meet Type</th><td>${meet.meetType ?? "—"}</td></tr>
      <tr><th>Scoring</th><td>${meet.scoringRules ?? "—"}</td></tr>
      ${meet.notes ? `<tr><th>Notes</th><td>${meet.notes}</td></tr>` : ""}
    </table>
  </div>
  ${qrDataUrl ? `
  <div class="qr-box">
    <div style="font-size:12px;font-weight:600;color:#0d3a5c;margin-bottom:10px">📡 Live Results</div>
    <img src="${qrDataUrl}" alt="QR Code" style="width:180px;height:180px;border:3px solid #0d3a5c;border-radius:6px">
    <div style="font-size:10px;color:#888;margin-top:8px;word-break:break-all">${liveUrl}</div>
  </div>` : ""}
</div>

<!-- PSYCH SHEET -->
${opts.includePsychSheet ? `
<div id="tab-psych" class="tab-content">
  <h2 style="margin-bottom:16px;color:#0d3a5c">Psych Sheet</h2>
  ${buildPsychHTML() || "<p style='color:#888;padding:20px'>No entries available.</p>"}
</div>` : ""}

<!-- HEAT SHEET -->
${opts.includeHeatSheet ? `
<div id="tab-heat" class="tab-content">
  <h2 style="margin-bottom:16px;color:#0d3a5c">Heat Sheet</h2>
  ${buildHeatHTML() || "<p style='color:#888;padding:20px'>No heats found. Events need to be seeded first.</p>"}
</div>` : ""}

<!-- RESULTS -->
${opts.includeResults ? `
<div id="tab-results" class="tab-content">
  <h2 style="margin-bottom:16px;color:#0d3a5c">Results</h2>
  <div id="resultsContent">
    ${buildResultsHTML() || "<p style='color:#888;padding:20px'>No results posted yet.</p>"}
  </div>
</div>` : ""}

<!-- SCRATCH FORM -->
${opts.includeScratchForm ? `
<div id="tab-scratch" class="tab-content">
  <h2 style="margin-bottom:16px;color:#0d3a5c">Finals Scratch Form</h2>
  ${scratchFormHtml}
</div>` : ""}

</main>
<footer>Generated by SwimManager Pro &nbsp;·&nbsp; ${new Date().toLocaleDateString()} &nbsp;·&nbsp; ${club.name ?? ""}</footer>

<script>
function showTab(id, btn) {
  document.querySelectorAll('.tab-content').forEach(function(el){ el.classList.remove('active'); });
  document.querySelectorAll('.tab-btn').forEach(function(el){ el.classList.remove('active'); });
  var el = document.getElementById('tab-' + id);
  if (el) el.classList.add('active');
  if (btn) btn.classList.add('active');
  else { document.querySelectorAll('.tab-btn').forEach(function(b){ if(b.textContent.toLowerCase().includes(id)) b.classList.add('active'); }); }
}
</script>
${liveScript}
</body>
</html>`;

  return html;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WebGen() {
  const { toast } = useToast();
  const { data: meets } = useListMeets();
  const { data: athletes } = useListAthletes();
  const { data: workouts } = useListWorkouts();
  const { data: club } = useGetClub();
  const { data: settings } = useGetSettings();

  const [selectedMeet, setSelectedMeet] = useState("");
  const [selectedAthlete, setSelectedAthlete] = useState("");
  const [meetOptions, setMeetOptions] = useState({
    includeHeatSheet: true,
    includeResults: true,
    includePsychSheet: true,
    includeScratchForm: true,
  });
  const [apiBaseUrl, setApiBaseUrl] = useState(typeof window !== "undefined" ? window.location.origin : "");
  const [meetLoading, setMeetLoading] = useState(false);
  const [liveLoading, setLiveLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const clubName = (club as any)?.name ?? "SwimManager Pro";
  const meetObj = meets?.find((m) => m.id === parseInt(selectedMeet));
  const athleteObj = athletes?.find((a) => a.id === parseInt(selectedAthlete));

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

  async function generateZipSite() {
    if (!selectedMeet) { toast({ title: "Select a meet first", variant: "destructive" }); return; }
    setMeetLoading(true);
    try {
      const meetId = parseInt(selectedMeet);
      const store = readStore();
      const meet = store.meets.find((m) => m.id === meetId);
      if (!meet) throw new Error("Meet not found");

      const psychSheet = meetOptions.includePsychSheet ? buildPsychSheet(meetId) : null;
      const heatSheet = meetOptions.includeHeatSheet ? buildHeatSheet(meetId) : null;
      const resultsSheet = meetOptions.includeResults ? buildResultsSheet(meetId) : null;

      await generateMeetWebsite({
        meet,
        psychSheet,
        heatSheet,
        results: resultsSheet,
        ...meetOptions,
        apiBaseUrl,
      });
      toast({ title: "Meet website generated", description: "ZIP file downloaded" });
    } catch (e: any) {
      toast({ title: "Generation failed", description: e?.message, variant: "destructive" });
    } finally {
      setMeetLoading(false);
    }
  }

  async function generateLiveHTML() {
    if (!selectedMeet) { toast({ title: "Select a meet first", variant: "destructive" }); return; }
    setLiveLoading(true);
    try {
      const meetId = parseInt(selectedMeet);
      const html = await generateAllInOneHTML({
        meetId,
        apiServerUrl: apiBaseUrl,
        ...meetOptions,
      });

      const store = readStore();
      const meet = store.meets.find((m) => m.id === meetId);
      const safeName = (meet?.name ?? "meet").replace(/[^a-zA-Z0-9]/g, "_");

      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName}_live.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "All-in-one HTML generated", description: "Single file downloaded — open in any browser" });
    } catch (e: any) {
      toast({ title: "Generation failed", description: e?.message, variant: "destructive" });
    } finally {
      setLiveLoading(false);
    }
  }

  async function generatePortal() {
    if (!selectedAthlete) { toast({ title: "Select an athlete first", variant: "destructive" }); return; }
    setPortalLoading(true);
    try {
      const store = readStore();
      const athleteId = parseInt(selectedAthlete);
      const athlete = store.athletes.find((a) => a.id === athleteId);
      if (!athlete) throw new Error("Athlete not found");

      const team = athlete.teamId ? store.teams.find((t) => t.id === athlete.teamId) : null;
      const athleteWithTeam = { ...athlete, teamName: team?.name };
      const athleteInvoices = store.invoices.filter((i) => i.athleteId === athleteId);
      const athleteWorkouts = athlete.teamId
        ? store.workouts.filter((w) => w.teamId === athlete.teamId)
        : [];

      const portalBaseUrl = apiBaseUrl || window.location.origin;

      await generateFamilyPortal({
        athlete: athleteWithTeam,
        workouts: athleteWorkouts,
        invoices: athleteInvoices,
        portalUrl: `${portalBaseUrl}/portal/${athleteId}`,
        clubName,
      });
      toast({ title: "Family portal generated", description: "ZIP downloaded" });
    } catch (e: any) {
      toast({ title: "Generation failed", description: e?.message, variant: "destructive" });
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Website Generation</h1>
        <p className="text-muted-foreground">Generate public meet websites with live results, QR codes, and scratch forms.</p>
      </div>

      <Tabs defaultValue="meet">
        <TabsList>
          <TabsTrigger value="meet"><Globe className="h-4 w-4 mr-2" />Meet Website</TabsTrigger>
          <TabsTrigger value="portal"><QrCode className="h-4 w-4 mr-2" />Family Portal</TabsTrigger>
          <TabsTrigger value="guide"><Info className="h-4 w-4 mr-2" />Hosting Guide</TabsTrigger>
        </TabsList>

        {/* ── MEET WEBSITE ─────────────────────────────────────────────────── */}
        <TabsContent value="meet" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" /> Meet Results Website
              </CardTitle>
              <CardDescription>
                Generate a complete HTML website with psych sheets, heat sheets, live results, and a scratch form.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Meet</Label>
                  <Select value={selectedMeet} onValueChange={setSelectedMeet}>
                    <SelectTrigger><SelectValue placeholder="Choose a meet…" /></SelectTrigger>
                    <SelectContent>
                      {meets?.map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {m.name} <span className="text-muted-foreground text-xs ml-1">({m.status})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>API / Live Server URL</Label>
                  <Input
                    value={apiBaseUrl}
                    onChange={(e) => setApiBaseUrl(e.target.value)}
                    placeholder="https://yourserver.com"
                  />
                  <p className="text-xs text-muted-foreground">For live results polling and scratch form submissions</p>
                </div>
              </div>

              {meetObj && (
                <div className="flex gap-3 p-3 rounded-lg bg-muted/50 text-sm flex-wrap">
                  <Badge variant="outline">{meetObj.course}</Badge>
                  <Badge variant="outline">{meetObj.status}</Badge>
                  <span className="text-muted-foreground">{meetObj.startDate}</span>
                </div>
              )}

              <div className="space-y-1">
                <Label className="font-semibold">Sections to Include</Label>
                <div className="border rounded-md px-3 divide-y">
                  <OptionRow id="psych" label="Psych Sheet" description="Pre-meet entry list sorted by seed time"
                    checked={meetOptions.includePsychSheet}
                    onCheckedChange={(v) => setMeetOptions((p) => ({ ...p, includePsychSheet: !!v }))} />
                  <OptionRow id="heat" label="Heat Sheet" description="Seeded heat/lane assignments"
                    checked={meetOptions.includeHeatSheet}
                    onCheckedChange={(v) => setMeetOptions((p) => ({ ...p, includeHeatSheet: !!v }))} />
                  <OptionRow id="results" label="Results" description="Final results with times, places, and points"
                    checked={meetOptions.includeResults}
                    onCheckedChange={(v) => setMeetOptions((p) => ({ ...p, includeResults: !!v }))} />
                  <OptionRow id="scratch" label="Finals Scratch Form" description="Online form connected to your API server"
                    checked={meetOptions.includeScratchForm}
                    onCheckedChange={(v) => setMeetOptions((p) => ({ ...p, includeScratchForm: !!v }))} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Button className="w-full" onClick={generateLiveHTML} disabled={liveLoading || !selectedMeet}>
                    {liveLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCode className="mr-2 h-4 w-4" />}
                    {liveLoading ? "Generating…" : "All-in-One HTML (Recommended)"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Single file · Live polling · QR code · No server needed to view
                  </p>
                </div>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full" onClick={generateZipSite} disabled={meetLoading || !selectedMeet}>
                    {meetLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    {meetLoading ? "Generating…" : "Multi-Page ZIP"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Multiple HTML pages · Upload to any web host
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {apiBaseUrl && selectedMeet && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="py-3 px-4 flex items-start gap-3">
                <Wifi className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="text-sm">
                  <strong>Live Results URL:</strong>{" "}
                  <code className="bg-muted px-1 rounded text-xs">{apiBaseUrl}/api/live/{selectedMeet}</code>
                  <br />
                  <span className="text-muted-foreground text-xs">Use "Push Live Results" in the Run tab to send updates to this endpoint.</span>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── FAMILY PORTAL ──────────────────────────────────────────────── */}
        <TabsContent value="portal">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-primary" /> Family Athlete Portal
              </CardTitle>
              <CardDescription>
                Per-athlete page with contact info, invoices, workouts, and a scannable QR code.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Athlete</Label>
                  <Select value={selectedAthlete} onValueChange={setSelectedAthlete}>
                    <SelectTrigger><SelectValue placeholder="Choose an athlete…" /></SelectTrigger>
                    <SelectContent>
                      {athletes?.map((a) => (
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
                    value={apiBaseUrl}
                    onChange={(e) => setApiBaseUrl(e.target.value)}
                    placeholder="https://yourclub.com"
                  />
                  <p className="text-xs text-muted-foreground">QR code will point to this URL</p>
                </div>
              </div>

              <div className="rounded-md border p-4 space-y-2 text-sm">
                <p className="font-semibold">Portal includes:</p>
                <ul className="text-muted-foreground space-y-1">
                  {["Contact & parent info", "Outstanding balance", "Invoice history", "Recent workouts", "Scannable QR code"].map((item) => (
                    <li key={item} className="flex items-center gap-2"><span className="text-green-600">✓</span>{item}</li>
                  ))}
                </ul>
              </div>

              <Button className="w-full" onClick={generatePortal} disabled={portalLoading || !selectedAthlete}>
                {portalLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                {portalLoading ? "Generating…" : "Generate & Download Portal ZIP"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── HOSTING GUIDE ────────────────────────────────────────────────── */}
        <TabsContent value="guide">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { name: "Local Preview", badge: "Free / Offline", steps: ["Save the HTML file", "Open in any browser", "Share the file directly"] },
              { name: "GitHub Pages", badge: "Free / Online", steps: ["Create a GitHub repo", "Upload the HTML file", "Enable Pages in Settings", "Share the .github.io URL"] },
              { name: "Club Web Server", badge: "Full Control", steps: ["FTP into your server", "Upload to a meet subfolder", "Share the URL with families"] },
            ].map((opt) => (
              <Card key={opt.name}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm">{opt.name}</CardTitle>
                    <Badge variant="secondary" className="text-[10px]">{opt.badge}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                    {opt.steps.map((s) => <li key={s}>{s}</li>)}
                  </ol>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Wifi className="h-4 w-4 text-primary" />Live Results Integration
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              <p>The All-in-One HTML file connects to your API server for live result updates every 30 seconds.</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
                <li>Enter your API server URL above (e.g., <code>https://your-app.replit.app</code>)</li>
                <li>Generate the All-in-One HTML — a QR code to the live feed will be embedded</li>
                <li>During the meet, use <strong>Push Live Results</strong> in the Run tab to broadcast updates</li>
                <li>The page auto-refreshes every 30 seconds showing new results</li>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
