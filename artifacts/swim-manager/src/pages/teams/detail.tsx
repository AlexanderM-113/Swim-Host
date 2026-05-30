import { useRoute } from "wouter";
import { useGetTeam, getGetTeamQueryKey } from "@/lib/local-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Phone, Mail, User } from "lucide-react";

export default function TeamDetail() {
  const [, params] = useRoute("/teams/:id");
  const teamId = params?.id ? parseInt(params.id, 10) : 0;

  const { data: team, isLoading } = useGetTeam(teamId);

  if (isLoading) return <div className="p-8">Loading team details...</div>;
  if (!team) return <div className="p-8">Team not found</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{team.name}</h1>
        <p className="text-muted-foreground">{team.abbreviation} • LSC: {team.lsc || "N/A"}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Team Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>Coach: {(team as any).coachName || "Not assigned"}</span>
              </div>
            {team.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{team.email}</span>
              </div>
            )}
            {team.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{team.phone}</span>
              </div>
            )}
            {(team.city || team.state) && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{team.city}{team.city && team.state ? ", " : ""}{team.state}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Roster Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-primary">{(team as any).athleteCount || 0}</div>
            <p className="text-muted-foreground mt-2">Registered Athletes</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
