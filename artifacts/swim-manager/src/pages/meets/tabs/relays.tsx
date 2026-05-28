import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MeetRelays({ meetId }: { meetId: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Relay Entry Management</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8 text-muted-foreground">
          Relay team composition and leg assignment interface will load here.
          <br/>
          (Requires selecting a relay event first)
        </div>
      </CardContent>
    </Card>
  );
}
