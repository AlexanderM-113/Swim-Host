import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useListFundraisingCampaigns, useCreateFundraisingCampaign, useUpdateFundraisingCampaign,
  useDeleteFundraisingCampaign, useListFundraisingDonations, useCreateFundraisingDonation,
  useDeleteFundraisingDonation, type FundraisingCampaign,
} from "@/lib/local-store";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, DollarSign, Target, TrendingUp, ChevronRight, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type CampaignStatus = "active" | "completed" | "draft";

const STATUS_COLORS: Record<CampaignStatus, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const DONATION_TYPES = ["donation", "pledge", "sponsorship"] as const;

interface CampaignForm {
  name: string; goal: string; startDate: string; endDate: string; description: string; status: CampaignStatus;
}
const BLANK_CAMPAIGN: CampaignForm = {
  name: "", goal: "", startDate: format(new Date(), "yyyy-MM-dd"), endDate: "", description: "", status: "active",
};

interface DonationForm {
  donorName: string; amount: string; type: "donation" | "pledge" | "sponsorship"; notes: string; date: string;
}
const BLANK_DONATION: DonationForm = {
  donorName: "", amount: "", type: "donation", notes: "", date: format(new Date(), "yyyy-MM-dd"),
};

export default function FundraisingPage() {
  const [activeCampaign, setActiveCampaign] = useState<FundraisingCampaign | null>(null);
  const [campaignDialog, setCampaignDialog] = useState(false);
  const [editCampaignId, setEditCampaignId] = useState<number | null>(null);
  const [campaignForm, setCampaignForm] = useState<CampaignForm>(BLANK_CAMPAIGN);
  const [donationDialog, setDonationDialog] = useState(false);
  const [donationForm, setDonationForm] = useState<DonationForm>(BLANK_DONATION);
  const { toast } = useToast();

  const { data: campaigns = [] } = useListFundraisingCampaigns();
  const { data: donations = [] } = useListFundraisingDonations(activeCampaign?.id);
  const createCampaign = useCreateFundraisingCampaign();
  const updateCampaign = useUpdateFundraisingCampaign();
  const deleteCampaign = useDeleteFundraisingCampaign();
  const createDonation = useCreateFundraisingDonation();
  const deleteDonation = useDeleteFundraisingDonation();

  const totalGoal = campaigns.reduce((s, c) => s + c.goal, 0);
  const totalRaised = campaigns.reduce((s, c) => s + c.raised, 0);
  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;

  function openAddCampaign() { setEditCampaignId(null); setCampaignForm(BLANK_CAMPAIGN); setCampaignDialog(true); }
  function openEditCampaign(c: FundraisingCampaign) {
    setEditCampaignId(c.id);
    setCampaignForm({
      name: c.name, goal: String(c.goal), startDate: c.startDate, endDate: c.endDate ?? "",
      description: c.description ?? "", status: c.status,
    });
    setCampaignDialog(true);
  }

  function submitCampaign() {
    if (!campaignForm.name || !campaignForm.goal) {
      toast({ title: "Name and goal are required", variant: "destructive" }); return;
    }
    const payload = {
      name: campaignForm.name, goal: parseFloat(campaignForm.goal), raised: 0,
      startDate: campaignForm.startDate, endDate: campaignForm.endDate || undefined,
      description: campaignForm.description, status: campaignForm.status,
    };
    if (editCampaignId) {
      updateCampaign.mutate({ id: editCampaignId, data: { ...payload } }, {
        onSuccess: () => { setCampaignDialog(false); toast({ title: "Campaign updated" }); },
      });
    } else {
      createCampaign.mutate({ data: payload }, {
        onSuccess: () => { setCampaignDialog(false); toast({ title: "Campaign created" }); },
      });
    }
  }

  function submitDonation() {
    if (!donationForm.donorName || !donationForm.amount || !activeCampaign) {
      toast({ title: "Donor name and amount are required", variant: "destructive" }); return;
    }
    createDonation.mutate({
      data: {
        campaignId: activeCampaign.id,
        donorName: donationForm.donorName,
        amount: parseFloat(donationForm.amount),
        type: donationForm.type,
        notes: donationForm.notes,
        date: donationForm.date,
      },
    }, {
      onSuccess: () => { setDonationDialog(false); setDonationForm(BLANK_DONATION); toast({ title: "Donation recorded" }); },
    });
  }

  function fmt(n: number) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fundraising</h1>
          <p className="text-muted-foreground text-sm">Track campaigns, donations, pledges, and sponsorships</p>
        </div>
        <Button onClick={openAddCampaign}><Plus className="h-4 w-4 mr-2" />New Campaign</Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-green-600" />
          </div>
          <div><div className="text-xl font-black">{fmt(totalRaised)}</div><div className="text-xs text-muted-foreground">Total Raised</div></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Target className="h-5 w-5 text-blue-600" />
          </div>
          <div><div className="text-xl font-black">{fmt(totalGoal)}</div><div className="text-xs text-muted-foreground">Total Goal</div></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <div className="text-xl font-black">{totalGoal > 0 ? Math.round((totalRaised / totalGoal) * 100) : 0}%</div>
            <div className="text-xs text-muted-foreground">Overall Progress</div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <Target className="h-5 w-5 text-purple-600" />
          </div>
          <div><div className="text-xl font-black">{activeCampaigns}</div><div className="text-xs text-muted-foreground">Active Campaigns</div></div>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Campaign list */}
        <div className="space-y-3">
          {campaigns.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                No campaigns yet. Create one to get started.
              </CardContent>
            </Card>
          )}
          {campaigns.map((c) => {
            const pct = c.goal > 0 ? Math.min(100, Math.round((c.raised / c.goal) * 100)) : 0;
            return (
              <Card key={c.id}
                className={cn("cursor-pointer hover:shadow-md transition-all", activeCampaign?.id === c.id ? "ring-2 ring-primary" : "")}
                onClick={() => setActiveCampaign(c)}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-bold text-sm">{c.name}</div>
                    <Badge className={cn("text-[10px]", STATUS_COLORS[c.status])}>{c.status}</Badge>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{fmt(c.raised)} raised</span>
                    <span>{fmt(c.goal)} goal</span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                  <div className="text-xs text-muted-foreground">{pct}% funded</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Campaign detail */}
        {activeCampaign ? (
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">{activeCampaign.name}</h2>
                {activeCampaign.description && <p className="text-sm text-muted-foreground">{activeCampaign.description}</p>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEditCampaign(activeCampaign)}><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>
                <Button size="sm" variant="destructive" onClick={() => {
                  deleteCampaign.mutate({ id: activeCampaign.id }, {
                    onSuccess: () => { setActiveCampaign(null); toast({ title: "Campaign deleted" }); },
                  });
                }}><Trash2 className="h-3.5 w-3.5 mr-1" />Delete</Button>
              </div>
            </div>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-2xl font-black">{fmt(activeCampaign.raised)}</div>
                  <div className="text-sm text-muted-foreground">of {fmt(activeCampaign.goal)} goal</div>
                </div>
                <Progress value={activeCampaign.goal > 0 ? Math.min(100, (activeCampaign.raised / activeCampaign.goal) * 100) : 0} className="h-2" />
                <div className="mt-1 text-xs text-muted-foreground">{activeCampaign.startDate} → {activeCampaign.endDate ?? "ongoing"}</div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Donations & Pledges</h3>
              <Button size="sm" onClick={() => { setDonationForm(BLANK_DONATION); setDonationDialog(true); }}>
                <Plus className="h-3.5 w-3.5 mr-1" />Record Donation
              </Button>
            </div>

            {donations.length === 0 ? (
              <Card className="border-dashed"><CardContent className="py-8 text-center text-muted-foreground text-sm">No donations recorded yet.</CardContent></Card>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Donor</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {donations.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.donorName}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize text-xs">{d.type}</Badge></TableCell>
                      <TableCell className="text-right font-mono font-bold">{fmt(d.amount)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{d.date}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                          onClick={() => deleteDonation.mutate({ id: d.id }, { onSuccess: () => toast({ title: "Removed" }) })}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        ) : (
          <div className="lg:col-span-2 flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl min-h-[300px]">
            <div className="text-center"><DollarSign className="h-10 w-10 mx-auto mb-2 opacity-20" /><p>Select a campaign to view details</p></div>
          </div>
        )}
      </div>

      {/* Campaign dialog */}
      <Dialog open={campaignDialog} onOpenChange={setCampaignDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editCampaignId ? "Edit Campaign" : "New Fundraising Campaign"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Campaign Name *</Label><Input value={campaignForm.name} onChange={e => setCampaignForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Goal Amount ($) *</Label><Input type="number" value={campaignForm.goal} onChange={e => setCampaignForm(f => ({ ...f, goal: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Status</Label>
                <Select value={campaignForm.status} onValueChange={v => setCampaignForm(f => ({ ...f, status: v as CampaignStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Start Date</Label><Input type="date" value={campaignForm.startDate} onChange={e => setCampaignForm(f => ({ ...f, startDate: e.target.value }))} /></div>
              <div className="space-y-1"><Label>End Date</Label><Input type="date" value={campaignForm.endDate} onChange={e => setCampaignForm(f => ({ ...f, endDate: e.target.value }))} /></div>
            </div>
            <div className="space-y-1"><Label>Description</Label><Input value={campaignForm.description} onChange={e => setCampaignForm(f => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCampaignDialog(false)}>Cancel</Button>
            <Button onClick={submitCampaign}>{editCampaignId ? "Update" : "Create Campaign"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Donation dialog */}
      <Dialog open={donationDialog} onOpenChange={setDonationDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Donation — {activeCampaign?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Donor Name *</Label><Input value={donationForm.donorName} onChange={e => setDonationForm(f => ({ ...f, donorName: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Amount ($) *</Label><Input type="number" value={donationForm.amount} onChange={e => setDonationForm(f => ({ ...f, amount: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Type</Label>
                <Select value={donationForm.type} onValueChange={v => setDonationForm(f => ({ ...f, type: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DONATION_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1"><Label>Date</Label><Input type="date" value={donationForm.date} onChange={e => setDonationForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Notes</Label><Input value={donationForm.notes} onChange={e => setDonationForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDonationDialog(false)}>Cancel</Button>
            <Button onClick={submitDonation}>Record Donation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
