import { useState, useEffect, useRef } from "react";
import { useGetMeet, useListSessions, useListEvents } from "@/lib/local-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Printer, Save, FileText, Upload, X, Plus, Trash2,
  ChevronDown, ChevronUp,
} from "lucide-react";

const STORAGE_KEY = (id: number) => `swimmanager_flyer_${id}`;

const DEFAULT_RULES = `Rules Governing Sanctioned Meets
1. Age on the first day the meet will govern for the entire meet.
2. Conduct of the sanctioned event shall conform in every respect to current rules of USA Swimming including technical and administrative rules.
3. All adults participating in or associated with this meet acknowledge that they are subject to the provisions of the USA Swimming Minor Athlete Abuse Prevention Policy ("MAAPP"), and that they understand that compliance with MAAPP is a condition of participating in the conduct of this competition.
4. Any swimmer entered in the meet must be certified by a USA Swimming member-coach as being proficient in performing a racing start or must start each race from within the water without the use of the backstroke ledge. When unaccompanied by a member-coach, it is the responsibility of the swimmer or the swimmer's legal guardian to ensure compliance with this requirement.
5. The competition course has been certified in accordance with 104.2.2C(4) as to pool length. A copy of such certification is on file with USA Swimming.
6. The minimum water depth, measured in accordance with Article 103.2.3, is 13 feet, at the start end and 4 feet, at the turn end.
7. Deck changes are prohibited.
8. Meet warm-up and safety guidelines will be posted and enforced.
9. No swimmer will be permitted to compete unless the swimmer is a member of USA Swimming. On deck registration is not available.
10. The use of audio or visual recording devices, including a cell phone, is not permitted in changing areas, restrooms, locker rooms, behind the starting blocks, or other areas as may be designated by the Meet Director/Meet Referee.
11. All referees, starters, administrative officials, chief judges, and stroke and turn judges serving in an official capacity in a sanctioned event must be non-athlete members of USA Swimming or members of other FINA member organizations. All meet directors for meets sanctioned by USA Swimming must be members of USA Swimming. Except for coaches accompanying athletes participating under the provisions of 202.9 or USA Swimming's "open border" policy, all persons acting in any coaching capacity in a sanctioned event must be a coach member of USA Swimming.
12. Officials and Meet Marshals must sign in and present proof of current membership and/or training respectively, to the Meet Referee prior to the start of each session of competition.
13. Coaches must sign in and present proof of current membership at the Clerk of Course prior to the start of each session of competition.
14. Meet Marshals shall wear their identifying attire, as provided by the club.
15. Swimmers with disabilities are welcome. The swimmer (or swimmers coach) is responsible for notifying the Referee, prior to the competition, of any disability of the swimmer and the requested accommodation. The swimmer/coach shall provide any assistant(s) or equipment (tappers, deck mats, etc.) if required.
16. Operation of a drone, or any other flying apparatus, is prohibited over the venue (pools, athlete/coach areas, spectator areas and open-ceiling locker rooms) any time athletes, coaches, officials and/or spectators are present.
17. The following medical supervision will be available to athletes participating in the meet: Lifeguards and AED device and basic first aid supplies.`;

interface EntryFeeItem {
  label: string;
  amount: string;
  note?: string;
}

interface FlyerData {
  logoDataUrl: string;
  sanctionedBy: string;
  sanctionNumber: string;
  liability: string;
  hostedBy: string;
  directorName: string;
  directorContact: string;
  refereeName: string;
  refereeContact: string;
  locationName: string;
  locationAddress: string;
  courseDescription: string;
  eligibility: string;
  governingRules: string;
  meetRules: string;
  distanceEvents: string;
  positiveCheckIn: string;
  scratchRules: string;
  awards: string;
  entriesText: string;
  entryFees: EntryFeeItem[];
  concessions: string;
  officials: string;
  additionalNotes: string;
}

