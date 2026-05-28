import { useRoute, Link, Switch, Route } from "wouter";
import { useGetMeet, getGetMeetQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin } from "lucide-react";
import { format } from "date-fns";

import MeetSessions from "./tabs/sessions";
import MeetEvents from "./tabs/events";
import MeetAthletes from "./tabs/athletes";
import MeetSeeding from "./tabs/seeding";
import MeetRun from "./tabs/run";
import MeetRelays from "./tabs/relays";
import MeetTeamScores from "./tabs/team-scores";

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{meet.name}</h1>
            <Badge variant={meet.status === 'upcoming' ? 'secondary' : meet.status === 'active' ? 'default' : 'outline'}>
              {meet.status?.toUpperCase() || 'UPCOMING'}
            </Badge>
          </div>
          <div className="flex items-center gap-4 mt-2 text-muted-foreground">
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
        <TabsList className="w-full justify-start overflow-x-auto h-auto p-1 bg-muted/50">
          <Link href={`/meets/${meetId}`}>
            <TabsTrigger value="" data-state={currentTab === "" ? "active" : "inactive"}>Overview / Sessions</TabsTrigger>
          </Link>
          <Link href={`/meets/${meetId}/events`}>
            <TabsTrigger value="events" data-state={currentTab === "events" ? "active" : "inactive"}>Events</TabsTrigger>
          </Link>
          <Link href={`/meets/${meetId}/athletes`}>
            <TabsTrigger value="athletes" data-state={currentTab === "athletes" ? "active" : "inactive"}>Athletes & Entries</TabsTrigger>
          </Link>
          <Link href={`/meets/${meetId}/relays`}>
            <TabsTrigger value="relays" data-state={currentTab === "relays" ? "active" : "inactive"}>Relays</TabsTrigger>
          </Link>
          <Link href={`/meets/${meetId}/seeding`}>
            <TabsTrigger value="seeding" data-state={currentTab === "seeding" ? "active" : "inactive"}>Seeding</TabsTrigger>
          </Link>
          <Link href={`/meets/${meetId}/run`}>
            <TabsTrigger value="run" data-state={currentTab === "run" ? "active" : "inactive"}>Run / Results</TabsTrigger>
          </Link>
          <Link href={`/meets/${meetId}/scores`}>
            <TabsTrigger value="scores" data-state={currentTab === "scores" ? "active" : "inactive"}>Team Scores</TabsTrigger>
          </Link>
        </TabsList>
        <div className="mt-6">
          <Switch>
            <Route path={`/meets/${meetId}`}><MeetSessions meetId={meetId} /></Route>
            <Route path={`/meets/${meetId}/events`}><MeetEvents meetId={meetId} /></Route>
            <Route path={`/meets/${meetId}/athletes`}><MeetAthletes meetId={meetId} /></Route>
            <Route path={`/meets/${meetId}/relays`}><MeetRelays meetId={meetId} /></Route>
            <Route path={`/meets/${meetId}/seeding`}><MeetSeeding meetId={meetId} /></Route>
            <Route path={`/meets/${meetId}/run`}><MeetRun meetId={meetId} /></Route>
            <Route path={`/meets/${meetId}/scores`}><MeetTeamScores meetId={meetId} /></Route>
          </Switch>
        </div>
      </Tabs>
    </div>
  );
}
