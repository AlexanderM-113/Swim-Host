import { useEffect, useRef, useState } from "react";
import { useGetClub, useUpdateClub, useGetSettings, useUpdateSettings, exportAllData, importAllData, clearAllData } from "@/lib/local-store";
import { runBackup, restartAutoBackup } from "@/lib/backup-service";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CheckCircle2, XCircle, Upload, Download, Trash2, RefreshCw, Server, Database, Shield } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const clubSchema = z.object({
  name: z.string().min(2, "Club name is required"),
  abbreviation: z.string().optional(),
  lsc: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").or(z.literal("")).optional(),
  website: z.string().url().or(z.literal("")).optional(),
});

const backupSchema = z.object({
  backupUrl: z.string().url("Must be a valid URL").or(z.literal("")),
  backupIntervalMinutes: z.coerce.number().min(0),
});

export default function Settings() {
  const { data: club, isLoading } = useGetClub();
  const { data: settings } = useGetSettings();
  const updateClub = useUpdateClub();
  const updateSettings = useUpdateSettings();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const queryClient = useQueryClient();

  const clubForm = useForm<z.infer<typeof clubSchema>>({
    resolver: zodResolver(clubSchema),
    defaultValues: { name: "", abbreviation: "", lsc: "", email: "" },
  });

  const backupForm = useForm<z.infer<typeof backupSchema>>({
    resolver: zodResolver(backupSchema),
    defaultValues: { backupUrl: "", backupIntervalMinutes: 30 },
  });

  useEffect(() => {
    if (club) {
      clubForm.reset({
        name: club.name,
        abbreviation: club.abbreviation ?? "",
        lsc: club.lsc ?? "",
        address: club.address ?? "",
        city: club.city ?? "",
        state: club.state ?? "",
        country: club.country ?? "",
        postalCode: club.postalCode ?? "",
        phone: club.phone ?? "",
        email: club.email ?? "",
        website: club.website ?? "",
      });
    }
  }, [club]);

  useEffect(() => {
    if (settings) {
      backupForm.reset({
        backupUrl: settings.backupUrl ?? "",
        backupIntervalMinutes: settings.backupIntervalMinutes ?? 30,
      });
    }
  }, [settings]);

  useEffect(() => {
    const handler = () => queryClient.invalidateQueries({ queryKey: ["settings"] });
    window.addEventListener("swimmanager:backup", handler);
    return () => window.removeEventListener("swimmanager:backup", handler);
  }, [queryClient]);

  function onClubSubmit(data: z.infer<typeof clubSchema>) {
    updateClub.mutate(
      { data },
      {
        onSuccess: () => toast({ title: "Club settings saved" }),
        onError: () => toast({ title: "Failed to save", variant: "destructive" }),
      }
    );
  }

  function onBackupSubmit(data: z.infer<typeof backupSchema>) {
    updateSettings.mutate(
      { backupUrl: data.backupUrl, backupIntervalMinutes: data.backupIntervalMinutes },
      {
        onSuccess: () => {
          restartAutoBackup();
          toast({
            title: "Backup settings saved",
            description: data.backupUrl
              ? `Auto-backup every ${data.backupIntervalMinutes} min`
              : "Auto-backup disabled",
          });
        },
      }
    );
  }

  async function handleManualBackup() {
    setIsBackingUp(true);
    const result = await runBackup();
    setIsBackingUp(false);
    queryClient.invalidateQueries({ queryKey: ["settings"] });
    if (result.success) {
      toast({ title: "Backup successful", description: "Data sent to your backup server." });
    } else {
      toast({ title: "Backup failed", description: result.error, variant: "destructive" });
    }
  }

  function handleExport() {
    const json = exportAllData();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `swimmanager-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Data exported", description: "JSON file downloaded." });
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        importAllData(ev.target?.result as string);
        queryClient.invalidateQueries();
        toast({ title: "Data imported", description: "All data restored from file." });
      } catch {
        toast({ title: "Import failed", description: "Invalid JSON file.", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleClear() {
    clearAllData();
    queryClient.invalidateQueries();
    toast({ title: "All data cleared", description: "Local storage has been reset." });
  }

  if (isLoading) return <div className="p-8">Loading settings...</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage club details, backup, and data storage.</p>
      </div>

      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
        <CardContent className="flex items-center gap-3 pt-4">
          <Database className="h-5 w-5 text-blue-600 shrink-0" />
          <p className="text-sm text-blue-800 dark:text-blue-200">
            All data is stored locally in your browser (localStorage). Nothing is sent anywhere unless you configure a backup URL below.
          </p>
        </CardContent>
      </Card>

      <Form {...clubForm}>
        <form onSubmit={clubForm.handleSubmit(onClubSubmit)} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Club / Organization</CardTitle>
              <CardDescription>Basic information about your team or club.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={clubForm.control} name="name" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Club Name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={clubForm.control} name="abbreviation" render={({ field }) => (
                <FormItem>
                  <FormLabel>Abbreviation</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={clubForm.control} name="lsc" render={({ field }) => (
                <FormItem>
                  <FormLabel>LSC</FormLabel>
                  <FormControl><Input placeholder="e.g. VA" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={clubForm.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input type="email" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={clubForm.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={clubForm.control} name="city" render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={clubForm.control} name="state" render={({ field }) => (
                <FormItem>
                  <FormLabel>State</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                </FormItem>
              )} />
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button type="submit" disabled={updateClub.isPending}>
              {updateClub.isPending ? "Saving..." : "Save Club Settings"}
            </Button>
          </div>
        </form>
      </Form>

      <Separator />

      <Form {...backupForm}>
        <form onSubmit={backupForm.handleSubmit(onBackupSubmit)} className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                <CardTitle>Remote Backup</CardTitle>
              </div>
              <CardDescription>
                Periodically POST your full data as JSON to any URL you control — your own server, a webhook relay (webhook.site, Pipedream, n8n, Make), Zapier, etc.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {settings?.lastBackupAt && (
                <div className="flex items-center gap-2 text-sm">
                  {settings.lastBackupStatus === "success" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-muted-foreground">
                    Last backup: {new Date(settings.lastBackupAt).toLocaleString()}
                  </span>
                  <Badge
                    variant={settings.lastBackupStatus === "success" ? "default" : "destructive"}
                    className="text-xs"
                  >
                    {settings.lastBackupStatus}
                  </Badge>
                </div>
              )}

              <FormField control={backupForm.control} name="backupUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel>Backup URL</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://your-server.com/backup  or  https://webhook.site/..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground mt-1">
                    Receives a POST with JSON body:{" "}
                    <code className="bg-muted px-1 rounded text-xs">
                      {"{ timestamp, store: { meets, athletes, teams, events, entries, results, ... } }"}
                    </code>
                  </p>
                </FormItem>
              )} />

              <FormField control={backupForm.control} name="backupIntervalMinutes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Auto-backup Interval</FormLabel>
                  <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value)}>
                    <FormControl>
                      <SelectTrigger className="w-52">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="0">Disabled</SelectItem>
                      <SelectItem value="5">Every 5 minutes</SelectItem>
                      <SelectItem value="10">Every 10 minutes</SelectItem>
                      <SelectItem value="15">Every 15 minutes</SelectItem>
                      <SelectItem value="30">Every 30 minutes</SelectItem>
                      <SelectItem value="60">Every hour</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handleManualBackup}
              disabled={isBackingUp || !settings?.backupUrl}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isBackingUp ? "animate-spin" : ""}`} />
              {isBackingUp ? "Backing up..." : "Backup Now"}
            </Button>
            <Button type="submit" disabled={updateSettings.isPending}>
              {updateSettings.isPending ? "Saving..." : "Save Backup Settings"}
            </Button>
          </div>
        </form>
      </Form>

      <Separator />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>Data Management</CardTitle>
          </div>
          <CardDescription>Export a full snapshot, restore from a previous export, or wipe everything.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export JSON
          </Button>

          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Import JSON
          </Button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Clear All Data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes all meets, athletes, teams, events, results, and everything else from local storage. Export a backup first if you need to keep your data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClear}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Yes, clear everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
