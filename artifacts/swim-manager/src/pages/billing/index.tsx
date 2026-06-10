import { useState } from "react";
import { useListInvoices, useGetBillingSummary, useListPayments, useRecordPayment } from "@/lib/local-store";
import type { Invoice } from "@/lib/local-store";
import {
  readPaymentSettings,
  writePaymentSettings,
  buildCheckoutUrl,
  canCollectOnline,
  PROVIDER_LABELS,
  DEFAULT_PAYMENT_SETTINGS,
  type PaymentSettings,
  type PaymentProvider,
} from "@/lib/payments";
import { Link } from "wouter";
import { Plus, ReceiptText, CreditCard, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function Billing() {
  const { data: invoices, isLoading } = useListInvoices();
  const { data: summary } = useGetBillingSummary();
  const { data: payments } = useListPayments();
  const recordPayment = useRecordPayment();
  const { toast } = useToast();

  const [settings, setSettings] = useState<PaymentSettings>(() => readPaymentSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState<PaymentSettings>(settings);

  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const [payMethod, setPayMethod] = useState("card");
  const [payReference, setPayReference] = useState("");
  const [payNote, setPayNote] = useState("");

  if (isLoading) {
    return <div className="p-8">Loading billing...</div>;
  }

  function openSettings() {
    setDraft(settings);
    setSettingsOpen(true);
  }

  function saveSettings() {
    writePaymentSettings(draft);
    setSettings(draft);
    setSettingsOpen(false);
    toast({ title: "Payment settings saved" });
  }

  function openPay(invoice: Invoice) {
    setPayInvoice(invoice);
    setPayMethod(settings.provider === "manual" ? "cash" : "card");
    setPayReference("");
    setPayNote("");
  }

  function collectOnline(invoice: Invoice) {
    const url = buildCheckoutUrl(settings, invoice);
    if (!url) {
      toast({ title: "No checkout link configured", description: "Set up a payment link in Payment Settings first.", variant: "destructive" });
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
    // Record as pending — the user confirms receipt afterward via "Mark Paid".
    recordPayment.mutate({
      data: {
        invoiceId: invoice.id,
        athleteId: invoice.athleteId,
        athleteName: invoice.athleteName,
        amount: invoice.amount,
        provider: settings.provider,
        method: "online",
        status: "pending",
        note: "Checkout opened",
      },
    });
    toast({ title: "Checkout opened in a new tab", description: "Mark the invoice paid once payment clears." });
  }

  function submitPayment() {
    if (!payInvoice) return;
    recordPayment.mutate(
      {
        data: {
          invoiceId: payInvoice.id,
          athleteId: payInvoice.athleteId,
          athleteName: payInvoice.athleteName,
          amount: payInvoice.amount,
          provider: settings.provider,
          method: payMethod,
          reference: payReference || undefined,
          status: "succeeded",
          note: payNote || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Payment recorded", description: `Invoice INV-${String(payInvoice.id).padStart(5, "0")} marked paid.` });
          setPayInvoice(null);
        },
        onError: (e: any) => toast({ title: "Failed to record payment", description: e?.message, variant: "destructive" }),
      }
    );
  }

  const online = canCollectOnline(settings);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing &amp; Invoices</h1>
          <p className="text-muted-foreground">Manage athlete fees, meet entries, and club dues.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={openSettings}>
            <CreditCard className="mr-2 h-4 w-4" />
            Payment Settings
          </Button>
          <Link href="/billing/payment-plans" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
            Payment Plans
          </Link>
          <Link href="/billing/new" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
            <Plus className="mr-2 h-4 w-4" />
            Create Invoice
          </Link>
        </div>
      </div>

      {settings.enabled && (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Badge variant="secondary">{PROVIDER_LABELS[settings.provider]}</Badge>
          {online ? "Online payments enabled." : "Online payments enabled, but no checkout link is configured yet."}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
            <ReceiptText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${summary?.outstanding?.toFixed(2) || "0.00"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Overdue</CardTitle>
            <ReceiptText className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{summary?.overdueCount ?? 0} invoice{summary?.overdueCount !== 1 ? "s" : ""} overdue</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Collected (YTD)</CardTitle>
            <ReceiptText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${summary?.paid?.toFixed(2) || "0.00"}</div>
          </CardContent>
        </Card>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice ID</TableHead>
              <TableHead>Athlete</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices?.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium font-mono text-xs">INV-{invoice.id.toString().padStart(5, '0')}</TableCell>
                <TableCell>{invoice.athleteName}</TableCell>
                <TableCell>{(invoice as any).invoiceType ?? (invoice as any).type ?? "—"}</TableCell>
                <TableCell>
                  {invoice.dueDate ? format(new Date(invoice.dueDate), "MMM d, yyyy") : "-"}
                </TableCell>
                <TableCell className="text-right font-medium">${invoice.amount.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      invoice.status === 'paid' ? 'secondary' :
                      invoice.status === 'overdue' ? 'destructive' :
                      'default'
                    }
                  >
                    {invoice.status.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {invoice.status !== "paid" && (
                    <div className="flex justify-end gap-1.5">
                      {online && (
                        <Button size="sm" variant="outline" onClick={() => collectOnline(invoice)}>
                          <ExternalLink className="h-3.5 w-3.5 mr-1" /> Collect
                        </Button>
                      )}
                      <Button size="sm" onClick={() => openPay(invoice)}>Record Payment</Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(!invoices || invoices.length === 0) && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No invoices found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {payments && payments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Payment History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Date</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Athlete</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="pl-6 text-sm">{format(new Date(p.createdAt), "MMM d, yyyy")}</TableCell>
                    <TableCell className="font-mono text-xs">{p.invoiceId != null ? `INV-${String(p.invoiceId).padStart(5, "0")}` : "—"}</TableCell>
                    <TableCell>{p.athleteName ?? "—"}</TableCell>
                    <TableCell>{PROVIDER_LABELS[p.provider as PaymentProvider] ?? p.provider}</TableCell>
                    <TableCell className="capitalize">{p.method}</TableCell>
                    <TableCell className="text-right font-medium">${p.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === "succeeded" ? "secondary" : p.status === "refunded" ? "destructive" : "default"}>
                        {p.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.reference ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ─── Payment Settings dialog ─── */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payment Settings</DialogTitle>
            <DialogDescription>
              Connect a payment provider to collect entry fees and dues online. Use a hosted Payment Link /
              checkout URL — never paste a secret API key here (it isn't safe in the browser).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="text-sm font-medium">Enable online payments</Label>
                <p className="text-xs text-muted-foreground">Show a “Collect” button on outstanding invoices.</p>
              </div>
              <Switch checked={draft.enabled} onCheckedChange={(v) => setDraft({ ...draft, enabled: v })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Provider</Label>
                <Select value={draft.provider} onValueChange={(v) => setDraft({ ...draft, provider: v as PaymentProvider })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PROVIDER_LABELS) as PaymentProvider[]).map((p) => (
                      <SelectItem key={p} value={p}>{PROVIDER_LABELS[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Input value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })} placeholder="USD" maxLength={3} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Business / club name (shown to families)</Label>
              <Input value={draft.businessName} onChange={(e) => setDraft({ ...draft, businessName: e.target.value })} placeholder="My Swimming Club" />
            </div>

            {draft.provider === "stripe" && (
              <>
                <div className="space-y-1.5">
                  <Label>Stripe Payment Link</Label>
                  <Input value={draft.stripeLink} onChange={(e) => setDraft({ ...draft, stripeLink: e.target.value })} placeholder="https://buy.stripe.com/..." />
                  <p className="text-[11px] text-muted-foreground">Create one in your Stripe dashboard → Payment Links. We append the invoice reference automatically.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Publishable key (optional)</Label>
                  <Input value={draft.stripePublishableKey} onChange={(e) => setDraft({ ...draft, stripePublishableKey: e.target.value })} placeholder="pk_live_..." />
                </div>
              </>
            )}

            {draft.provider === "square" && (
              <div className="space-y-1.5">
                <Label>Square checkout / payment link</Label>
                <Input value={draft.squareLink} onChange={(e) => setDraft({ ...draft, squareLink: e.target.value })} placeholder="https://square.link/u/..." />
              </div>
            )}

            {draft.provider === "paypal" && (
              <div className="space-y-1.5">
                <Label>PayPal.Me username</Label>
                <Input value={draft.paypalMeUser} onChange={(e) => setDraft({ ...draft, paypalMeUser: e.target.value })} placeholder="myswimclub" />
                <p className="text-[11px] text-muted-foreground">Opens paypal.com/paypalme/&lt;user&gt;/&lt;amount&gt; — the invoice amount is filled in for you.</p>
              </div>
            )}

            {draft.provider === "manual" && (
              <div className="space-y-1.5">
                <Label>Payment instructions</Label>
                <Textarea value={draft.manualInstructions} onChange={(e) => setDraft({ ...draft, manualInstructions: e.target.value })} placeholder="Make checks payable to… / Zelle to…" rows={3} />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Advanced: custom checkout URL template (optional)</Label>
              <Input value={draft.checkoutUrlTemplate} onChange={(e) => setDraft({ ...draft, checkoutUrlTemplate: e.target.value })} placeholder="https://pay.example.com/checkout?amt={amount}&ref={invoiceId}" />
              <p className="text-[11px] text-muted-foreground">
                Placeholders: <code>{"{amount}"}</code>, <code>{"{amount_cents}"}</code>, <code>{"{currency}"}</code>, <code>{"{description}"}</code>, <code>{"{email}"}</code>, <code>{"{invoiceId}"}</code>. Use this to point at a hosted Checkout Session that supports dynamic amounts.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(DEFAULT_PAYMENT_SETTINGS)}>Reset</Button>
            <Button onClick={saveSettings}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Record payment dialog ─── */}
      <Dialog open={!!payInvoice} onOpenChange={(o) => !o && setPayInvoice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              {payInvoice && (
                <>INV-{String(payInvoice.id).padStart(5, "0")} · {payInvoice.athleteName ?? "—"} · <strong>${payInvoice.amount.toFixed(2)}</strong></>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="card">Card / Online</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="transfer">Bank transfer</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Reference (optional)</Label>
              <Input value={payReference} onChange={(e) => setPayReference(e.target.value)} placeholder="Check # or transaction id" />
            </div>
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayInvoice(null)}>Cancel</Button>
            <Button onClick={submitPayment} disabled={recordPayment.isPending}>Mark Paid</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