const DEFAULT_FLYER: FlyerData = {
  logoDataUrl: "",
  sanctionedBy: "USA Swimming",
  sanctionNumber: "",
  liability: "In granting this sanction, it is understood and agreed that USA Swimming, Inc., and all meet officials shall be held harmless from any and all liabilities or claims for damages by reason of injuries to anyone during the conduct of this meet, which includes all warm-up sessions.",
  hostedBy: "",
  directorName: "",
  directorContact: "",
  refereeName: "",
  refereeContact: "",
  locationName: "",
  locationAddress: "",
  courseDescription: "",
  eligibility: "Open to any USA Swimming registered athlete who is registered as of the first day of competition or foreign athletes formally invited by USA Swimming.",
  governingRules: DEFAULT_RULES,
  meetRules: "",
  distanceEvents: "",
  positiveCheckIn: "There is no penalty for athletes who do not check in for a timed final positive check-in event; they will simply be scratched from the event and may not compete. Failure to compete (no show) in a positive check-in event for which the athlete has checked in will result in being barred from the next individual event in which the athlete is entered.",
  scratchRules: "The USA Swimming Age Group Scratch Rule will be in effect. Any athlete qualifying for a consolation final or championship final competition in an individual event who fails to compete (no show) in a final race shall be barred from the rest of that session's events, and disqualified from their next individual event in the competition.",
  awards: "",
  entriesText: "1. All events will be pre-seeded.\n2. Deck entries will not be accepted.\n3. Entries should be submitted in LCM or SCY times. No converted times may be used; an NT will be accepted.\n4. Entries should be submitted by Hy-tek compatible file.",
  entryFees: [
    { label: "USA Swimming Surcharge", amount: "$10.00" },
    { label: "Individual Events", amount: "$8.50" },
  ],
  concessions: "A concession stand will be available.",
  officials: "Please contact the Meet Referee to indicate availability. Attire will be communicated by the Meet Referee.",
  additionalNotes: "",
};

function fmtGender(g: string) {
  if (g === "M") return "Boys";
  if (g === "F") return "Girls";
  return "Mixed";
}

