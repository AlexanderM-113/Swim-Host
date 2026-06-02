import { useState } from "react";
import { readStore, writeStore, nextId } from "@/lib/local-store";
import type { TimeStandard } from "@/lib/local-store";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { formatTime, parseTime } from "@/lib/format-time";
import { Plus, Trash2, Download, Upload, Trophy, Info } from "lucide-react";

const TIERS = ["B", "BB", "A", "AA", "AAA", "AAAA", "Sectional", "Junior National", "National", "Custom"];
const TIER_COLORS: Record<string, string> = {
  B: "bg-gray-100 text-gray-800",
  BB: "bg-blue-100 text-blue-800",
  A: "bg-green-100 text-green-800",
  AA: "bg-teal-100 text-teal-800",
  AAA: "bg-purple-100 text-purple-800",
  AAAA: "bg-yellow-100 text-yellow-800",
  Sectional: "bg-orange-100 text-orange-800",
  "Junior National": "bg-red-100 text-red-800",
  National: "bg-rose-100 text-rose-800",
};

const STROKES = ["Freestyle", "Backstroke", "Breaststroke", "Butterfly", "Individual Medley"];
const DISTANCES = [25, 50, 100, 200, 400, 500, 800, 1000, 1500, 1650];

const stdSchema = z.object({
  name: z.string().min(1, "Name is required"),
  tier: z.string().min(1),
  course: z.enum(["SCY", "SCM", "LCM"]),
  gender: z.enum(["M", "F", "X"]),
  ageMin: z.coerce.number().min(0).max(99),
  ageMax: z.coerce.number().min(0).max(99),
  distance: z.coerce.number().min(1),
  stroke: z.string().min(1),
  cutTimeStr: z.string().min(1, "Cut time is required"),
});

type StdForm = z.infer<typeof stdSchema>;

function useTimeStandards() {
  return useQuery({
    queryKey: ["timeStandards"],
    queryFn: () => (readStore() as any).timeStandards as TimeStandard[] ?? [],
    staleTime: 0,
  });
}

function useCreateStandard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: StdForm) => {
      const store = readStore() as any;
      const standards: TimeStandard[] = store.timeStandards ?? [];
      const cutTime = parseTime(data.cutTimeStr);
      if (!cutTime) throw new Error("Invalid cut time format");
      const std: TimeStandard = {
        id: nextId(standards),
        name: data.name,
        tier: data.tier,
        course: data.course,
        gender: data.gender,
        ageMin: data.ageMin,
        ageMax: data.ageMax,
        distance: data.distance,
        stroke: data.stroke,
        cutTime,
        createdAt: new Date().toISOString(),
      };
      writeStore({ ...store, timeStandards: [...standards, std] });
      return std;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["timeStandards"] }),
  });
}

function useDeleteStandard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const store = readStore() as any;
      const standards = (store.timeStandards ?? []).filter((s: TimeStandard) => s.id !== id);
      writeStore({ ...store, timeStandards: standards });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["timeStandards"] }),
  });
}

