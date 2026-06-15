import { useRoute, Link } from "wouter";
import { useGetAthlete, readStore } from "@/lib/local-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  User, Phone, Mail, Globe, Heart, FileText, Calendar,
  Users, ShieldCheck, ArrowLeft, ExternalLink, Trophy, TrendingDown, Clock
} from "lucide-react";
import { formatTime } from "@/lib/format-time";
import { useMemo, useState } from "react";

function InfoRow({ icon: Icon, label, value, href }: {
  icon: any; label: string; value?: string | null; href?: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
          >
            {value} <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <div className="text-sm font-medium break-words">{value}</div>
        )}
      </div>
    </div>
  );
}

interface PbEntry {
  event: string;
  time: number;
  source: string;
  improvementSeconds: number | null;
  totalSwims: number;
}

export default function AthleteDetail() {
  const [, params] = useRoute("/athletes/:id");
  const athleteId = params?.id ? parseInt(params.id, 10) : 0;
  const [showHistory, setShowHistory] = useState(false);

  const { data: athlete, isLoading } = useGetAthlete(athleteId);

  const { bestTimes, history } = useMemo<{
    bestTimes: PbEntry[];
    history: { event: string; times: { time: number; source: string }[] }[];
  }>(() => {
    if (!athlete) return { bestTimes: [], history: [] };
    const store = readStore();

    // Find all athlete IDs that match this person — the global ID plus any
    // meet-scoped copies (they share the same first/last name).
    const matchingIds = new Set(
      store.athletes
        .filter(
          (a) =>
            a.firstName.toLowerCase() === athlete.firstName.toLowerCase() &&
            a.lastName.toLowerCase() === athlete.lastName.toLowerCase()
        )
        .map((a) => a.id)
    );

    // ── Meet results ─────────────────────────────────────────────────────────
    const allRaw: { event: string; time: number; source: string }[] = [];

    for (const entry of store.entries) {
      if (!matchingIds.has(entry.athleteId)) continue;
      const evt = store.events.find((ev) => ev.id === entry.eventId);
      if (!evt) continue;
      const meetName =
        store.meets.find((m) => m.id === entry.meetId)?.name ?? "Meet";
      for (const result of store.results.filter((r) => r.entryId === entry.id)) {
        if (result.finishTime && !result.dq && !result.ns && !result.dnf) {
          allRaw.push({
            event: `${evt.distance} ${evt.stroke}`,
            time: result.finishTime,
            source: meetName,
          });
        }
      }
    }

    // ── Time Trial results ────────────────────────────────────────────────────
    for (const session of store.timeTrialSessions ?? []) {
      if (!session.athleteIds.includes(athlete.id)) continue;
      for (const res of session.results ?? []) {
        if (res.athleteId !== athlete.id || res.dq || res.ns || !res.time) continue;
        const ev = session.events?.[res.eventIndex];
        if (!ev) continue;
        allRaw.push({
          event: `${ev.distance} ${ev.stroke}`,
          time: res.time,
          source: `TT: ${session.title}`,
        });
      }
    }

    // ── Build best-per-event map ──────────────────────────────────────────────
    const byEvent = new Map<string, { time: number; source: string }[]>();
    for (const r of allRaw) {
      const arr = byEvent.get(r.event) ?? [];
      arr.push({ time: r.time, source: r.source });
      byEvent.set(r.event, arr);
    }

    const bestTimes: PbEntry[] = [];
    const history: { event: string; times: { time: number; source: string }[] }[] = [];

    for (const [event, times] of Array.from(byEvent.entries()).sort(([a], [b]) => a.localeCompare(b))) {
      const sorted = [...times].sort((a, b) => a.time - b.time);
      const best = sorted[0];
      const second = sorted[1];
      bestTimes.push({
        event,
        time: best.time,
        source: best.source,
        improvementSeconds: second ? second.time - best.time : null,
        totalSwims: sorted.length,
      });
      history.push({ event, times: sorted });
    }

    return { bestTimes, history };
  }, [athlete]);

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading athlete details...</div>;
  if (!athlete) return (
    <div className="p-8 text-center">
      <p className="text-muted-foreground mb-4">Athlete not found</p>
      <Link href="/athletes"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" />Back to Athletes</Button></Link>
    </div>
  );

  const age = athlete.dateOfBirth
    ? new Date().getFullYear() - new Date(athlete.dateOfBirth).getFullYear()
    : null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center text-primary border border-primary/20 shrink-0">
          <User className="h-8 w-8" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">
            {athlete.firstName} {athlete.lastName}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="text-muted-foreground text-sm">
              {(athlete as any).teamName || "Unattached"}
            </span>
            <Badge variant="outline">{athlete.gender === "M" ? "Male" : athlete.gender === "F" ? "Female" : "Other"}</Badge>
            {age && <Badge variant="secondary">Age {age}</Badge>}
            {(athlete as any).trainingGroup && (
              <Badge className="bg-primary/10 text-primary border-primary/20">
                <Users className="h-3 w-3 mr-1" />
                {(athlete as any).trainingGroup}
              </Badge>
            )}
            {!athlete.active && <Badge variant="destructive">Inactive</Badge>}
          </div>
        </div>
        <Link href="/athletes">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1.5" /> All Athletes
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4" /> Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow icon={Mail} label="Email" value={athlete.email} href={athlete.email ? `mailto:${athlete.email}` : undefined} />
            <InfoRow icon={Phone} label="Phone" value={athlete.phone} href={athlete.phone ? `tel:${athlete.phone}` : undefined} />
            <InfoRow icon={Globe} label="Website" value={(athlete as any).website} href={(athlete as any).website} />
            {(athlete.parentName || athlete.parentEmail || athlete.parentPhone) && (
              <>
                <Separator />
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Parent / Guardian</div>
                <InfoRow icon={User} label="Name" value={athlete.parentName} />
                <InfoRow icon={Mail} label="Email" value={athlete.parentEmail} href={athlete.parentEmail ? `mailto:${athlete.parentEmail}` : undefined} />
                <InfoRow icon={Phone} label="Phone" value={athlete.parentPhone} href={athlete.parentPhone ? `tel:${athlete.parentPhone}` : undefined} />
              </>
            )}
            {!athlete.email && !athlete.phone && !(athlete as any).website && !athlete.parentName && (
              <p className="text-muted-foreground text-sm">No contact information provided.</p>
            )}
          </CardContent>
        </Card>

        {/* Registration & Medical */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Registration & Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow icon={ShieldCheck} label="Registration ID" value={athlete.idNumber} />
            <InfoRow icon={Calendar} label="Date of Birth" value={athlete.dateOfBirth} />
            <InfoRow icon={Users} label="Training Group" value={(athlete as any).trainingGroup} />
            <InfoRow icon={Calendar} label="Date Added" value={athlete.createdAt ? new Date(athlete.createdAt).toLocaleDateString() : undefined} />
            {athlete.healthNotes && (
              <>
                <Separator />
                <div className="flex items-start gap-2">
                  <Heart className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-destructive mb-1">Medical / Allergy Alert</div>
                    <p className="text-sm bg-destructive/10 text-destructive p-2.5 rounded border border-destructive/20 leading-relaxed">
                      {athlete.healthNotes}
                    </p>
                  </div>
                </div>
              </>
            )}
            {athlete.notes && (
              <>
                <Separator />
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Notes</div>
                    <p className="text-sm leading-relaxed">{athlete.notes}</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Personal Bests */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4 text-yellow-500" /> Personal Best Times
              </CardTitle>
              {history.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setShowHistory((v) => !v)}
                >
                  <Clock className="h-3.5 w-3.5 mr-1.5" />
                  {showHistory ? "Hide History" : "Show History"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {bestTimes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No recorded times yet. Personal bests appear here once meet results or time trial sessions are recorded.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {bestTimes.map(({ event, time, source, improvementSeconds, totalSwims }) => (
                    <div key={event} className="rounded-lg border bg-muted/30 px-3 py-2.5">
                      <div className="text-xs text-muted-foreground mb-1">{event}</div>
                      <div className="font-mono font-bold text-primary text-lg">{formatTime(time)}</div>
                      <div className="text-xs text-muted-foreground mt-1 truncate" title={source}>{source}</div>
                      {improvementSeconds != null && improvementSeconds > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <TrendingDown className="h-3 w-3 text-green-500 shrink-0" />
                          <span className="text-xs text-green-600 font-medium">
                            -{formatTime(improvementSeconds)} PR
                          </span>
                        </div>
                      )}
                      {totalSwims > 1 && (
                        <div className="text-xs text-muted-foreground/70 mt-0.5">{totalSwims} swims</div>
                      )}
                    </div>
                  ))}
                </div>

                {showHistory && history.length > 0 && (
                  <div className="mt-6 space-y-4">
                    <Separator />
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      All Recorded Times
                    </div>
                    <div className="space-y-3">
                      {history.map(({ event, times }) => (
                        <div key={event}>
                          <div className="text-sm font-medium mb-1.5">{event}</div>
                          <div className="flex flex-wrap gap-2">
                            {times.map((t, i) => (
                              <div
                                key={i}
                                className={`rounded border px-2.5 py-1.5 text-center ${
                                  i === 0
                                    ? "border-yellow-500/40 bg-yellow-500/10"
                                    : "border-border bg-muted/20"
                                }`}
                              >
                                <div className="font-mono font-bold text-sm">{formatTime(t.time)}</div>
                                <div className="text-xs text-muted-foreground truncate max-w-[120px]" title={t.source}>{t.source}</div>
                                {i === 0 && (
                                  <div className="text-xs font-semibold text-yellow-600 mt-0.5">PB</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
