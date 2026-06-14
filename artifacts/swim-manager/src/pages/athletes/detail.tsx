import { useRoute, Link } from "wouter";
import { useGetAthlete, readStore } from "@/lib/local-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  User, Phone, Mail, Globe, Heart, FileText, Calendar,
  Users, ShieldCheck, ArrowLeft, ExternalLink, Trophy
} from "lucide-react";
import { formatTime } from "@/lib/format-time";
import { useMemo } from "react";

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

export default function AthleteDetail() {
  const [, params] = useRoute("/athletes/:id");
  const athleteId = params?.id ? parseInt(params.id, 10) : 0;

  const { data: athlete, isLoading } = useGetAthlete(athleteId);

  const bestTimes = useMemo(() => {
    if (!athlete) return [];
    const store = readStore();
    const entries = store.entries.filter((e) => e.athleteId === athlete.id);
    const results: { event: string; time: number }[] = [];
    for (const entry of entries) {
      const evt = store.events.find((ev) => ev.id === entry.eventId);
      if (!evt) continue;
      // Consider every round's swim (prelim + final); the best-time map below
      // keeps the fastest valid time per event.
      for (const result of store.results.filter((r) => r.entryId === entry.id)) {
        if (result.finishTime && !result.dq && !result.ns && !result.dnf) {
          results.push({
            event: `${evt.distance} ${evt.stroke}`,
            time: result.finishTime,
          });
        }
      }
    }
    const bestMap = new Map<string, number>();
    for (const r of results) {
      const prev = bestMap.get(r.event);
      if (!prev || r.time < prev) bestMap.set(r.event, r.time);
    }
    return Array.from(bestMap.entries())
      .map(([event, time]) => ({ event, time }))
      .sort((a, b) => a.event.localeCompare(b.event));
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

        {/* Best Times */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4" /> Best Times from Meet Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bestTimes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No recorded results yet. Best times will appear here once meet results are entered.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {bestTimes.map(({ event, time }) => (
                  <div key={event} className="rounded-lg border bg-muted/30 px-3 py-2.5 text-center">
                    <div className="text-xs text-muted-foreground mb-1">{event}</div>
                    <div className="font-mono font-bold text-primary text-lg">{formatTime(time)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
