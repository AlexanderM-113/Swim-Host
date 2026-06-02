import { useState } from "react";
import { readStore, writeStore, nextId, useListAthletes } from "@/lib/local-store";
import type { PaymentPlan } from "@/lib/local-store";
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
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, RefreshCw, DollarSign, Calendar, CheckCircle2, PauseCircle, XCircle } from "lucide-react";
import { format, addMonths, addWeeks, addQuarters, addYears } from "date-fns";

const planSchema = z.object({
  athleteId: z.coerce.number().optional(),
  planName: z.string().min(1, "Plan name is required"),
  amount: z.coerce.number().min(0.01, "Amount must be > 0"),
  frequency: z.enum(["weekly", "monthly", "quarterly", "yearly"]),
  startDate: z.string().min(1, "Start date is required"),
  description: z.string().optional(),
});

type PlanForm = z.infer<typeof planSchema>;

function computeNextDue(startDate: string, frequency: string): string {
  const d = new Date(startDate);
  switch (frequency) {
    case "weekly": return addWeeks(d, 1).toISOString().split("T")[0];
    case "quarterly": return addQuarters(d, 1).toISOString().split("T")[0];
    case "yearly": return addYears(d, 1).toISOString().split("T")[0];
    default: return addMonths(d, 1).toISOString().split("T")[0];
  }
}

function usePaymentPlans() {
  return useQuery({
    queryKey: ["paymentPlans"],
    queryFn: () => (readStore() as any).paymentPlans as PaymentPlan[] ?? [],
    staleTime: 0,
  });
}

function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: PlanForm & { athleteName?: string }) => {
      const store = readStore() as any;
      const plans: PaymentPlan[] = store.paymentPlans ?? [];
      const plan: PaymentPlan = {
        id: nextId(plans),
        athleteId: data.athleteId,
        athleteName: data.athleteName,
        planName: data.planName,
        amount: data.amount,
        frequency: data.frequency as PaymentPlan["frequency"],
        startDate: data.startDate,
        nextDueDate: computeNextDue(data.startDate, data.frequency),
        status: "active",
        description: data.description,
        createdAt: new Date().toISOString(),
      };
      writeStore({ ...store, paymentPlans: [...plans, plan] });
      return plan;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["paymentPlans"] }),
  });
}

function useUpdatePlanStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: PaymentPlan["status"] }) => {
      const store = readStore() as any;
      const plans: PaymentPlan[] = (store.paymentPlans ?? []).map((p: PaymentPlan) =>
        p.id === id ? { ...p, status } : p
      );
      writeStore({ ...store, paymentPlans: plans });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["paymentPlans"] }),
  });
}

function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const store = readStore() as any;
      const plans: PaymentPlan[] = (store.paymentPlans ?? []).filter((p: PaymentPlan) => p.id !== id);
      writeStore({ ...store, paymentPlans: plans });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["paymentPlans"] }),
  });
}

function useGenerateInvoices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const store = readStore() as any;
      const plans: PaymentPlan[] = store.paymentPlans ?? [];
      const today = new Date().toISOString().split("T")[0];
      let generated = 0;
      const newInvoices = [...(store.invoices ?? [])];
      const updatedPlans = plans.map((plan) => {
        if (plan.status !== "active") return plan;
        if (plan.nextDueDate > today) return plan;
        newInvoices.push({
          id: nextId(newInvoices),
          athleteId: plan.athleteId,
          athleteName: plan.athleteName,
          amount: plan.amount,
          dueDate: plan.nextDueDate,
          status: "outstanding",
          description: `${plan.planName} — ${plan.frequency} payment`,
          invoiceType: "Monthly Dues",
          createdAt: new Date().toISOString(),
        });
        generated++;
        return { ...plan, nextDueDate: computeNextDue(plan.nextDueDate, plan.frequency) };
      });
      writeStore({ ...store, paymentPlans: updatedPlans, invoices: newInvoices });
      return generated;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["paymentPlans"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["billingSummary"] });
    },
  });
}

const FREQ_LABELS: Record<string, string> = {
  weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly", yearly: "Yearly",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  active: { label: "Active", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", icon: CheckCircle2 },
  paused: { label: "Paused", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", icon: PauseCircle },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", icon: XCircle },
};

