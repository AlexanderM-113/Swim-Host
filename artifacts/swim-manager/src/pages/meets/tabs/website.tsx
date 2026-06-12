import { useState, useEffect, useCallback } from "react";
import { useListEvents, useListSessions, useUpdateEntry, readStore, type Session } from "@/lib/local-store";
import {
  readScratchRequests,
  setScratchStatus,
  subscribeScratchRequests,
} from "@/lib/scratch-requests";
import { broadcastDataChanged, subscribeToSignals } from "@/lib/live-broadcast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Globe, QrCode, Copy, Check, RefreshCw, AlertTriangle, CheckCircle2,
  XCircle, Clock, User, FileText, ExternalLink, Wifi, WifiOff, Send
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

const BASE_URL = window.location.origin;
const APP_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ScratchRequest {
  id: string;
  fullName: string;
  dob: string;
  eventNumber: string;
  eventName: string;
  reason: string;
  signature: string;
  timestamp: string;
  meetId: string;
  status: "pending" | "approved" | "denied";
}

const USA_RULES: Record<string, string> = {
  "Timed Finals": "USA Swimming Rule 102.7 — Scratches must be submitted at least 30 minutes before the start of competition for timed finals meets.",
  "Prelims": "USA Swimming Rule 102.7(A) — Scratches for Preliminary events must be submitted at least 1 hour before the session start time.",
  "Finals": "USA Swimming Rule 102.7(C) — Scratches for Finals must be submitted within 30 minutes of the completion of Preliminary events.",
  "Combined Finals": "USA Swimming Rule 102.7 — Athletes must scratch within 30 minutes of being seeded into the final.",
  "default": "USA Swimming Rule 102.7 — Scratches must be submitted per the meet announcement. Failure to scratch properly may result in a suspension.",
};

function getApplicableRule(sessions: Session[], eventNumber: string) {
  const session = sessions.find((s) => (s as any).events?.includes(eventNumber));
  const type = (session as any)?.sessionType ?? "";
  return USA_RULES[type] ?? USA_RULES.default;
}

function QRCodeDisplay({ url }: { url: string }) {
  const [qrSrc, setQrSrc] = useState<string>("");
  useEffect(() => {
    setQrSrc(`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=0d4f8a`);
  }, [url]);
  return (
    <div className="flex flex-col items-center gap-2">
      {qrSrc && <img src={qrSrc} alt="QR Code" className="w-32 h-32 rounded-lg border" />}
      <span className="text-[10px] text-muted-foreground">Scan to open meet website</span>
    </div>
  );
}