export default function TimeStandardsPage() {
  const { data: standards = [], isLoading } = useTimeStandards();
  const createStd = useCreateStandard();
  const deleteStd = useDeleteStandard();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [filterCourse, setFilterCourse] = useState("SCY");
  const [filterGender, setFilterGender] = useState("M");

  const form = useForm<StdForm>({
    resolver: zodResolver(stdSchema),
    defaultValues: {
      tier: "AA",
      course: "SCY",
      gender: "M",
      ageMin: 15,
      ageMax: 16,
      distance: 100,
      stroke: "Freestyle",
      cutTimeStr: "",
      name: "",
    },
  });

  function onSubmit(data: StdForm) {
    createStd.mutate(data, {
      onSuccess: () => {
        toast({ title: "Time standard added" });
        setOpen(false);
        form.reset();
      },
      onError: (e: any) => toast({ title: e.message ?? "Failed to add standard", variant: "destructive" }),
    });
  }

  function exportCSV() {
    const rows = [
      ["Name", "Tier", "Course", "Gender", "Age Min", "Age Max", "Distance", "Stroke", "Cut Time"],
      ...standards.map((s) => [s.name, s.tier, s.course, s.gender, s.ageMin, s.ageMax, s.distance, s.stroke, formatTime(s.cutTime)]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "time-standards.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = standards.filter((s) =>
    (filterCourse === "all" || s.course === filterCourse) &&
    (filterGender === "all" || s.gender === filterGender)
  );

  const byTier = TIERS.reduce((acc, tier) => {
    const tStds = filtered.filter((s) => s.tier === tier);
    if (tStds.length > 0) acc[tier] = tStds;
    return acc;
  }, {} as Record<string, TimeStandard[]>);

  const otherTiers = filtered.filter((s) => !TIERS.includes(s.tier));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="h-7 w-7 text-primary" />
            Time Standards
          </h1>
          <p className="text-muted-foreground">Manage qualifying and achievement time standards by tier.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV} disabled={standards.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add Standard
          </Button>
        </div>
      </div>

      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
        <CardContent className="flex items-start gap-3 pt-4">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <p className="font-medium">USA Swimming time standard tiers (slowest → fastest):</p>
            <p>B → BB → A → AA → AAA → AAAA → Sectional → Junior National → National</p>
            <p className="text-xs">Add your meet's qualifying cuts, achievement standards, or motivational times here.</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 flex-wrap">
        <Select value={filterCourse} onValueChange={setFilterCourse}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Courses</SelectItem>
            <SelectItem value="SCY">SCY</SelectItem>
            <SelectItem value="SCM">SCM</SelectItem>
            <SelectItem value="LCM">LCM</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterGender} onValueChange={setFilterGender}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Genders</SelectItem>
            <SelectItem value="M">Male</SelectItem>
            <SelectItem value="F">Female</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground flex items-center">
          {filtered.length} standard{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Trophy className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground font-medium">No time standards yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add qualifying cuts or achievement standards to track athlete progress.</p>
            <Button className="mt-4" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Add First Standard
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(byTier).map(([tier, stds]) => (
            <Card key={tier}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Badge className={TIER_COLORS[tier] ?? ""}>{tier}</Badge>
                  <span>{stds.length} standard{stds.length !== 1 ? "s" : ""}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Name</TableHead>
                      <TableHead>Age</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead className="font-mono">Cut Time</TableHead>
                      <TableHead className="pr-6"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stds.sort((a, b) => a.distance - b.distance || a.stroke.localeCompare(b.stroke)).map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="pl-6 font-medium text-sm">{s.name}</TableCell>
                        <TableCell className="text-sm">{s.ageMin === s.ageMax ? s.ageMin : `${s.ageMin}–${s.ageMax}`}</TableCell>
                        <TableCell className="text-sm">{s.distance} {s.stroke} ({s.gender})</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{s.course}</Badge></TableCell>
                        <TableCell className="font-mono font-semibold text-primary">{formatTime(s.cutTime)}</TableCell>
                        <TableCell className="pr-6">
                          <Button size="sm" variant="ghost" className="h-7 text-destructive hover:text-destructive" onClick={() => deleteStd.mutate(s.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
          {otherTiers.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Custom</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableBody>
                    {otherTiers.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="pl-6 font-medium text-sm">{s.name}</TableCell>
                        <TableCell className="text-sm">{s.ageMin}–{s.ageMax}</TableCell>
                        <TableCell className="text-sm">{s.distance} {s.stroke} ({s.gender})</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{s.course}</Badge></TableCell>
                        <TableCell className="font-mono font-semibold text-primary">{formatTime(s.cutTime)}</TableCell>
                        <TableCell className="pr-6">
                          <Button size="sm" variant="ghost" className="h-7 text-destructive hover:text-destructive" onClick={() => deleteStd.mutate(s.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Time Standard</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Standard Name</FormLabel>
                    <FormControl><Input placeholder="e.g. 2024 Junior Nationals Cut" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="tier" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tier</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {TIERS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="course" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Course</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="SCY">SCY — Short Course Yards</SelectItem>
                        <SelectItem value="SCM">SCM — Short Course Meters</SelectItem>
                        <SelectItem value="LCM">LCM — Long Course Meters</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="gender" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="M">Male</SelectItem>
                        <SelectItem value="F">Female</SelectItem>
                        <SelectItem value="X">Mixed</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="ageMin" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Age Min</FormLabel>
                    <FormControl><Input type="number" min={0} max={99} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="ageMax" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Age Max</FormLabel>
                    <FormControl><Input type="number" min={0} max={99} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="distance" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Distance</FormLabel>
                    <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value)}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {DISTANCES.map((d) => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="stroke" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stroke</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {STROKES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="cutTimeStr" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Cut Time (MM:SS.ss or SS.ss)</FormLabel>
                    <FormControl><Input placeholder="e.g. 1:02.45 or 54.32" className="font-mono" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createStd.isPending}>
                  {createStd.isPending ? "Adding…" : "Add Standard"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
