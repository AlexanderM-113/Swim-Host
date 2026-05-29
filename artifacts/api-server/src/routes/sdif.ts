import { Router } from "express";
import { db } from "@workspace/db";
import {
  meetsTable, eventsTable, entriesTable, athletesTable, teamsTable, resultsTable
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { parseSDIF, summarizeSDIF, type SDIFImportSummary } from "../lib/sdif-server";

const router = Router();

/**
 * POST /sdif/import
 * Parse SDIF text and bulk-create meet, teams, athletes, events, entries.
 */
router.post("/sdif/import", async (req, res): Promise<void> => {
  const { rawText } = req.body;
  if (!rawText) {
    res.status(400).json({ error: "rawText is required" });
    return;
  }

  try {
    const sdif = parseSDIF(rawText);
    const summary = summarizeSDIF(sdif);

    // ── Create meet ───────────────────────────────────────────────────────────
    const courseMap: Record<string, string> = { Y: "SCY", S: "SCM", L: "LCM" };
    const course = courseMap[sdif.meet?.course ?? "Y"] ?? "SCY";

    const [meet] = await db.insert(meetsTable).values({
      name: summary.meetName || "Imported Meet",
      startDate: sdif.meet?.startDate || new Date().toISOString().split("T")[0],
      endDate: sdif.meet?.endDate || undefined,
      facility: sdif.meet?.facility || undefined,
      course,
      status: "upcoming",
    }).returning();

    // ── Build event map from entries ──────────────────────────────────────────
    // Group unique events by (eventNumber, distance, stroke, eventGender)
    const eventKeyMap = new Map<string, {
      eventNumber: number; gender: string; distance: number; stroke: string; ageMin: number; ageMax: number
    }>();
    for (const entry of summary.entries) {
      const key = `${entry.eventNumber}:${entry.distance}:${entry.stroke}:${entry.eventGender}`;
      if (!eventKeyMap.has(key)) {
        eventKeyMap.set(key, {
          eventNumber: entry.eventNumber,
          gender: entry.eventGender,
          distance: entry.distance,
          stroke: entry.stroke,
          ageMin: entry.ageMin,
          ageMax: entry.ageMax,
        });
      }
    }

    // Create events
    const createdEvents = new Map<string, number>(); // key -> event DB id
    for (const [key, evt] of eventKeyMap) {
      const ageGroup =
        evt.ageMin > 0 && evt.ageMax < 99
          ? `${evt.ageMin}-${evt.ageMax}`
          : evt.ageMin > 0
          ? `${evt.ageMin}+`
          : "Open";
      const [createdEvt] = await db.insert(eventsTable).values({
        meetId: meet.id,
        eventNumber: evt.eventNumber,
        gender: evt.gender || "M",
        distance: evt.distance,
        stroke: evt.stroke,
        ageGroup,
        eventType: "standard",
        heatOrder: "slow_to_fast",
        status: "pending",
      }).returning();
      createdEvents.set(key, createdEvt.id);
    }

    // ── Process teams and athletes ────────────────────────────────────────────
    const teamCodeToId = new Map<string, number>();
    const athleteKeyToId = new Map<string, number>(); // lastName:firstName:dob:teamCode -> id

    for (const team of summary.teams) {
      // Upsert team by abbreviation/code
      const existing = await db.select().from(teamsTable)
        .where(eq(teamsTable.abbreviation, team.code)).limit(1);

      let teamId: number;
      if (existing.length > 0) {
        teamId = existing[0].id;
      } else {
        const [t] = await db.insert(teamsTable).values({
          name: team.name || team.code,
          abbreviation: team.code,
          shortName: team.code,
        }).returning();
        teamId = t.id;
      }
      teamCodeToId.set(team.code, teamId);
    }

    // Create entries
    let entryCount = 0;
    for (const entry of summary.entries) {
      const teamId = teamCodeToId.get(entry.teamCode);
      if (!teamId) continue;

      const athleteKey = `${entry.athleteLastName}:${entry.athleteFirstName}:${entry.dateOfBirth}:${entry.teamCode}`;
      let athleteId = athleteKeyToId.get(athleteKey);

      if (!athleteId) {
        // Try to find existing athlete
        const existingAthletes = await db.select().from(athletesTable).where(
          and(
            eq(athletesTable.firstName, entry.athleteFirstName),
            eq(athletesTable.lastName, entry.athleteLastName),
            eq(athletesTable.teamId, teamId)
          )
        ).limit(1);

        if (existingAthletes.length > 0) {
          athleteId = existingAthletes[0].id;
        } else {
          const [a] = await db.insert(athletesTable).values({
            firstName: entry.athleteFirstName || "Unknown",
            lastName: entry.athleteLastName || "Unknown",
            gender: entry.gender || "M",
            dateOfBirth: entry.dateOfBirth || undefined,
            teamId,
            idNumber: entry.ussNumber || undefined,
          }).returning();
          athleteId = a.id;
        }
        athleteKeyToId.set(athleteKey, athleteId);
      }

      const eventKey = `${entry.eventNumber}:${entry.distance}:${entry.stroke}:${entry.eventGender}`;
      const eventId = createdEvents.get(eventKey);
      if (!eventId) continue;

      // Check for duplicate entry
      const existingEntry = await db.select().from(entriesTable)
        .where(and(eq(entriesTable.eventId, eventId), eq(entriesTable.athleteId, athleteId)))
        .limit(1);
      if (existingEntry.length > 0) continue;

      const courseMap2: Record<string, string> = { Y: "SCY", S: "SCM", L: "LCM" };
      const [createdEntry] = await db.insert(entriesTable).values({
        eventId,
        athleteId,
        teamId,
        seedTime: entry.seedTime ?? null,
        seedCourse: courseMap2[entry.seedCourse ?? "Y"] ?? "SCY",
        scratched: false,
      }).returning();

      // If results included, create result
      if (entry.result && createdEntry) {
        const r = entry.result;
        await db.insert(resultsTable).values({
          entryId: createdEntry.id,
          eventId,
          finishTime: r.finishTime ?? undefined,
          place: r.place ?? undefined,
          dq: r.dq ?? false,
          dqCode: r.dqCode ?? undefined,
          ns: r.ns ?? false,
          dnf: r.dnf ?? false,
          points: 0,
        }).onConflictDoNothing();
      }

      entryCount++;
    }

    res.json({
      meetId: meet.id,
      teams: teamCodeToId.size,
      events: createdEvents.size,
      entries: entryCount,
    });
  } catch (err: any) {
    console.error("SDIF import error:", err);
    res.status(500).json({ error: err?.message ?? "Import failed" });
  }
});

/**
 * GET /app/download
 * Returns a ZIP of the application source for local deployment.
 */
router.get("/app/download", async (req, res): Promise<void> => {
  try {
    const JSZip = (await import("jszip")).default;
    const fs = await import("fs");
    const path = await import("path");

    const zip = new JSZip();
    const rootDir = path.resolve(process.cwd(), "..");

    // Include key directories
    const dirs = ["artifacts/api-server", "artifacts/swim-manager", "lib", "scripts"];
    const rootFiles = ["package.json", "pnpm-workspace.yaml", "tsconfig.base.json", "tsconfig.json", ".npmrc", "replit.md"];

    function addDir(zipFolder: JSZip, diskPath: string, relativePath: string) {
      if (!fs.existsSync(diskPath)) return;
      const items = fs.readdirSync(diskPath);
      for (const item of items) {
        if (item === "node_modules" || item === "dist" || item === ".git" || item === ".cache") continue;
        const fullPath = path.join(diskPath, item);
        const zipPath = path.join(relativePath, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          addDir(zipFolder, fullPath, zipPath);
        } else if (stat.size < 2 * 1024 * 1024) { // skip files > 2MB
          try {
            const content = fs.readFileSync(fullPath);
            zip.file(zipPath, content);
          } catch {}
        }
      }
    }

    for (const dir of dirs) {
      const full = path.join(rootDir, dir);
      addDir(zip, full, dir);
    }
    for (const f of rootFiles) {
      const full = path.join(rootDir, f);
      if (fs.existsSync(full)) {
        zip.file(f, fs.readFileSync(full));
      }
    }

    // Add a setup script
    zip.file("setup.sh", `#!/bin/bash\necho "Installing dependencies..."\npnpm install\necho "Done! Run: pnpm --filter @workspace/api-server run dev"\n`);
    zip.file("README.md", `# SwimManager Pro\n\nRun:\n\n\`\`\`\npnpm install\npnpm --filter @workspace/db run push\npnpm --filter @workspace/api-server run dev &\npnpm --filter @workspace/swim-manager run dev\n\`\`\`\n\nRequires: Node.js 18+, PostgreSQL, pnpm\n`);

    const buffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="SwimManagerPro.zip"');
    res.end(buffer);
  } catch (err: any) {
    console.error("App download error:", err);
    res.status(500).json({ error: err?.message ?? "Download failed" });
  }
});

export default router;
