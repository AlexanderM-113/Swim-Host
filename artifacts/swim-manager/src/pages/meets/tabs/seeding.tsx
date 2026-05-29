import { useState } from "react";
import { useListEvents, useSeedEvent, getListEventsQueryKey } from "@/lib/local-store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Shuffle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function MeetSeeding({ meetId }: { meetId: number }) {
  const { data: events, isLoading } = useListEvents(meetId, {
    query: { enabled: !!meetId, queryKey: getListEventsQueryKey(meetId) },
  });
  const seedEvent = useSeedEvent();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [seedDialogOpen, setSeedDialogOpen] = useState(false);
  const [pendingEventId, setPendingEventId] = useState<number | null>(null);
  const [pendingEventName, setPendingEventName] = useState<string>("");
  const [lanes, setLanes] = useState("8");
  const [heatOrder, setHeatOrder] = useState("slow_to_fast");
  const [circleSeeding, setCircleSeeding] = useState(true);

  function openSeedDialog(eventId: number, name: string) {
    setPendingEventId(eventId);
    setPendingEventName(name);
    setSeedDialogOpen(true);
  }

  function handleSeed() {
    if (!pendingEventId) return;
    seedEvent.mutate(
      { eventId: pendingEventId, data: { lanes: parseInt(lanes), heatOrder, circleSeeding } },
      {
        onSuccess: () => {
          toast({ title: "Event seeded successfully" });
          setSeedDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: getListEventsQueryKey(meetId) });
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.error ?? err?.message ?? "Seeding failed";
          toast({ title: "Seeding failed", description: msg, variant: "destructive" });
        },
      }
    );
  }

  function handleSeedAll() {
    const pending = events?.filter(
      (e) => e.status !== "seeded" && e.status !== "completed" && (e.entryCount ?? 0) > 0
    );
    if (!pending?.length) {
      toast({ title: "No unseeded events with entries", variant: "destructive" });
      return;
    }
    const todo = [...pending];
    function seedNext() {
      const evt = todo.shift();
      if (!evt) {
        toast({ title: "All events seeded" });
        queryClient.invalidateQueries({ queryKey: getListEventsQueryKey(meetId) });
        return;
      }
      seedEvent.mutate(
        { eventId: evt.id, data: { lanes: parseInt(lanes), heatOrder, circleSeeding } },
        { onSuccess: seedNext, onError: () => seedNext() }
      );
    }
    seedNext();
  }

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Loading events…</div>;

  const seededCount = events?.filter((e) => e.status === "seeded" || e.status === "completed").length ?? 0;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle>Seeding Management</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {seededCount} of {events?.length ?? 0} events seeded
            </p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Lanes</Label>
              <Select value={lanes} onValueChange={setLanes}>
                <SelectTrigger className="w-[65px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Order</Label>
              <Select value={heatOrder} onValueChange={setHeatOrder}>
                <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="slow_to_fast">Slow to Fast</SelectItem>
                  <SelectItem value="fast_to_slow">Fast to Slow</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" variant="outline" onClick={handleSeedAll} disabled={seedEvent.isPending}>
              <Shuffle className="h-3.5 w-3.5 mr-1" /> Seed All
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Event</TableHead>
                <TableHead>Age Group</TableHead>
                <TableHead className="text-center">Entries</TableHead>
                <TableHead className="text-center">Heats</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events?.map((event) => {
                const label = `Event ${event.eventNumber}: ${event.gender === "M" ? "Men" : event.gender === "F" ? "Women" : "Mixed"} ${event.distance} ${event.stroke}`;
                const isSeeded = event.status === "seeded" || event.status === "completed";
                const noEntries = (event.entryCount ?? 0) === 0;
                return (
                  <TableRow key={event.id}>
                    <TableCell className="pl-6 font-medium">{label}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{event.ageGroup || "Open"}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={noEntries ? "outline" : "secondary"}>{event.entryCount ?? 0}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{event.heatCount ?? 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={isSeeded ? "default" : "outline"}
                        className={event.status === "completed" ? "bg-blue-600 text-white" : isSeeded ? "bg-green-600 text-white" : ""}>
                        {event.status === "completed" ? "Completed" : isSeeded ? "Seeded" : "Unseeded"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button size="sm" variant={isSeeded ? "outline" : "default"}
                        onClick={() => openSeedDialog(event.id, label)}
                        disabled={seedEvent.isPending || noEntries}
                        title={noEntries ? "No entries to seed" : ""}>
                        {isSeeded
                          ? <><RefreshCw className="h-3.5 w-3.5 mr-1" />Re-seed</>
                          : <><Shuffle className="h-3.5 w-3.5 mr-1" />Seed</>}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!events || events.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No events found. Add events in the Events tab first.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={seedDialogOpen} onOpenChange={setSeedDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Seed Event</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{pendingEventName}</p>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Number of Lanes</Label>
              <Input type="number" min={4} max={10} value={lanes} onChange={(e) => setLanes(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Heat Order</Label>
              <Select value={heatOrder} onValueChange={setHeatOrder}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="slow_to_fast">Slow to Fast (Championship)</SelectItem>
                  <SelectItem value="fast_to_slow">Fast to Slow</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="circle" checked={circleSeeding} onCheckedChange={(v) => setCircleSeeding(!!v)} />
              <Label htmlFor="circle" className="cursor-pointer">Circle seeding (center-out lane assignment)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSeedDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSeed} disabled={seedEvent.isPending}>
              {seedEvent.isPending ? "Seeding…" : "Seed Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
