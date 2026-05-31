import { useState, useMemo } from "react";
import { useListInvoices, useListMeets, useListAthletes, useListTeams, useGetBillingSummary } from "@/lib/local-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DollarSign, TrendingUp, TrendingDown, Users, Trophy, Target,
  BarChart3, PieChart, Calendar, Download, AlertCircle, CheckCircle,
} from "lucide-react";
import { format } from "date-fns";

interface MetricCard {
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "neutral";
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

function MetCard({ label, value, sub, trend, icon: Icon, color }: MetricCard) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{label}</p>
            <p className={`text-3xl font-black mt-1 ${color}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg bg-muted`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
        </div>
        {trend && (
          <div className={`mt-3 flex items-center gap-1 text-xs font-medium ${trend === "up" ? "text-green-600" : trend === "down" ? "text-red-500" : "text-muted-foreground"}`}>
            {trend === "up" ? <TrendingUp className="h-3 w-3" /> : trend === "down" ? <TrendingDown className="h-3 w-3" /> : null}
            {trend === "up" ? "Positive" : trend === "down" ? "Needs attention" : "On track"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SimpleBar({ label, value, max, color = "bg-primary" }: { label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground truncate max-w-[140px]">{label}</span>
        <span className="font-mono font-semibold">${value.toFixed(0)}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function FinancialIntelligence() {
  const { data: invoices = [] } = useListInvoices();
  const { data: meets = [] } = useListMeets();
  const { data: athletes = [] } = useListAthletes();
  const { data: teams = [] } = useListTeams();
  const { data: summary } = useGetBillingSummary();

  const [selectedMeet, setSelectedMeet] = useState<string>("all");
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [budgetInput, setBudgetInput] = useState<string>("");

  const filtered = useMemo(() => {
    return (invoices as any[]).filter((inv) => {
      if (selectedTeam !== "all" && String(inv.teamId) !== selectedTeam) return false;
      return true;
    });
  }, [invoices, selectedTeam]);

  const totalRevenue = (summary as any)?.total ?? filtered.reduce((s: number, i: any) => s + (i.amount || 0), 0);
  const outstanding = (summary as any)?.outstanding ?? filtered.filter((i: any) => i.status === "unpaid").reduce((s: number, i: any) => s + (i.amount || 0), 0);
  const collected = (summary as any)?.paid ?? filtered.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + (i.amount || 0), 0);
  const overdueCount = (summary as any)?.overdueCount ?? 0;
  const budget = parseFloat(budgetInput) || 0;
  const costPerAthlete = athletes.length > 0 ? totalRevenue / athletes.length : 0;
  const collectionRate = totalRevenue > 0 ? (collected / totalRevenue) * 100 : 0;

  const byType = useMemo(() => {
    const map: Record<string, number> = {};
    (filtered as any[]).forEach((inv) => {
      const type = inv.invoiceType || inv.type || "Other";
      map[type] = (map[type] ?? 0) + (inv.amount || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const byTeam = useMemo(() => {
    const map: Record<string, number> = {};
    (filtered as any[]).forEach((inv) => {
      const team = inv.teamName || `Team ${inv.teamId}` || "Unassigned";
      map[team] = (map[team] ?? 0) + (inv.amount || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [filtered]);

  const maxByTeam = byTeam.length > 0 ? byTeam[0][1] : 1;
  const maxByType = byType.length > 0 ? byType[0][1] : 1;

  const recentInvoices = [...(filtered as any[])].sort((a, b) =>
    new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
  ).slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-primary" />
            Financial Intelligence
          </h1>
          <p className="text-muted-foreground mt-1">Revenue analysis, billing health, and cost tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedTeam} onValueChange={setSelectedTeam}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {(teams as any[]).map((t: any) => (
                <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetCard
          label="Total Revenue"
          value={`$${totalRevenue.toFixed(0)}`}
          sub={`${(filtered as any[]).length} invoices`}
          icon={DollarSign}
          color="text-green-600"
          trend="up"
        />
        <MetCard
          label="Outstanding"
          value={`$${outstanding.toFixed(0)}`}
          sub={`${overdueCount} overdue`}
          icon={AlertCircle}
          color={outstanding > 0 ? "text-amber-500" : "text-green-600"}
          trend={outstanding > 0 ? "down" : "neutral"}
        />
        <MetCard
          label="Collection Rate"
          value={`${collectionRate.toFixed(1)}%`}
          sub={`$${collected.toFixed(0)} collected`}
          icon={CheckCircle}
          color={collectionRate >= 80 ? "text-green-600" : "text-amber-500"}
          trend={collectionRate >= 80 ? "up" : "down"}
        />
        <MetCard
          label="Cost per Athlete"
          value={`$${costPerAthlete.toFixed(0)}`}
          sub={`${athletes.length} athletes`}
          icon={Users}
          color="text-primary"
          trend="neutral"
        />
      </div>

      {/* Budget Tracker */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Budget vs. Revenue
          </CardTitle>
          <CardDescription>Set a target budget to track against actual revenue</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-1">
              <label className="text-sm font-medium">Season Budget Target ($)</label>
              <Input
                type="number"
                placeholder="e.g. 25000"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
              />
            </div>
            {budget > 0 && (
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Progress</div>
                <div className="text-2xl font-black text-primary">
                  {Math.min(100, ((totalRevenue / budget) * 100)).toFixed(0)}%
                </div>
              </div>
            )}
          </div>
          {budget > 0 && (
            <div className="space-y-2">
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${totalRevenue >= budget ? "bg-green-500" : "bg-primary"}`}
                  style={{ width: `${Math.min(100, (totalRevenue / budget) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>$0</span>
                <span className={totalRevenue >= budget ? "text-green-600 font-semibold" : ""}>
                  ${totalRevenue.toFixed(0)} / ${budget.toFixed(0)}
                </span>
              </div>
              {totalRevenue < budget && (
                <div className="text-sm text-amber-700 dark:text-amber-400">
                  ${(budget - totalRevenue).toFixed(0)} remaining to reach budget target
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Type */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Revenue by Invoice Type
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {byType.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No billing data yet</p>
            ) : (
              byType.slice(0, 6).map(([type, amt]) => (
                <SimpleBar key={type} label={type} value={amt} max={maxByType} color="bg-primary" />
              ))
            )}
          </CardContent>
        </Card>

        {/* Revenue by Team */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Revenue by Team
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {byTeam.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No team billing data yet</p>
            ) : (
              byTeam.map(([team, amt], i) => (
                <SimpleBar
                  key={team}
                  label={team}
                  value={amt}
                  max={maxByTeam}
                  color={i === 0 ? "bg-primary" : i === 1 ? "bg-indigo-400" : "bg-cyan-400"}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Meet Profitability */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Meet Profitability Tracker
          </CardTitle>
          <CardDescription>
            Track revenue and expenses per meet. Entry fee income vs. hosting costs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {meets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No meets configured yet</p>
          ) : (
            <div className="space-y-3">
              {(meets as any[]).map((meet) => {
                const meetInvoices = (filtered as any[]).filter((i) => i.meetId === meet.id);
                const meetRevenue = meetInvoices.reduce((s: number, i: any) => s + (i.amount || 0), 0);
                const entryCount = (meet as any).entryCount ?? 0;
                return (
                  <div key={meet.id} className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{meet.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {meet.startDate ? format(new Date(meet.startDate), "MMM d, yyyy") : "No date"}
                        {" · "}{meet.facility || "No facility"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-semibold text-sm text-green-600">${meetRevenue.toFixed(0)}</div>
                      <div className="text-xs text-muted-foreground">{meetInvoices.length} invoices</div>
                    </div>
                    <Badge variant={meet.status === "completed" ? "default" : "secondary"}>
                      {meet.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Invoices */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Recent Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No invoices yet</p>
            ) : (
              recentInvoices.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <div className="text-sm font-medium">{inv.athleteName || "Unknown Athlete"}</div>
                    <div className="text-xs text-muted-foreground">{inv.invoiceType || "Invoice"}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-semibold">${(inv.amount || 0).toFixed(2)}</span>
                    <Badge
                      variant={inv.status === "paid" ? "default" : inv.status === "overdue" ? "destructive" : "secondary"}
                      className="text-[10px] capitalize"
                    >
                      {inv.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
