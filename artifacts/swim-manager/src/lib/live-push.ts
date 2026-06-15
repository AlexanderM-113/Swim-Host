import { readStore, effectiveResult } from "@/lib/local-store";
import { formatTime } from "@/lib/format-time";

declare global {
  interface Window {
    electronBridge?: {
      isElectron: true;
      getClubConfig: () => Promise<{
        clubCode?: string;
        liveRelayUrl?: string;
        [key: string]: unknown;
      } | null>;
    };
  }
}

export async function autoPushLiveResults(meetId: number): Promise<void> {
  const store = readStore();
  const meetEvents = store.events.filter((e) => e.meetId === meetId);
  const liveEvents = meetEvents.map((event) => {
    const eventEntries = store.entries.filter((e) => e.eventId === event.id && !e.scratched);
    const results = eventEntries
      .map((entry) => {
        const result = effectiveResult(store.results, entry.id);
        const athlete = store.athletes.find((a) => a.id === entry.athleteId);
        const team = athlete?.teamId ? store.teams.find((t) => t.id === athlete.teamId) : null;
        return {
          athleteName: athlete ? `${athlete.firstName} ${athlete.lastName}` : "Unknown",
          teamAbbreviation: team?.abbreviation ?? "UNAT",
          seedTime: entry.seedTime ? formatTime(entry.seedTime) : "NT",
          finishTime: result?.finishTime ? formatTime(result.finishTime) : null,
          place: result?.place ?? null,
          points: result?.points ?? null,
          dq: result?.dq ?? false,
          ns: result?.ns ?? false,
          dnf: result?.dnf ?? false,
        };
      })
      .filter((r) => r.finishTime || r.dq || r.ns || r.dnf)
      .sort((a, b) => (a.place ?? 999) - (b.place ?? 999));

    return {
      eventNumber: event.eventNumber,
      description: `${event.gender === "F" ? "Women" : "Men"} ${event.ageGroup || "Open"} ${event.distance} ${event.stroke}`,
      status: event.status,
      results,
    };
  });

  // ── Determine push URL ────────────────────────────────────────────────────
  // Electron: push to {liveRelayUrl}/api/push/{clubCode}/{meetId}
  // Dev/web:  push to relative /api/live/{meetId}
  let pushUrl: string;

  if (window.electronBridge?.isElectron) {
    const config = await window.electronBridge.getClubConfig();
    const relayUrl = config?.liveRelayUrl?.replace(/\/$/, "");
    const clubCode = config?.clubCode;

    if (!relayUrl) {
      console.warn("[live-push] liveRelayUrl not configured in club-config.json — skipping push");
      return;
    }

    pushUrl = `${relayUrl}/api/push/${clubCode ?? "unknown"}/${meetId}`;
  } else {
    pushUrl = `/api/live/${meetId}`;
  }

  await fetch(pushUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events: liveEvents }),
  });
}