export default function MeetWebsite({ meetId }: { meetId: number }) {
  const { toast } = useToast();
  const { data: events = [] } = useListEvents(meetId);
  const { data: sessions = [] } = useListSessions(meetId);
  const updateEntry = useUpdateEntry();

  const [scratchRequests, setScratchRequests] = useState<ScratchRequest[]>([]);
  const [liveStatus, setLiveStatus] = useState<"idle" | "live" | "error">("idle");
  const [lastPushed, setLastPushed] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [copied, setCopied] = useState(false);
  const [customMessage, setCustomMessage] = useState("");

  // Public, styled meet website (not the raw JSON API).
  const liveUrl = `${BASE_URL}${APP_BASE}/live/${meetId}`;
  const meetSiteUrl = liveUrl;

  const fetchScratchRequests = useCallback(async () => {
    setFetching(true);
    // ScratchPad submissions are stored locally (same-browser sync). Merge in
    // any server-side requests too, if an API server is running.
    const local: ScratchRequest[] = readScratchRequests(meetId).map((r) => ({
      id: r.id,
      fullName: r.fullName,
      dob: r.dob,
      eventNumber: r.eventNumber,
      eventName: r.eventName,
      reason: r.reason,
      signature: r.signature,
      timestamp: r.timestamp,
      meetId: String(r.meetId),
      status: r.status,
    }));
    let merged = local;
    try {
      const res = await fetch(`/api/live/${meetId}/scratchings`);
      if (res.ok) {
        const remote: ScratchRequest[] = await res.json();
        const seen = new Set(local.map((r) => r.id));
        merged = [...local, ...remote.filter((r) => !seen.has(r.id))];
      }
    } catch {}
    merged.sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""));
    setScratchRequests(merged);
    setFetching(false);
  }, [meetId]);

  useEffect(() => {
    fetchScratchRequests();
    const interval = setInterval(fetchScratchRequests, 15_000);
    const offLocal = subscribeScratchRequests(meetId, fetchScratchRequests);
    const offSignal = subscribeToSignals((s) => {
      if (s.meetId === meetId) fetchScratchRequests();
    });
    return () => { clearInterval(interval); offLocal(); offSignal(); };
  }, [fetchScratchRequests, meetId]);

  async function pushToLive() {
    setPushing(true);
    try {
      // Store live data in localStorage so the /live/:meetId page can read it
      // directly without a running API server. The live page already reads
      // from localStorage, so this is always the primary publish path.
      const store = readStore();
      const liveKey = `swimmanager_live_${meetId}`;
      const livePayload = {
        meetId,
        pushedAt: new Date().toISOString(),
        message: customMessage || undefined,
        events: events.map((e) => ({
          id: e.id,
          eventNumber: e.eventNumber,
          gender: e.gender,
          ageGroup: e.ageGroup,
          distance: e.distance,
          stroke: e.stroke,
          status: e.status,
          isRelay: e.isRelay,
        })),
        meet: store.meets.find((m) => m.id === meetId) ?? null,
        results: store.results,
        heats: store.heats,
        entries: store.entries,
      };
      localStorage.setItem(liveKey, JSON.stringify(livePayload));

      // Also attempt to push to the API server if one is running (optional,
      // enables multi-device viewing). Failures are silently swallowed because
      // the local live page works without it.
      try {
        await fetch(`/api/live/${meetId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(livePayload),
          signal: AbortSignal.timeout(3000),
        });
      } catch {}

      setLiveStatus("live");
      setLastPushed(new Date().toISOString());
      broadcastDataChanged(meetId);
      toast({ title: "Meet data pushed live", description: "The live meet page is now updated — athletes and coaches can view results." });
    } catch (e: any) {
      setLiveStatus("error");
      toast({ title: "Push failed", description: e?.message, variant: "destructive" });
    }
    setPushing(false);
  }

  async function handleScratchDecision(req: ScratchRequest, decision: "approved" | "denied") {
    const newStatus = decision;
    // Persist status: locally-stored requests via the shared store, plus a
    // best-effort PATCH to the API server if one is serving this meet.
    const isLocal = readScratchRequests(meetId).some((r) => r.id === req.id);
    if (isLocal) setScratchStatus(meetId, req.id, newStatus);
    try {
      await fetch(`/api/live/${meetId}/scratch/${req.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {}

    if (decision === "approved") {
      // Workflow: identify athlete/event → flip entry status → propagate.
      const evNum = parseInt(req.eventNumber);
      const matchingEvent = events.find((e) => e.eventNumber === evNum);
      const store = readStore();
      const entry = matchingEvent
        ? store.entries.find((en) => {
            if (en.eventId !== matchingEvent.id) return false;
            const ath = store.athletes.find((a) => a.id === en.athleteId);
            const name = ath ? `${ath.firstName} ${ath.lastName}` : en.athleteName ?? "";
            return name.toLowerCase() === req.fullName.toLowerCase();
          })
        : undefined;
      if (entry) {
        await updateEntry.mutateAsync({ id: entry.id, data: { scratched: true } });
        broadcastDataChanged(meetId);
        toast({
          title: "Scratch approved",
          description: `${req.fullName} — Event ${req.eventNumber}. Entry marked scratched; seeding/heat sheets will update.`,
        });
      } else {
        toast({
          title: "Scratch approved",
          description: `${req.fullName} — Event ${req.eventNumber}. Athlete/entry not found — please scratch manually in the roster.`,
          variant: "destructive",
        });
      }
    } else {
      toast({ title: "Scratch denied", description: `${req.fullName} — Event ${req.eventNumber} scratch was denied.` });
    }

    setScratchRequests((prev) => prev.map((r) => r.id === req.id ? { ...r, status: newStatus } : r));
  }

  function copyUrl() {
    navigator.clipboard.writeText(liveUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const pending = scratchRequests.filter((r) => r.status === "pending");
  const resolved = scratchRequests.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Meet Website & Live Data</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Publish live meet data and manage online scratch declarations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/webgen">
            <Button variant="outline" size="sm">
              <Globe className="h-4 w-4 mr-1.5" />
              Full Web Generator
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Status Card */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  {liveStatus === "live" ? (
                    <><Wifi className="h-4 w-4 text-green-500" /> Live — Athletes Can View</>
                  ) : liveStatus === "error" ? (
                    <><WifiOff className="h-4 w-4 text-destructive" /> Connection Error</>
                  ) : (
                    <><WifiOff className="h-4 w-4 text-muted-foreground" /> Not Yet Published</>
                  )}
                </CardTitle>
                {liveStatus === "live" && (
                  <Badge className="bg-green-600 text-white">LIVE</Badge>
                )}
              </div>
              {lastPushed && (
                <CardDescription>
                  Last pushed: {format(new Date(lastPushed), "h:mm:ss a")}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Input value={liveUrl} readOnly className="font-mono text-xs" />
                <Button size="icon" variant="outline" onClick={copyUrl}>
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="outline" asChild>
                  <a href={meetSiteUrl} target="_blank" rel="noreferrer" title="Open live website">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Custom message to athletes (optional)</label>
                <Textarea
                  rows={2}
                  placeholder="e.g. 'Pool opens at 7:30 AM. Warm-up lanes 1-3 only.'"
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2">
                <Button onClick={pushToLive} disabled={pushing} className="flex-1">
                  {pushing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  {pushing ? "Pushing…" : liveStatus === "live" ? "Push Update" : "Go Live"}
                </Button>
                <Button variant="outline" size="icon" onClick={fetchScratchRequests} disabled={fetching}>
                  <RefreshCw className={`h-4 w-4 ${fetching ? "animate-spin" : ""}`} />
                </Button>
              </div>

              <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                <div className="font-medium text-foreground">What gets published:</div>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Event list with status (seeded/completed)</li>
                  <li>Real-time scratch form for athletes/parents</li>
                  <li>Custom message to attendees</li>
                  <li>Live results (when events are completed)</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Scratch Requests */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Online Scratch Declarations
                  {pending.length > 0 && (
                    <Badge variant="destructive" className="text-[10px] px-1.5">{pending.length} pending</Badge>
                  )}
                </CardTitle>
                <Button size="sm" variant="ghost" onClick={fetchScratchRequests} disabled={fetching}>
                  <RefreshCw className={`h-3.5 w-3.5 ${fetching ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {scratchRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No scratch declarations yet</p>
                  <p className="text-xs mt-1">Requests submitted via the meet website will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pending.length > 0 && (
                    <>
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pending Review</div>
                      {pending.map((req) => (
                        <ScratchCard
                          key={req.id}
                          req={req}
                          rule={getApplicableRule(sessions as Session[], req.eventNumber)}
                          onDecision={handleScratchDecision}
                        />
                      ))}
                    </>
                  )}
                  {resolved.length > 0 && (
                    <>
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-4">Resolved</div>
                      {resolved.map((req) => (
                        <ScratchCard
                          key={req.id}
                          req={req}
                          rule={getApplicableRule(sessions as Session[], req.eventNumber)}
                          onDecision={handleScratchDecision}
                          resolved
                        />
                      ))}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* QR + Info sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><QrCode className="h-4 w-4" /> QR Code</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <QRCodeDisplay url={liveUrl} />
              <p className="text-xs text-center text-muted-foreground mt-3">
                Display this at the venue for athletes to submit scratches
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">USA Swimming Scratch Rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(USA_RULES).filter(([k]) => k !== "default").map(([type, rule]) => (
                <div key={type} className="space-y-1">
                  <div className="text-xs font-semibold text-primary">{type}</div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{rule}</p>
                </div>
              ))}
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-2.5 text-[11px] text-amber-800 dark:text-amber-300">
                <strong>Force Scratch:</strong> Failure to scratch properly may result in a meet suspension per USA Swimming Rule 205.5.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Meet Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Events</span>
                <span className="font-medium">{events.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Seeded</span>
                <span className="font-medium">{events.filter((e) => e.status === "seeded" || e.status === "completed").length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Completed</span>
                <span className="font-medium">{events.filter((e) => e.status === "completed").length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Scratch Requests</span>
                <span className="font-medium">{scratchRequests.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ScratchCard({
  req,
  rule,
  onDecision,
  resolved = false,
}: {
  req: ScratchRequest;
  rule: string;
  onDecision: (req: ScratchRequest, d: "approved" | "denied") => void;
  resolved?: boolean;
}) {
  const [showRule, setShowRule] = useState(false);

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${
      req.status === "approved" ? "border-green-300 bg-green-50/50 dark:bg-green-900/10" :
      req.status === "denied" ? "border-red-200 bg-red-50/50 dark:bg-red-900/10" :
      "border-amber-200 bg-amber-50/50 dark:bg-amber-900/10"
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-semibold text-sm">{req.fullName}</span>
            <Badge variant={req.status === "approved" ? "default" : req.status === "denied" ? "destructive" : "secondary"} className="text-[10px] capitalize">
              {req.status}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Event {req.eventNumber} — {req.eventName || "Unknown Event"}
          </div>
          {req.dob && <div className="text-xs text-muted-foreground">DOB: {req.dob}</div>}
        </div>
        <div className="text-xs text-muted-foreground whitespace-nowrap">
          <Clock className="h-3 w-3 inline mr-1" />
          {format(new Date(req.timestamp), "h:mm a")}
        </div>
      </div>

      {req.reason && (
        <div className="text-xs text-muted-foreground italic bg-background/60 rounded px-2 py-1">
          "{req.reason}"
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          className="text-[10px] text-primary underline"
          onClick={() => setShowRule((v) => !v)}
        >
          <AlertTriangle className="h-3 w-3 inline mr-0.5" />
          {showRule ? "Hide" : "Show"} applicable rule
        </button>
      </div>

      {showRule && (
        <div className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded px-2 py-1.5 leading-relaxed">
          {rule}
        </div>
      )}

      {!resolved && (
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 border-green-400 text-green-700 hover:bg-green-50 dark:text-green-400 dark:border-green-700 h-7 text-xs"
            onClick={() => onDecision(req, "approved")}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            Approve & Scratch
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 border-red-300 text-red-700 hover:bg-red-50 dark:text-red-400 dark:border-red-700 h-7 text-xs"
            onClick={() => onDecision(req, "denied")}
          >
            <XCircle className="h-3.5 w-3.5 mr-1" />
            Deny
          </Button>
        </div>
      )}
    </div>
  );
}
