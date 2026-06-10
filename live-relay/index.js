/**
 * SwimManager Pro — Live Results Relay Server
 * Deploy this to Railway. It receives pushes from the Electron app
 * and serves a public results page for spectators.
 *
 * Routes:
 *   POST /api/push/:clubCode/:meetId   — Electron app pushes results here
 *   GET  /api/results/:clubCode/:meetId — Raw JSON results
 *   GET  /:clubCode                     — Spectator landing page (lists meets)
 *   GET  /:clubCode/:meetId             — Spectator results page
 */

const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

// In-memory store — replace with a real DB (Railway PostgreSQL) for persistence
const store = new Map(); // key: "clubCode:meetId" => { meet, results, pushedAt }

// ─── Push endpoint (called by Electron app) ──────────────────────────────────

app.post("/api/push/:clubCode/:meetId", (req, res) => {
  const { clubCode, meetId } = req.params;
  const key = `${clubCode}:${meetId}`;
  store.set(key, {
    meet: req.body.meet ?? {},
    sessions: req.body.sessions ?? [],
    events: req.body.events ?? [],
    results: req.body.results ?? [],
    pushedAt: new Date().toISOString(),
  });
  res.json({ ok: true });
});

// ─── Raw JSON results (for the Electron app to verify) ───────────────────────

app.get("/api/results/:clubCode/:meetId", (req, res) => {
  const key = `${req.params.clubCode}:${req.params.meetId}`;
  const data = store.get(key);
  if (!data) return res.status(404).json({ ok: false, error: "No data found." });
  res.json({ ok: true, ...data });
});

// ─── Spectator landing page ───────────────────────────────────────────────────

app.get("/:clubCode", (req, res) => {
  const { clubCode } = req.params;
  const meets = [];
  for (const [key, val] of store.entries()) {
    const [club, meetId] = key.split(":");
    if (club === clubCode) meets.push({ meetId, name: val.meet?.name ?? `Meet ${meetId}`, pushedAt: val.pushedAt });
  }

  if (meets.length === 0) {
    return res.send(page(`<h2 style="text-align:center;margin-top:3rem;color:#64748b">No active meets right now.</h2>`, clubCode));
  }

  const links = meets
    .sort((a, b) => b.pushedAt.localeCompare(a.pushedAt))
    .map((m) => `<a href="/${clubCode}/${m.meetId}" style="display:block;padding:1rem;margin:.5rem 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:.5rem;color:#0f172a;text-decoration:none;font-weight:600">${m.name} <span style="float:right;font-size:.8rem;color:#64748b">${new Date(m.pushedAt).toLocaleString()}</span></a>`)
    .join("");

  res.send(page(`<h2 style="margin-bottom:1rem">Active Meets</h2>${links}`, clubCode));
});

// ─── Spectator results page ───────────────────────────────────────────────────

app.get("/:clubCode/:meetId", (req, res) => {
  const { clubCode, meetId } = req.params;
  const key = `${clubCode}:${meetId}`;
  const data = store.get(key);

  if (!data) {
    return res.send(page(`<h2 style="text-align:center;margin-top:3rem;color:#64748b">Results not available yet.</h2>`, clubCode));
  }

  const { meet, events = [], results = [] } = data;

  const eventSections = events.map((ev) => {
    const evResults = results
      .filter((r) => r.eventId === ev.id && !r.dq && !r.ns)
      .sort((a, b) => (a.place ?? 99) - (b.place ?? 99));

    if (evResults.length === 0) return "";

    const rows = evResults.map((r) => `
      <tr>
        <td style="padding:.4rem .75rem;text-align:center;font-weight:700">${r.place ?? "—"}</td>
        <td style="padding:.4rem .75rem;font-weight:600">${r.athleteName ?? "—"}</td>
        <td style="padding:.4rem .75rem;color:#475569">${r.teamName ?? "—"}</td>
        <td style="padding:.4rem .75rem;text-align:right;font-family:monospace;font-weight:700;color:#0369a1">${formatTime(r.finishTime)}</td>
      </tr>`).join("");

    return `
      <div style="margin-bottom:2rem">
        <h3 style="background:#0f172a;color:#fff;padding:.5rem 1rem;border-radius:.375rem;font-size:.9rem;margin:0">
          Event ${ev.eventNumber} — ${ev.gender === "F" ? "Girls" : ev.gender === "M" ? "Boys" : "Mixed"} ${ev.ageGroup || "Open"} ${ev.distance} ${ev.stroke}
        </h3>
        <table style="width:100%;border-collapse:collapse;background:#fff">
          <thead style="background:#f1f5f9;font-size:.8rem;color:#64748b">
            <tr>
              <th style="padding:.4rem .75rem;text-align:center">Place</th>
              <th style="padding:.4rem .75rem;text-align:left">Athlete</th>
              <th style="padding:.4rem .75rem;text-align:left">Team</th>
              <th style="padding:.4rem .75rem;text-align:right">Time</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join("");

  const html = `
    <h2 style="margin-bottom:.25rem">${meet.name ?? "Meet Results"}</h2>
    <p style="color:#64748b;margin:0 0 1.5rem;font-size:.875rem">Last updated: ${new Date(data.pushedAt).toLocaleString()}</p>
    ${eventSections || "<p style='color:#64748b'>Results are being entered...</p>"}`;

  res.send(page(html, clubCode, meet.name));
});

// ─── HTML shell ───────────────────────────────────────────────────────────────

function page(body, clubCode, title = "Live Results") {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — SwimManager Pro</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #f8fafc; color: #0f172a; }
    .header { background: #0f172a; color: #fff; padding: 1rem 1.5rem; display: flex; align-items: center; gap: .75rem; }
    .header h1 { margin: 0; font-size: 1.1rem; }
    .badge { background: #0ea5e9; color: #fff; border-radius: 9999px; padding: .15rem .6rem; font-size: .7rem; font-weight: 700; text-transform: uppercase; }
    .content { max-width: 900px; margin: 0 auto; padding: 1.5rem; }
    table { border: 1px solid #e2e8f0; border-radius: .375rem; overflow: hidden; }
    tr:nth-child(even) td { background: #f8fafc; }
  </style>
</head>
<body>
  <div class="header">
    <h1>SwimManager Pro</h1>
    <span class="badge">Live</span>
    <span style="color:#94a3b8;font-size:.85rem;margin-left:auto">${clubCode.toUpperCase()}</span>
  </div>
  <div class="content">${body}</div>
  <script>setTimeout(() => location.reload(), 30000)</script>
</body>
</html>`;
}

// ─── Time formatter ───────────────────────────────────────────────────────────

function formatTime(secs) {
  if (secs == null) return "—";
  const m = Math.floor(secs / 60);
  const s = (secs % 60).toFixed(2).padStart(5, "0");
  return m > 0 ? `${m}:${s}` : s;
}

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Live relay running on port ${PORT}`));
