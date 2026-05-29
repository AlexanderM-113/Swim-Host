import { useRoute } from "wouter";
import { useGetAthlete, getGetAthleteQueryKey } from "@/lib/local-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Phone, Mail, MapPin } from "lucide-react";

export default function AthleteDetail() {
  const [, params] = useRoute("/athletes/:id");
  const athleteId = params?.id ? parseInt(params.id, 10) : 0;

  const { data: athlete, isLoading } = useGetAthlete(athleteId, {
    query: { enabled: !!athleteId, queryKey: getGetAthleteQueryKey(athleteId) }
  });

  if (isLoading) return <div className="p-8">Loading athlete details...</div>;
  if (!athlete) return <div className="p-8">Athlete not found</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center text-primary border border-primary/20">
          <User className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{athlete.firstName} {athlete.lastName}</h1>
          <p className="text-muted-foreground">{athlete.teamName || "Unattached"} • {athlete.gender} • Age {athlete.age || "-"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {athlete.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{athlete.email}</span>
              </div>
            )}
            {athlete.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{athlete.phone}</span>
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-border">
              <h4 className="font-semibold text-sm mb-2 text-muted-foreground">Parent/Guardian</h4>
              <p>{athlete.parentName || "Not provided"}</p>
              {athlete.parentEmail && <p className="text-sm">{athlete.parentEmail}</p>}
              {athlete.parentPhone && <p className="text-sm">{athlete.parentPhone}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Medical Notes</CardTitle>
          </CardHeader>
          <CardContent>
            {athlete.healthNotes ? (
              <p className="text-sm bg-destructive/10 text-destructive p-3 rounded-md border border-destructive/20">
                {athlete.healthNotes}
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">No health notes provided.</p>
            )}
            
            <div className="mt-6">
              <h4 className="font-semibold text-sm mb-2 text-muted-foreground">Registration Info</h4>
              <p className="font-mono text-sm">ID: {athlete.idNumber || "None"}</p>
              <p className="text-sm text-muted-foreground mt-1">Added: {athlete.createdAt ? new Date(athlete.createdAt).toLocaleDateString() : "-"}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