export default function PaymentPlans() {
  const { data: plans = [], isLoading } = usePaymentPlans();
  const { data: athletes = [] } = useListAthletes();
  const createPlan = useCreatePlan();
  const updateStatus = useUpdatePlanStatus();
  const deletePlan = useDeletePlan();
  const generateInvoices = useGenerateInvoices();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const form = useForm<PlanForm>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      planName: "Monthly Dues",
      frequency: "monthly",
      startDate: new Date().toISOString().split("T")[0],
      amount: 100,
    },
  });

  function onSubmit(data: PlanForm) {
    const athlete = data.athleteId
      ? (athletes as any[]).find((a: any) => a.id === data.athleteId)
      : undefined;
    createPlan.mutate(
      { ...data, athleteName: athlete ? `${athlete.firstName} ${athlete.lastName}` : undefined },
      {
        onSuccess: () => {
          toast({ title: "Payment plan created" });
          setOpen(false);
          form.reset();
        },
        onError: () => toast({ title: "Failed to create plan", variant: "destructive" }),
      }
    );
  }

  async function handleGenerate() {
    const count = await generateInvoices.mutateAsync();
    toast({
      title: count > 0 ? `Generated ${count} invoice${count !== 1 ? "s" : ""}` : "No invoices due",
      description: count > 0 ? "Invoices created from active payment plans." : "All payment plans are up to date.",
    });
  }

  const active = plans.filter((p) => p.status === "active");
  const totalMonthly = active.reduce((s, p) => {
    const mult = p.frequency === "weekly" ? 4.33 : p.frequency === "quarterly" ? 1 / 3 : p.frequency === "yearly" ? 1 / 12 : 1;
    return s + p.amount * mult;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payment Plans</h1>
          <p className="text-muted-foreground">Manage recurring dues and automatically generate invoices.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleGenerate} disabled={generateInvoices.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${generateInvoices.isPending ? "animate-spin" : ""}`} />
            Generate Due Invoices
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Plan
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{active.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Est. Monthly Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${totalMonthly.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Due Today or Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {active.filter((p) => p.nextDueDate <= new Date().toISOString().split("T")[0]).length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Plan</TableHead>
                <TableHead>Athlete</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Next Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => {
                const cfg = STATUS_CONFIG[plan.status];
                const isOverdue = plan.status === "active" && plan.nextDueDate <= new Date().toISOString().split("T")[0];
                return (
                  <TableRow key={plan.id}>
                    <TableCell className="pl-6 font-medium">{plan.planName}</TableCell>
                    <TableCell className="text-sm">{plan.athleteName ?? "All Athletes"}</TableCell>
                    <TableCell><Badge variant="outline">{FREQ_LABELS[plan.frequency]}</Badge></TableCell>
                    <TableCell className="text-right font-mono font-semibold">${plan.amount.toFixed(2)}</TableCell>
                    <TableCell className={`text-sm ${isOverdue ? "text-destructive font-semibold" : ""}`}>
                      {format(new Date(plan.nextDueDate), "MMM d, yyyy")}
                      {isOverdue && <span className="ml-1 text-xs">(overdue)</span>}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
                        {plan.status}
                      </span>
                    </TableCell>
                    <TableCell className="pr-6">
                      <div className="flex gap-1">
                        {plan.status === "active" && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => updateStatus.mutate({ id: plan.id, status: "paused" })}>
                            Pause
                          </Button>
                        )}
                        {plan.status === "paused" && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-green-700" onClick={() => updateStatus.mutate({ id: plan.id, status: "active" })}>
                            Resume
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 text-destructive hover:text-destructive" onClick={() => deletePlan.mutate(plan.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {plans.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No payment plans yet. Create one to start generating recurring invoices.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Payment Plan</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="planName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Plan Name</FormLabel>
                  <FormControl><Input placeholder="e.g. Monthly Dues, Fall Season" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="amount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount ($)</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="frequency" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frequency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="athleteId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Athlete (optional — leave blank for club-wide)</FormLabel>
                  <Select onValueChange={(v) => field.onChange(v === "all" ? undefined : Number(v))} value={field.value ? String(field.value) : "all"}>
                    <FormControl><SelectTrigger><SelectValue placeholder="All athletes" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="all">All Athletes / Club-wide</SelectItem>
                      {(athletes as any[]).map((a: any) => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.firstName} {a.lastName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="startDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createPlan.isPending}>
                  {createPlan.isPending ? "Creating…" : "Create Plan"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
