import { useRoute, Link, Switch, Route } from "wouter";
import { useGetMeet, getGetMeetQueryKey } from "@/lib/local-store";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

import MeetSessions from "./tabs/sessions";
import MeetEvents from "./tabs/events";
import MeetAthletes from "./tabs/athletes";
import MeetSeeding from "./tabs/seeding";
import MeetRun from "./tabs/run";
import MeetRelays from "./tabs/relays";
import MeetTeamScores from "./tabs/team-scores";
import MeetOfficials from "./tabs/officials";
import MeetSchedule from "./tabs/schedule";
import MeetDeclarations from "./tabs/declarations";
import MeetWebsite from "./tabs/website";
import MeetWorkflow from "./tabs/workflow";
import MeetFinals from "./tabs/finals";
import MeetRoster from "./tabs/meet-roster";
import MeetFlyer from "./tabs/flyer";
import MeetSettings from "./tabs/meet-settings";

export default function MeetDetail() {
  const [match, params] = useRoute("/meets/:id/*?");
  const meetId = params?.id ? parseInt(params.id, 10) : undefined;

  const { data: meet, isLoading } = useGetMeet(meetId || 0, {
    query: { enabled: !!meetId, queryKey: getGetMeetQueryKey(meetId || 0) }
  });

  if (!meetId || isNaN(meetId)) return <div className="p-8">Invalid meet ID</div>;
  if (isLoading) return <div className="p-8">Loading meet details...</div>;
  if (!meet) return <div className="p-8">Meet not found</div>;

  const currentTab = params?.["*"] || "";

  const isPrelimFinal = meet.meetType === "prelim_final" ||
    meet.meetStyle === "prelim_final" ||
    meet.meetType?.toLowerCase().includes("prelim") ||
    meet.meetStyle?.toLowerCase().includes("prelim");

  const tabItems = [
    { label: "Sessions", value: "", href: `/meets/${meetId}` },
    { label: "Events", value: "events", href: `/meets/${meetId}/events` },
    { label: "Athletes & Entries", value: "athletes", href: `/meets/${meetId}/athletes` },
    { label: "Meet Roster", value: "roster", href: `/meets/${meetId}/roster` },
    { label: "Relays", value: "relays", href: `/meets/${meetId}/relays` },
    { label: "Seeding", value: "seeding", href: `/meets/${meetId}/seeding` },
    { label: "Run / Results", value: "run", href: `/meets/${meetId}/run` },
    { label: "Declarations", value: "declarations", href: `/meets/${meetId}/declarations` },
    { label: "Schedule", value: "schedule", href: `/meets/${meetId}/schedule` },
    { label: "Officials", value: "officials", href: `/meets/${meetId}/officials` },
    { label: "Team Scores", value: "scores", href: `/meets/${meetId}/scores` },
    { label: "Website & Live", value: "website", href: `/meets/${meetId}/website` },
    { label: "Meet Flyer", value: "flyer", href: `/meets/${meetId}/flyer` },
    { label: "Settings", value: "settings", href: `/meets/${meetId}/settings` },
    ...(isPrelimFinal ? [{ label: "Workflow", value: "workflow", href: `/meets/${meetId}/workflow` }] : []),
    ...(isPrelimFinal ? [{ label: "Finals", value: "finals", href: `/meets/${meetId}/finals` }] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <div className="flex items-center gap-3 justify-between">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold tracking-tight">{meet.name}</h1>
              <Badge variant={meet.status === 'upcoming' ? 'secondary' : meet.status === 'active' ? 'default' : 'outline'}>
                {meet.status?.toUpperCase() || 'UPCOMING'}
              </Badge>
              {isPrelimFinal && (
                <Badge className="bg-cyan-600 text-white">PRELIM / FINAL</Badge>
              )}
            </div>
            <Link href="/timing">
              <Button variant="outline" size="sm">
                <Timer className="h-3.5 w-3.5 mr-1.5" />
                Timing Console
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-4 mt-2 text-muted-foreground flex-wrap">
            <div className="flex items-center text-sm">
              <Calendar className="mr-2 h-4 w-4" />
              {format(new Date(meet.startDate), "MMM d, yyyy")}
              {meet.endDate && ` - ${format(new Date(meet.endDate), "MMM d, yyyy")}`}
            </div>
            <div className="flex items-center text-sm">
              <MapPin className="mr-2 h-4 w-4" />
              {meet.facility ? `${meet.facility}, ${meet.city}` : "TBA"}
            </div>
            <Badge variant="outline">{meet.course}</Badge>
            <Badge variant="outline">{meet.meetType}</Badge>
          </div>
        </div>
      </div>

      <Tabs value={currentTab} className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto h-auto p-1 bg-muted/50 flex-wrap gap-y-1">
          {tabItems.map(t => (
            <Link key={t.value} href={t.href}>
              <TabsTrigger value={t.value} data-state={currentTab === t.value ? "active" : "inactive"}>
                {t.label}
              </TabsTrigger>
            </Link>
          ))}
        </TabsList>
        <div className="mt-6">
          <Switch>
            <Route path={`/meets/${meetId}`}><MeetSessions meetId={meetId} /></Route>
            <Route path={`/meets/${meetId}/events`}><MeetEvents meetId={meetId} /></Route>
            <Route path={`/meets/${meetId}/athletes`}><MeetAthletes meetId={meetId} /></Route>
            <Route path={`/meets/${meetId}/roster`}><MeetRoster meetId={meetId} /></Route>
            <Route path={`/meets/${meetId}/relays`}><MeetRelays meetId={meetId} /></Route>
            <Route path={`/meets/${meetId}/seeding`}><MeetSeeding meetId={meetId} /></Route>
            <Route path={`/meets/${meetId}/run`}><MeetRun meetId={meetId} /></Route>
            <Route path={`/meets/${meetId}/declarations`}><MeetDeclarations meetId={meetId} /></Route>
            <Route path={`/meets/${meetId}/schedule`}><MeetSchedule meetId={meetId} /></Route>
            <Route path={`/meets/${meetId}/officials`}><MeetOfficials meetId={meetId} /></Route>
            <Route path={`/meets/${meetId}/scores`}><MeetTeamScores meetId={meetId} /></Route>
            <Route path={`/meets/${meetId}/website`}><MeetWebsite meetId={meetId} /></Route>
            <Route path={`/meets/${meetId}/flyer`}><MeetFlyer meetId={meetId} /></Route>
            <Route path={`/meets/${meetId}/settings`}><MeetSettings meetId={meetId} /></Route>
            <Route path={`/meets/${meetId}/workflow`}><MeetWorkflow meetId={meetId} /></Route>
            <Route path={`/meets/${meetId}/finals`}><MeetFinals meetId={meetId} /></Route>
          </Switch>
        </div>
      </Tabs>
    </div>
  );
}