function fmtTime(t: string | undefined) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "pm" : "am";
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${m} ${ampm}`;
}

// ─── Section wrapper for the form ────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
      >
        <span className="font-semibold text-sm">{title}</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="p-4 space-y-4">{children}</div>}
    </div>
  );
}

// ─── Print Preview ─────────────────────────────────────────────────────────
function FlyerPreview({
  data,
  meet,
  sessions,
  events,
}: {
  data: FlyerData;
  meet: any;
  sessions: any[];
  events: any[];
}) {
  const sortedSessions = [...sessions].sort((a, b) => (a.sessionNumber ?? 0) - (b.sessionNumber ?? 0));

  const meetDateRange = (() => {
    if (!meet?.startDate) return "";
    const start = format(new Date(meet.startDate + "T00:00:00"), "MMMM d");
    if (meet.endDate && meet.endDate !== meet.startDate) {
      const end = format(new Date(meet.endDate + "T00:00:00"), "d, yyyy");
      return `${start}–${end}`;
    }
    return format(new Date(meet.startDate + "T00:00:00"), "MMMM d, yyyy");
  })();

  return (
    <div className="flyer-preview bg-white text-black font-serif text-sm leading-relaxed max-w-[800px] mx-auto p-10 print:p-6 print:max-w-full">
      {/* Header */}
      <div className="text-center mb-6">
        {data.logoDataUrl && (
          <img src={data.logoDataUrl} alt="Logo" className="h-20 mx-auto mb-3 object-contain" />
        )}
        <h1 className="text-2xl font-bold tracking-wide">{meet?.name || "Meet Name"}</h1>
        <p className="text-base mt-1">{meetDateRange}</p>
        <p className="text-sm mt-2 italic">Held under the sanction of {data.sanctionedBy || "USA Swimming"}</p>
      </div>

      {/* Sanction / Liability row */}
      <div className="grid grid-cols-2 gap-x-8 mb-4 text-xs">
        <div>
          <span className="font-bold">Sanctioned by: </span>
          <span>{data.sanctionedBy}</span>
          {data.sanctionNumber && (
            <>
              <span className="mx-4 font-bold">Sanction Number: </span>
              <span>{data.sanctionNumber}</span>
            </>
          )}
        </div>
      </div>

      {data.liability && (
        <div className="mb-4 text-xs">
          <span className="font-bold">Liability: </span>
          <span>{data.liability}</span>
        </div>
      )}

      {data.hostedBy && (
        <div className="mb-1 text-xs">
          <span className="font-bold">Hosted by: </span>
          <span>{data.hostedBy}</span>
        </div>
      )}

      {(data.directorName || data.directorContact) && (
        <div className="mb-1 text-xs">
          <span className="font-bold">Meet Director: </span>
          <span>{data.directorName}</span>
          {data.directorContact && <span className="ml-6">{data.directorContact}</span>}
        </div>
      )}

      {(data.refereeName || data.refereeContact) && (
        <div className="mb-1 text-xs">
          <span className="font-bold">Meet Referee: </span>
          <span>{data.refereeName}</span>
          {data.refereeContact && <span className="ml-6">{data.refereeContact}</span>}
        </div>
      )}

      {(data.locationName || data.locationAddress || meet?.facility) && (
        <div className="mb-4 text-xs">
          <span className="font-bold">Meet Location: </span>
          <span>
            {data.locationName || meet?.facility}
            {data.locationAddress && <><br /><span className="ml-20">{data.locationAddress}</span></>}
          </span>
        </div>
      )}

      {(data.courseDescription || meet?.course) && (
        <div className="mb-4 text-xs">
          <span className="font-bold">Course: </span>
          <span>{data.courseDescription || meet?.course}</span>
        </div>
      )}

      {data.eligibility && (
        <div className="mb-4 text-xs">
          <span className="font-bold">Eligibility: </span>
          <span>{data.eligibility}</span>
        </div>
      )}

      <Separator className="my-4 bg-black/30" />

      {/* Governing Rules */}
      {data.governingRules && (
        <div className="mb-5">
          <div className="whitespace-pre-line text-xs leading-5">{data.governingRules}</div>
        </div>
      )}

      <Separator className="my-4 bg-black/30" />

      {/* Meet Rules */}
      {data.meetRules && (
        <div className="mb-4">
          <p className="font-bold text-sm mb-1">Meet Rules:</p>
          <div className="whitespace-pre-line text-xs leading-5">{data.meetRules}</div>
        </div>
      )}

      {/* Distance Events */}
      {data.distanceEvents && (
        <div className="mb-4 text-xs">
          <p className="font-bold mb-1">Distance Events:</p>
          <div className="whitespace-pre-line leading-5">{data.distanceEvents}</div>
        </div>
      )}

      {/* Positive Check-in */}
      {data.positiveCheckIn && (
        <div className="mb-4 text-xs">
          <p className="font-bold mb-1">Positive Check-in Events:</p>
          <div className="whitespace-pre-line leading-5">{data.positiveCheckIn}</div>
        </div>
      )}

      {/* Scratch Rules */}
      {data.scratchRules && (
        <div className="mb-4 text-xs">
          <p className="font-bold mb-1">Scratch Rules:</p>
          <div className="whitespace-pre-line leading-5">{data.scratchRules}</div>
        </div>
      )}

      <Separator className="my-4 bg-black/30" />

      {/* Sessions */}
      {sortedSessions.length > 0 && (
        <div className="mb-4">
          <p className="font-bold text-sm mb-2">Sessions:</p>
          <div className="space-y-1 text-xs">
            {sortedSessions.map((s) => (
              <div key={s.id} className="flex items-baseline gap-6">
                <span className="font-semibold w-28 shrink-0">Session {s.sessionNumber}:</span>
                {s.date && <span className="w-32 shrink-0">{format(new Date(s.date + "T00:00:00"), "EEEE, MMM d")}</span>}
                {s.warmupTime && <span>Warm-up {fmtTime(s.warmupTime)}</span>}
                {s.startTime && <span>Start {fmtTime(s.startTime)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Awards */}
      {data.awards && (
        <div className="mb-4 text-xs">
          <span className="font-bold">Awards: </span>
          <span className="whitespace-pre-line">{data.awards}</span>
        </div>
      )}

      {/* Entries */}
      {data.entriesText && (
        <div className="mb-4">
          <p className="font-bold text-sm mb-1">Entries:</p>
          <div className="whitespace-pre-line text-xs leading-5">{data.entriesText}</div>
        </div>
      )}

      {/* Entry Fees */}
      {data.entryFees.length > 0 && (
        <div className="mb-4">
          <p className="font-bold text-sm mb-1">Entry Fees:</p>
          <div className="space-y-0.5 text-xs ml-4">
            {data.entryFees.map((f, i) => (
              <div key={i} className="flex gap-8">
                <span className="w-56 shrink-0">{f.label}</span>
                <span className="font-mono">{f.amount}</span>
                {f.note && <span className="text-muted-foreground italic">{f.note}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Concessions */}
      {data.concessions && (
        <div className="mb-4 text-xs">
          <span className="font-bold">Concessions: </span>
          <span>{data.concessions}</span>
        </div>
      )}

      {/* Officials */}
      {data.officials && (
        <div className="mb-4 text-xs">
          <span className="font-bold">Officials: </span>
          <span className="whitespace-pre-line">{data.officials}</span>
        </div>
      )}

      {/* Additional Notes */}
      {data.additionalNotes && (
        <div className="mb-4 text-xs whitespace-pre-line">{data.additionalNotes}</div>
      )}

      {/* Order of Events */}
      {sortedSessions.length > 0 && (
        <>
          <Separator className="my-4 bg-black/30" />
          <div>
            <p className="font-bold text-center text-sm mb-4 uppercase tracking-widest">Order of Events</p>
            {sortedSessions.map((session) => {
              const sessionEvents = events
                .filter((e) => (e as any).sessionId === session.id)
                .sort((a, b) => a.eventNumber - b.eventNumber);

              if (sessionEvents.length === 0) return null;

              const girlsEvents = sessionEvents.filter((e) => e.gender === "F");
              const boysEvents = sessionEvents.filter((e) => e.gender === "M");
              const mixedEvents = sessionEvents.filter((e) => e.gender !== "F" && e.gender !== "M");

              const isPaired = girlsEvents.length > 0 && boysEvents.length > 0;

              return (
                <div key={session.id} className="mb-6">
                  <div className="text-center mb-2">
                    <p className="font-bold text-xs uppercase">
                      Session {session.sessionNumber}: {session.name}
                      {session.sessionType && ` — ${session.sessionType}`}
                    </p>
                    <div className="text-xs text-gray-600">
                      {session.date && format(new Date(session.date + "T00:00:00"), "EEEE, MMMM d")}
                      {session.warmupTime && ` · Warm-up ${fmtTime(session.warmupTime)}`}
                      {session.startTime && ` · Start ${fmtTime(session.startTime)}`}
                    </div>
                  </div>

                  {isPaired ? (
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-black">
                          <th className="text-center py-1 w-16">Girls</th>
                          <th className="text-center py-1">Events</th>
                          <th className="text-center py-1 w-16">Boys</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: Math.max(girlsEvents.length, boysEvents.length) }).map((_, i) => {
                          const g = girlsEvents[i];
                          const b = boysEvents[i];
                          const eventLabel = g
                            ? `${g.ageGroup || "Open"} ${g.distance} ${g.stroke}`
                            : b
                            ? `${b.ageGroup || "Open"} ${b.distance} ${b.stroke}`
                            : "";
                          return (
                            <tr key={i} className="border-b border-gray-200">
                              <td className="text-center py-0.5 font-mono">{g?.eventNumber ?? ""}</td>
                              <td className="text-center py-0.5">{eventLabel}</td>
                              <td className="text-center py-0.5 font-mono">{b?.eventNumber ?? ""}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-black">
                          <th className="text-center py-1 w-16">#</th>
                          <th className="text-left py-1">Event</th>
                          <th className="text-center py-1 w-20">Gender</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessionEvents.map((ev) => (
                          <tr key={ev.id} className="border-b border-gray-200">
                            <td className="text-center py-0.5 font-mono">{ev.eventNumber}</td>
                            <td className="py-0.5">{ev.ageGroup || "Open"} {ev.distance} {ev.stroke}</td>
                            <td className="text-center py-0.5">{fmtGender(ev.gender)}</td>
                          </tr>
                        ))}
                        {mixedEvents.map((ev) => (
                          <tr key={ev.id} className="border-b border-gray-200">
                            <td className="text-center py-0.5 font-mono">{ev.eventNumber}</td>
                            <td className="py-0.5">{ev.ageGroup || "Open"} {ev.distance} {ev.stroke}</td>
                            <td className="text-center py-0.5">Mixed</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function MeetFlyer({ meetId }: { meetId: number }) {
  const { data: meet } = useGetMeet(meetId, {});
  const { data: sessions = [] } = useListSessions(meetId);
  const { data: events = [] } = useListEvents(meetId);
  const { toast } = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState("edit");

  const [data, setData] = useState<FlyerData>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY(meetId));
      if (raw) return { ...DEFAULT_FLYER, ...JSON.parse(raw) };
    } catch {}
    return { ...DEFAULT_FLYER };
  });

  // Pre-fill location from meet data if empty
  useEffect(() => {
    if (!meet) return;
    setData((prev) => ({
      ...prev,
      locationName: prev.locationName || meet.facility || "",
      locationAddress: prev.locationAddress || [meet.address, meet.city, meet.state].filter(Boolean).join(", ") || "",
      hostedBy: prev.hostedBy || meet.notes?.match(/hosted by[:\s]+(.+)/i)?.[1] || "",
    }));
  }, [meet?.id]);

  function set<K extends keyof FlyerData>(key: K, value: FlyerData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    localStorage.setItem(STORAGE_KEY(meetId), JSON.stringify(data));
    toast({ title: "Flyer saved", description: "All flyer data saved to this device." });
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set("logoDataUrl", reader.result as string);
    reader.readAsDataURL(file);
  }

  function addFeeRow() {
    set("entryFees", [...data.entryFees, { label: "", amount: "" }]);
  }

  function updateFee(i: number, field: keyof EntryFeeItem, value: string) {
    set("entryFees", data.entryFees.map((f, idx) => idx === i ? { ...f, [field]: value } : f));
  }

  function removeFee(i: number) {
    set("entryFees", data.entryFees.filter((_, idx) => idx !== i));
  }

  function handlePrint() {
    save();
    setTab("preview");
    setTimeout(() => window.print(), 400);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Meet Flyer</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pre-meet announcement document — Sessions &amp; Order of Events auto-populate from your meet data.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={save}>
            <Save className="h-4 w-4 mr-1.5" />
            Save
          </Button>
          <Button size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1.5" />
            Print / Export
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="edit"><FileText className="h-4 w-4 mr-1.5" />Edit Flyer</TabsTrigger>
          <TabsTrigger value="preview"><Printer className="h-4 w-4 mr-1.5" />Print Preview</TabsTrigger>
        </TabsList>

        {/* ── EDIT PANEL ─────────────────────────────────────────── */}
        <TabsContent value="edit" className="mt-4 space-y-3">

          {/* Header */}
          <Section title="Header — Logo & Sanction">
            <div className="flex items-start gap-4">
              <div className="space-y-2">
                <Label>Club Logo</Label>
                <div className="flex items-center gap-3">
                  {data.logoDataUrl ? (
                    <div className="relative">
                      <img src={data.logoDataUrl} alt="Logo" className="h-20 w-20 object-contain rounded-lg border" />
                      <button
                        onClick={() => set("logoDataUrl", "")}
                        className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive text-white h-5 w-5 flex items-center justify-center"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="h-20 w-20 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    >
                      <Upload className="h-6 w-6 mb-1" />
                      <span className="text-[10px]">Upload</span>
                    </button>
                  )}
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  <div className="space-y-1.5 flex-1">
                    <Label>Sanctioned By</Label>
                    <Input value={data.sanctionedBy} onChange={(e) => set("sanctionedBy", e.target.value)} placeholder="e.g. Pacific Swimming, Inc." />
                  </div>
                </div>
              </div>
              <div className="flex-1 space-y-1.5">
                <Label>Sanction Number</Label>
                <Input value={data.sanctionNumber} onChange={(e) => set("sanctionNumber", e.target.value)} placeholder="AZ26-71R" />
              </div>
            </div>
          </Section>

          {/* Liability */}
          <Section title="Liability">
            <div className="space-y-1.5">
              <Textarea
                rows={3}
                value={data.liability}
                onChange={(e) => set("liability", e.target.value)}
                placeholder="Liability statement…"
              />
            </div>
          </Section>

          {/* Hosted By / Director / Referee */}
          <Section title="Host, Director & Referee">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Hosted By</Label>
                <Input value={data.hostedBy} onChange={(e) => set("hostedBy", e.target.value)} placeholder="Your club name" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Meet Director Name</Label>
                <Input value={data.directorName} onChange={(e) => set("directorName", e.target.value)} placeholder="Jane Smith" />
              </div>
              <div className="space-y-1.5">
                <Label>Director Contact (email / phone)</Label>
                <Input value={data.directorContact} onChange={(e) => set("directorContact", e.target.value)} placeholder="director@club.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Meet Referee Name</Label>
                <Input value={data.refereeName} onChange={(e) => set("refereeName", e.target.value)} placeholder="John Doe" />
              </div>
              <div className="space-y-1.5">
                <Label>Referee Contact (email / phone)</Label>
                <Input value={data.refereeContact} onChange={(e) => set("refereeContact", e.target.value)} placeholder="referee@club.com" />
              </div>
            </div>
          </Section>

          {/* Location & Course */}
          <Section title="Location & Course">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Venue Name</Label>
                <Input value={data.locationName} onChange={(e) => set("locationName", e.target.value)} placeholder="Southwest Valley Family YMCA" />
              </div>
              <div className="space-y-1.5">
                <Label>Address</Label>
                <Input value={data.locationAddress} onChange={(e) => set("locationAddress", e.target.value)} placeholder="123 Pool Ln, City, AZ 85000" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Course Description</Label>
              <Textarea
                rows={2}
                value={data.courseDescription}
                onChange={(e) => set("courseDescription", e.target.value)}
                placeholder="One 8-lane outdoor 50-meter pool with non-turbulent lane dividers…"
              />
            </div>
          </Section>

          {/* Eligibility */}
          <Section title="Eligibility">
            <Textarea
              rows={2}
              value={data.eligibility}
              onChange={(e) => set("eligibility", e.target.value)}
            />
          </Section>

          {/* Governing Rules */}
          <Section title="Rules Governing Sanctioned Meets">
            <p className="text-xs text-muted-foreground">Pre-filled with standard USA Swimming rules. Edit as needed for your LSC.</p>
            <Textarea
              rows={12}
              className="font-mono text-xs"
              value={data.governingRules}
              onChange={(e) => set("governingRules", e.target.value)}
            />
          </Section>

          {/* Meet Rules */}
          <Section title="Meet Rules">
            <Textarea
              rows={8}
              placeholder={"1. This is a Prelim/Final meet…\n2. Swimmers may enter with a LCM or SCY entry time…"}
              value={data.meetRules}
              onChange={(e) => set("meetRules", e.target.value)}
            />
          </Section>

          {/* Distance Events */}
          <Section title="Distance Events">
            <Textarea
              rows={4}
              placeholder="Describe any distance events, positive check-in requirements, heat order…"
              value={data.distanceEvents}
              onChange={(e) => set("distanceEvents", e.target.value)}
            />
          </Section>

          {/* Positive Check-in */}
          <Section title="Positive Check-in Events">
            <Textarea
              rows={4}
              value={data.positiveCheckIn}
              onChange={(e) => set("positiveCheckIn", e.target.value)}
            />
          </Section>

          {/* Scratch Rules */}
          <Section title="Scratch Rules">
            <Textarea
              rows={4}
              value={data.scratchRules}
              onChange={(e) => set("scratchRules", e.target.value)}
            />
          </Section>

          {/* Sessions — read-only notice */}
          <Section title="Sessions">
            <div className="rounded-md bg-muted/40 border px-3 py-2 text-sm text-muted-foreground flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5 shrink-0 text-[10px]">Auto</Badge>
              Sessions are pulled automatically from your Sessions tab. Add or edit sessions there and they will appear here in the preview.
            </div>
            {sessions.length === 0 && (
              <p className="text-xs text-amber-500">No sessions found. Add sessions in the Sessions tab first.</p>
            )}
            {[...sessions].sort((a, b) => (a.sessionNumber ?? 0) - (b.sessionNumber ?? 0)).map((s) => (
              <div key={s.id} className="flex items-center gap-3 text-sm border rounded-md px-3 py-2 bg-card">
                <span className="font-bold w-6 text-primary">{s.sessionNumber}</span>
                <span className="font-medium">{s.name}</span>
                {s.date && <span className="text-muted-foreground text-xs">{format(new Date(s.date + "T00:00:00"), "EEE MMM d")}</span>}
                {s.warmupTime && <span className="text-xs text-muted-foreground">Warm-up {fmtTime(s.warmupTime)}</span>}
                {s.startTime && <span className="text-xs text-muted-foreground">Start {fmtTime(s.startTime)}</span>}
              </div>
            ))}
          </Section>

          {/* Awards */}
          <Section title="Awards">
            <Textarea
              rows={3}
              placeholder="Ribbons for 1st–8th place for 10&under, 11-12, 13-14…"
              value={data.awards}
              onChange={(e) => set("awards", e.target.value)}
            />
          </Section>

          {/* Entries */}
          <Section title="Entries">
            <Textarea
              rows={5}
              value={data.entriesText}
              onChange={(e) => set("entriesText", e.target.value)}
            />
          </Section>

          {/* Entry Fees */}
          <Section title="Entry Fees">
            <div className="space-y-2">
              {data.entryFees.map((fee, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    className="flex-1"
                    placeholder="Fee description"
                    value={fee.label}
                    onChange={(e) => updateFee(i, "label", e.target.value)}
                  />
                  <Input
                    className="w-28"
                    placeholder="$0.00"
                    value={fee.amount}
                    onChange={(e) => updateFee(i, "amount", e.target.value)}
                  />
                  <Input
                    className="flex-1"
                    placeholder="Note (optional)"
                    value={fee.note ?? ""}
                    onChange={(e) => updateFee(i, "note", e.target.value)}
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeFee(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addFeeRow}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Fee
              </Button>
            </div>
          </Section>

          {/* Concessions */}
          <Section title="Concessions">
            <Textarea
              rows={2}
              value={data.concessions}
              onChange={(e) => set("concessions", e.target.value)}
            />
          </Section>

          {/* Officials */}
          <Section title="Officials">
            <Textarea
              rows={3}
              value={data.officials}
              onChange={(e) => set("officials", e.target.value)}
            />
          </Section>

          {/* Order of Events — read-only notice */}
          <Section title="Order of Events">
            <div className="rounded-md bg-muted/40 border px-3 py-2 text-sm text-muted-foreground flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5 shrink-0 text-[10px]">Auto</Badge>
              The full event grid is auto-generated from your events data. Girls/Boys events are automatically paired into a two-column table per session. Manage events in the Events tab.
            </div>
            {events.length === 0 && (
              <p className="text-xs text-amber-500">No events found. Add events and assign them to sessions first.</p>
            )}
          </Section>

          {/* Additional Notes */}
          <Section title="Additional Notes / Footer">
            <Textarea
              rows={3}
              placeholder="Any additional information to include at the bottom of the flyer…"
              value={data.additionalNotes}
              onChange={(e) => set("additionalNotes", e.target.value)}
            />
          </Section>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={save}>
              <Save className="h-4 w-4 mr-1.5" />
              Save Flyer
            </Button>
            <Button onClick={() => { save(); setTab("preview"); }}>
              Preview Flyer →
            </Button>
          </div>
        </TabsContent>

        {/* ── PREVIEW PANEL ──────────────────────────────────────── */}
        <TabsContent value="preview" className="mt-4">
          <div className="flex items-center justify-between mb-4 print:hidden">
            <p className="text-sm text-muted-foreground">
              Use your browser's print dialog (<kbd className="bg-muted px-1 py-0.5 rounded text-xs font-mono">Ctrl+P</kbd> / <kbd className="bg-muted px-1 py-0.5 rounded text-xs font-mono">⌘P</kbd>) to save as PDF or print. For best results use <strong>Letter</strong> paper in portrait orientation.
            </p>
            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1.5" />
              Print / Save PDF
            </Button>
          </div>

          <div className="border rounded-xl shadow-sm overflow-hidden print:border-0 print:shadow-none print:rounded-none">
            <FlyerPreview data={data} meet={meet} sessions={sessions} events={events} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Print styles injected globally */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          .flyer-preview { display: block !important; }
          #root > * { display: none !important; }
          .flyer-preview * { color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
