import JSZip from "jszip";
import QRCode from "qrcode";
import { fmtTime } from "./pdf";

function fmtDate(d: string | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function fmtGender(g: string) {
  return g === "M" ? "Men" : g === "F" ? "Women" : "Mixed";
}

function baseCSS(): string {
  return `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f6fc; color: #1a1a2e; }
a { color: #1a6a9c; text-decoration: none; }
a:hover { text-decoration: underline; }

/* Header */
header { background: #0d3a5c; color: white; padding: 0; }
.header-inner { max-width: 1100px; margin: 0 auto; padding: 18px 24px; display: flex; align-items: center; justify-content: space-between; }
.header-title { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
.header-sub { font-size: 12px; opacity: 0.75; margin-top: 4px; }
.header-badge { background: #1a6a9c; border-radius: 6px; padding: 4px 12px; font-size: 11px; font-weight: 600; }

/* Nav */
nav { background: #09294a; }
nav ul { max-width: 1100px; margin: 0 auto; display: flex; list-style: none; gap: 0; overflow-x: auto; }
nav ul li a { display: block; color: rgba(255,255,255,0.82); padding: 11px 20px; font-size: 13px; font-weight: 500; transition: all 0.15s; white-space: nowrap; }
nav ul li a:hover, nav ul li a.active { background: #1a6a9c; color: white; text-decoration: none; }

/* Main */
main { max-width: 1100px; margin: 24px auto; padding: 0 16px; }

/* Cards */
.card { background: white; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); margin-bottom: 20px; overflow: hidden; }
.card-header { background: #0d3a5c; color: white; padding: 12px 18px; display: flex; align-items: center; gap: 12px; }
.card-header h2 { font-size: 14px; font-weight: 600; }
.card-header .badge { background: rgba(255,255,255,0.18); border-radius: 4px; padding: 2px 8px; font-size: 11px; }
.card-body { padding: 0; }

/* Tables */
table { width: 100%; border-collapse: collapse; font-size: 13px; }
thead tr { background: #e0f0fc; }
th { padding: 9px 12px; text-align: left; font-weight: 600; font-size: 12px; color: #0d3a5c; border-bottom: 2px solid #1a6a9c; }
td { padding: 8px 12px; border-bottom: 1px solid #e8f0f8; vertical-align: middle; }
tr:last-child td { border-bottom: none; }
tr:nth-child(even) { background: #f5faff; }
.mono { font-family: 'Courier New', monospace; font-weight: 600; }
.place-1 { color: #b8860b; font-weight: 700; }
.place-2 { color: #666; font-weight: 700; }
.place-3 { color: #a0522d; font-weight: 700; }
.badge-dq { background: #fee; color: #c00; border-radius: 4px; padding: 1px 6px; font-size: 11px; font-weight: 600; }
.badge-ns { background: #fef9e0; color: #b8860b; border-radius: 4px; padding: 1px 6px; font-size: 11px; font-weight: 600; }

/* Event sections */
.event-section { margin-bottom: 28px; }
.event-title { background: #1a6a9c; color: white; padding: 10px 18px; font-size: 13px; font-weight: 600; border-radius: 6px 6px 0 0; }
.heat-label { background: #e8f0f8; padding: 6px 12px; font-size: 12px; font-weight: 600; color: #0d3a5c; border-top: 1px solid #d0e4f4; }

/* Scratch Form */
.form-group { margin-bottom: 16px; }
label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 5px; color: #0d3a5c; }
input, select, textarea { width: 100%; padding: 9px 12px; border: 1px solid #c0d8ec; border-radius: 5px; font-size: 13px; font-family: inherit; }
input:focus, select:focus, textarea:focus { outline: none; border-color: #1a6a9c; box-shadow: 0 0 0 2px rgba(26,106,156,0.15); }
.btn { background: #0d3a5c; color: white; border: none; padding: 10px 24px; border-radius: 5px; font-size: 13px; font-weight: 600; cursor: pointer; }
.btn:hover { background: #1a6a9c; }
.btn-danger { background: #c00; }
.form-notice { background: #fffbeb; border: 1px solid #f0d060; border-radius: 5px; padding: 10px 14px; font-size: 12px; color: #7a6000; margin-bottom: 16px; }

/* QR */
.qr-section { text-align: center; padding: 24px; }
.qr-section img { border: 4px solid #0d3a5c; border-radius: 8px; }

/* Footer */
footer { text-align: center; padding: 20px; font-size: 11px; color: #888; margin-top: 32px; }

/* Responsive */
@media (max-width: 600px) {
  .header-inner { flex-direction: column; align-items: flex-start; gap: 8px; }
  th, td { padding: 6px 8px; font-size: 12px; }
}
`;
}

function triggerZipDownload(zip: JSZip, filename: string) {
  zip.generateAsync({ type: "blob" }).then(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

// ─── MEET RESULTS WEBSITE ────────────────────────────────────────────────────
export async function generateMeetWebsite(opts: {
  meet: any;
  psychSheet?: any;
  heatSheet?: any;
  results?: any;
  dqReport?: any;
  includeHeatSheet: boolean;
  includeResults: boolean;
  includePsychSheet: boolean;
  includeScratchForm: boolean;
  apiBaseUrl: string;
}) {
  const { meet } = opts;
  const slug = meet.name.replace(/\s+/g, "-").toLowerCase();
  const zip = new JSZip();
  const css = baseCSS();

  const nav = [
    "<li><a href='index.html' class='active'>Home</a></li>",
    opts.includePsychSheet ? "<li><a href='psych-sheet.html'>Psych Sheet</a></li>" : "",
    opts.includeHeatSheet ? "<li><a href='heat-sheet.html'>Heat Sheet</a></li>" : "",
    opts.includeResults ? "<li><a href='results.html'>Results</a></li>" : "",
    opts.includeScratchForm ? "<li><a href='scratch.html'>Scratch Form</a></li>" : "",
  ].filter(Boolean).join("\n    ");

  function layout(title: string, body: string) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${meet.name} — ${title}</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<header>
  <div class="header-inner">
    <div>
      <div class="header-title">${meet.name}</div>
      <div class="header-sub">${fmtDate(meet.startDate)}${meet.endDate && meet.endDate !== meet.startDate ? ` – ${fmtDate(meet.endDate)}` : ""} &nbsp;|&nbsp; ${meet.facility ?? ""} ${meet.city ? `, ${meet.city}` : ""} &nbsp;|&nbsp; ${meet.course}</div>
    </div>
    <div class="header-badge">${meet.meetType} — ${meet.meetClass ?? "Open"}</div>
  </div>
</header>
<nav><ul>${nav}</ul></nav>
<main>${body}</main>
<footer>Generated by SwimManager Pro &nbsp;·&nbsp; ${new Date().toLocaleDateString()}</footer>
</body>
</html>`;
  }

  // Home / Overview
  const homeBody = `
<div class="card">
  <div class="card-header"><h2>Meet Information</h2></div>
  <div class="card-body" style="padding:18px">
    <table style="max-width:500px">
      <tr><th>Facility</th><td>${meet.facility ?? "—"}</td></tr>
      <tr><th>Dates</th><td>${fmtDate(meet.startDate)}${meet.endDate && meet.endDate !== meet.startDate ? ` – ${fmtDate(meet.endDate)}` : ""}</td></tr>
      <tr><th>Course</th><td>${meet.course}</td></tr>
      <tr><th>Meet Type</th><td>${meet.meetType}</td></tr>
      <tr><th>Meet Class</th><td>${meet.meetClass ?? "—"}</td></tr>
      <tr><th>Host LSC</th><td>${meet.hostLsc ?? "—"}</td></tr>
      <tr><th>Entry Deadline</th><td>${fmtDate(meet.entryDeadline)}</td></tr>
      <tr><th>ID Format</th><td>${meet.idFormat ?? "—"}</td></tr>
      <tr><th>Scoring</th><td>${meet.scoringRules ?? "—"}</td></tr>
    </table>
    ${meet.notes ? `<p style="margin-top:14px;font-size:13px;color:#555">${meet.notes}</p>` : ""}
  </div>
</div>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-top:4px">
  ${opts.includePsychSheet ? `<a href="psych-sheet.html" style="display:block;background:#0d3a5c;color:white;padding:16px;border-radius:8px;text-align:center;font-weight:600;text-decoration:none">📋 Psych Sheet</a>` : ""}
  ${opts.includeHeatSheet ? `<a href="heat-sheet.html" style="display:block;background:#1a6a9c;color:white;padding:16px;border-radius:8px;text-align:center;font-weight:600;text-decoration:none">🏊 Heat Sheet</a>` : ""}
  ${opts.includeResults ? `<a href="results.html" style="display:block;background:#0a5c2a;color:white;padding:16px;border-radius:8px;text-align:center;font-weight:600;text-decoration:none">🏆 Results</a>` : ""}
  ${opts.includeScratchForm ? `<a href="scratch.html" style="display:block;background:#8b1a1a;color:white;padding:16px;border-radius:8px;text-align:center;font-weight:600;text-decoration:none">✏️ Finals Scratch Form</a>` : ""}
</div>`;

  zip.file("index.html", layout("Home", homeBody));
  zip.file("style.css", css);

  // Psych Sheet page
  if (opts.includePsychSheet && opts.psychSheet) {
    let body = "";
    for (const event of opts.psychSheet.events) {
      if (!event.entries?.length) continue;
      body += `<div class="event-section">
<div class="event-title">Event ${event.eventNumber} — ${fmtGender(event.gender)} ${event.ageGroup || "Open"} ${event.distance} ${event.stroke}</div>
<table>
<thead><tr><th>#</th><th>Athlete</th><th>Team</th><th>Age</th><th>Seed Time</th><th>Course</th></tr></thead>
<tbody>
${event.entries.map((e: any) => `<tr><td>${e.rank}</td><td>${e.athleteName}</td><td>${e.teamAbbreviation ?? "—"}</td><td>${e.age ?? "—"}</td><td class="mono">${fmtTime(e.seedTime)}</td><td>${e.seedCourse ?? "—"}</td></tr>`).join("\n")}
</tbody></table></div>`;
    }
    zip.file("psych-sheet.html", layout("Psych Sheet", body || "<p style='padding:20px'>No entries available.</p>"));
  }

  // Heat Sheet page
  if (opts.includeHeatSheet && opts.heatSheet) {
    let body = "";
    for (const event of opts.heatSheet.events) {
      if (!event.heats?.length) continue;
      body += `<div class="event-section"><div class="event-title">Event ${event.eventNumber} — ${fmtGender(event.gender)} ${event.ageGroup || "Open"} ${event.distance} ${event.stroke}</div>`;
      for (const heat of event.heats) {
        body += `<div class="heat-label">Heat ${heat.heatNumber}</div>
<table>
<thead><tr><th>Lane</th><th>Athlete</th><th>Team</th><th>Age</th><th>Seed Time</th><th>Finish Time</th></tr></thead>
<tbody>
${heat.lanes.map((l: any) => `<tr><td>${l.lane ?? "—"}</td><td>${l.athleteName}</td><td>${l.teamAbbreviation ?? "—"}</td><td>${l.age ?? "—"}</td><td class="mono">${fmtTime(l.seedTime)}</td><td class="mono"></td></tr>`).join("\n")}
</tbody></table>`;
      }
      body += "</div>";
    }
    zip.file("heat-sheet.html", layout("Heat Sheet", body || "<p style='padding:20px'>No heats found. Ensure events have been seeded.</p>"));
  }

  // Results page
  if (opts.includeResults && opts.results) {
    let body = "";
    for (const event of opts.results.events) {
      if (!event.results?.length) continue;
      body += `<div class="event-section">
<div class="event-title">Event ${event.eventNumber} — ${fmtGender(event.gender)} ${event.ageGroup || "Open"} ${event.distance} ${event.stroke}</div>
<table>
<thead><tr><th>Place</th><th>Athlete</th><th>Team</th><th>Age</th><th>Seed Time</th><th>Finish Time</th><th>Pts</th></tr></thead>
<tbody>
${event.results.map((r: any) => {
  const placeDisplay = r.dq ? '<span class="badge-dq">DQ</span>' : r.ns ? '<span class="badge-ns">NS</span>' : r.dnf ? '<span class="badge-ns">DNF</span>' : `<span class="${r.place === 1 ? "place-1" : r.place === 2 ? "place-2" : r.place === 3 ? "place-3" : ""}">${r.place ?? "—"}</span>`;
  return `<tr><td>${placeDisplay}</td><td>${r.athleteName}</td><td>${r.teamAbbreviation ?? "—"}</td><td>${r.age ?? "—"}</td><td class="mono">${fmtTime(r.seedTime)}</td><td class="mono">${fmtTime(r.finishTime)}</td><td>${r.points != null ? r.points.toFixed(1) : "—"}</td></tr>`;
}).join("\n")}
</tbody></table></div>`;
    }
    zip.file("results.html", layout("Results", body || "<p style='padding:20px'>No results posted yet.</p>"));
  }

  // Scratch Form
  if (opts.includeScratchForm) {
    const scratchBody = `
<div class="card" style="max-width:620px;margin:0 auto">
  <div class="card-header"><h2>Finals Scratch Form</h2></div>
  <div class="card-body" style="padding:24px">
    <div class="form-notice">
      <strong>Important:</strong> Scratching from a final is subject to the scratch deadline. Submitting this form after the deadline may result in a $50 late scratch fee per USAS rules. By signing, you confirm you will not swim this event.
    </div>
    <form id="scratchForm">
      <div class="form-group">
        <label for="fullName">Full Legal Name *</label>
        <input type="text" id="fullName" name="fullName" required placeholder="First Last">
      </div>
      <div class="form-group">
        <label for="dob">Date of Birth *</label>
        <input type="date" id="dob" name="dob" required>
      </div>
      <div class="form-group">
        <label for="eventNum">Event Number *</label>
        <input type="number" id="eventNum" name="eventNum" required placeholder="e.g. 12">
      </div>
      <div class="form-group">
        <label for="eventName">Event Description *</label>
        <input type="text" id="eventName" name="eventName" required placeholder="e.g. Women 200 Freestyle">
      </div>
      <div class="form-group">
        <label for="reason">Reason (Optional)</label>
        <textarea id="reason" name="reason" rows="3" placeholder="Medical, scheduling conflict, etc."></textarea>
      </div>
      <div class="form-group">
        <label for="signature">Digital Signature (Type Full Name) *</label>
        <input type="text" id="signature" name="signature" required placeholder="I agree to scratch from this event">
      </div>
      <div class="form-group">
        <label for="timestamp">Date & Time</label>
        <input type="text" id="timestamp" name="timestamp" readonly style="background:#f5f5f5">
      </div>
      <button type="submit" class="btn">Submit Scratch Request</button>
    </form>
    <div id="confirmation" style="display:none;background:#e8f8e8;border:1px solid #5a5;border-radius:6px;padding:16px;margin-top:16px">
      <strong>✅ Scratch request submitted successfully.</strong><br>
      <span id="confDetails"></span>
    </div>
  </div>
</div>
<script>
document.getElementById('timestamp').value = new Date().toLocaleString();
document.getElementById('scratchForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const data = {
    fullName: document.getElementById('fullName').value,
    dob: document.getElementById('dob').value,
    eventNumber: document.getElementById('eventNum').value,
    eventName: document.getElementById('eventName').value,
    reason: document.getElementById('reason').value,
    signature: document.getElementById('signature').value,
    timestamp: new Date().toISOString(),
    meetId: ${meet.id},
  };
  try {
    const resp = await fetch('${opts.apiBaseUrl}/api/scratch-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (resp.ok) {
      document.getElementById('scratchForm').style.display = 'none';
      const conf = document.getElementById('confirmation');
      conf.style.display = 'block';
      document.getElementById('confDetails').textContent = data.fullName + ' — Event ' + data.eventNumber + ' ' + data.eventName + ' — ' + data.timestamp;
    } else {
      alert('Submission failed. Please contact the meet director.');
    }
  } catch (err) {
    alert('Network error. Please contact the meet director or submit a paper scratch.');
  }
});
</script>`;
    zip.file("scratch.html", layout("Finals Scratch Form", scratchBody));
  }

  // README
  zip.file("README.txt", `${meet.name} — Meet Website
Generated by SwimManager Pro on ${new Date().toLocaleString()}

HOSTING INSTRUCTIONS:
1. Extract all files from this ZIP
2. Upload to any web host (GitHub Pages, Netlify, your club server, etc.)
3. Open index.html in a browser to preview locally

SCRATCH FORM:
The scratch form requires your SwimManager Pro API server to be accessible
at the URL configured during generation. Ensure the server is online before
the scratch deadline window opens.

For GitHub Pages: Push to a public repo and enable Pages in Settings.
`);

  triggerZipDownload(zip, `${slug}-meet-website.zip`);
}

// ─── FAMILY PORTAL ───────────────────────────────────────────────────────────
export async function generateFamilyPortal(opts: {
  athlete: any;
  workouts: any[];
  invoices: any[];
  portalUrl: string;
  clubName: string;
}) {
  const { athlete, workouts, invoices, portalUrl, clubName } = opts;
  const fullName = `${athlete.firstName} ${athlete.lastName}`;
  const slug = fullName.replace(/\s+/g, "-").toLowerCase();
  const zip = new JSZip();
  const css = baseCSS() + `
.athlete-header { background: linear-gradient(135deg, #0d3a5c 0%, #1a6a9c 100%); color: white; border-radius: 10px; padding: 24px; margin-bottom: 20px; display: flex; align-items: center; gap: 20px; }
.athlete-avatar { width: 64px; height: 64px; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; flex-shrink: 0; }
.athlete-name { font-size: 22px; font-weight: 700; }
.athlete-meta { font-size: 13px; opacity: 0.85; margin-top: 4px; }
.invoice-paid { color: #2a7a2a; font-weight: 600; }
.invoice-overdue { color: #c00; font-weight: 600; }
.invoice-pending { color: #b8860b; font-weight: 600; }
.section-title { font-size: 16px; font-weight: 700; color: #0d3a5c; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 2px solid #1a6a9c; }
.qr-card { background: white; border-radius: 8px; padding: 20px; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
`;

  let qrDataUrl = "";
  try {
    qrDataUrl = await QRCode.toDataURL(portalUrl, { width: 180, margin: 1, color: { dark: "#0d3a5c" } });
  } catch {
    qrDataUrl = "";
  }

  const initials = `${athlete.firstName[0] ?? "?"}${athlete.lastName[0] ?? "?"}`;
  const age = athlete.dateOfBirth
    ? String(new Date().getFullYear() - new Date(athlete.dateOfBirth).getFullYear())
    : "—";

  const totalOwed = invoices.filter(i => i.status !== "paid").reduce((s, i) => s + Number(i.amount), 0);
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${fullName} — Family Portal</title>
<style>${css}</style>
</head>
<body>
<header>
  <div class="header-inner">
    <div>
      <div class="header-title">${clubName}</div>
      <div class="header-sub">Athlete Family Portal</div>
    </div>
    <div class="header-badge">SwimManager Pro</div>
  </div>
</header>

<main>
<div class="athlete-header">
  <div class="athlete-avatar">${initials}</div>
  <div>
    <div class="athlete-name">${fullName}</div>
    <div class="athlete-meta">
      ${athlete.gender === "M" ? "Male" : "Female"} &nbsp;·&nbsp; Age ${age}
      &nbsp;·&nbsp; ${athlete.teamName ?? "—"}
      ${athlete.idNumber ? ` &nbsp;·&nbsp; ID: ${athlete.idNumber}` : ""}
    </div>
  </div>
</div>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
  <div style="background:white;border-radius:8px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,0.08)">
    <div style="font-size:11px;font-weight:600;color:#666;margin-bottom:4px">BALANCE OUTSTANDING</div>
    <div style="font-size:26px;font-weight:700;color:${totalOwed > 0 ? "#c00" : "#2a7a2a"}">\$${totalOwed.toFixed(2)}</div>
  </div>
  <div style="background:white;border-radius:8px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,0.08)">
    <div style="font-size:11px;font-weight:600;color:#666;margin-bottom:4px">TOTAL PAID (YTD)</div>
    <div style="font-size:26px;font-weight:700;color:#0d3a5c">\$${totalPaid.toFixed(2)}</div>
  </div>
</div>

<div class="card" style="margin-bottom:20px">
  <div class="card-header"><h2>Contact Information</h2></div>
  <div class="card-body" style="padding:16px">
    <table style="max-width:500px">
      <tr><th>Date of Birth</th><td>${athlete.dateOfBirth ? new Date(athlete.dateOfBirth).toLocaleDateString() : "—"}</td></tr>
      <tr><th>Phone</th><td>${athlete.phone ?? "—"}</td></tr>
      <tr><th>Email</th><td>${athlete.email ?? "—"}</td></tr>
      <tr><th>Parent / Guardian</th><td>${athlete.parentName ?? "—"}</td></tr>
      <tr><th>Parent Phone</th><td>${athlete.parentPhone ?? "—"}</td></tr>
      <tr><th>Parent Email</th><td>${athlete.parentEmail ?? "—"}</td></tr>
    </table>
  </div>
</div>

${invoices.length > 0 ? `
<div class="card" style="margin-bottom:20px">
  <div class="card-header"><h2>Billing & Invoices</h2></div>
  <div class="card-body">
    <table>
      <thead><tr><th>Invoice</th><th>Description</th><th>Type</th><th>Amount</th><th>Due</th><th>Status</th></tr></thead>
      <tbody>
        ${invoices.map(i => `
        <tr>
          <td class="mono">INV-${String(i.id).padStart(5, "0")}</td>
          <td>${i.description}</td>
          <td>${i.invoiceType}</td>
          <td style="font-weight:600">\$${Number(i.amount).toFixed(2)}</td>
          <td>${i.dueDate ? new Date(i.dueDate).toLocaleDateString() : "—"}</td>
          <td><span class="invoice-${i.status}">${(i.status ?? "").toUpperCase()}</span></td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>
</div>
${totalOwed > 0 ? `
<div style="background:#fffbeb;border:1px solid #f0d060;border-radius:8px;padding:16px;margin-bottom:20px">
  <strong>Payment Information:</strong> To pay your outstanding balance of <strong>\$${totalOwed.toFixed(2)}</strong>, please contact ${clubName} or visit the club office. We accept check, cash, and electronic payment.
</div>` : ""}` : ""}

${workouts.length > 0 ? `
<div class="card" style="margin-bottom:20px">
  <div class="card-header"><h2>Recent Workouts</h2></div>
  <div class="card-body">
    <table>
      <thead><tr><th>Date</th><th>Title</th><th>Total Distance</th><th>Course</th><th>Time</th></tr></thead>
      <tbody>
        ${workouts.slice(0, 20).map(w => `
        <tr>
          <td>${w.date ? new Date(w.date).toLocaleDateString() : "—"}</td>
          <td>${w.title}</td>
          <td style="font-weight:600">${w.totalDistance ? w.totalDistance.toLocaleString() + " yds/m" : "—"}</td>
          <td>${w.course ?? "—"}</td>
          <td>${w.startTime ?? "—"}${w.endTime ? " – " + w.endTime : ""}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>
</div>` : ""}

${qrDataUrl ? `
<div class="qr-card" style="max-width:240px;margin:20px auto">
  <div style="font-size:12px;font-weight:600;color:#0d3a5c;margin-bottom:10px">Scan to Access Portal</div>
  <img src="${qrDataUrl}" alt="QR Code" style="width:180px;height:180px">
  <div style="font-size:10px;color:#888;margin-top:8px;word-break:break-all">${portalUrl}</div>
</div>` : ""}

</main>
<footer>Generated by SwimManager Pro &nbsp;·&nbsp; ${new Date().toLocaleDateString()} &nbsp;·&nbsp; ${clubName}</footer>
</body>
</html>`;

  zip.file("index.html", html);
  zip.file("README.txt", `${fullName} — Family Portal
Generated by SwimManager Pro on ${new Date().toLocaleString()}
Club: ${clubName}

This portal contains the athlete's contact information, billing history, and workout history.
Open index.html in any web browser to view.
Upload to a web server or share the QR code to give families easy access.
`);

  triggerZipDownload(zip, `family-portal-${slug}.zip`);
}
