import { useEffect, useRef, useState } from "react";
import { useGetClub, useUpdateClub, useGetSettings, exportAllData, importAllData, clearAllData } from "@/lib/local-store";
import { exportBackupJson } from "@/lib/backup-service";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CheckCircle2, Upload, Download, Trash2, RefreshCw, Server, Database, Shield, ImageIcon, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const LOGO_KEY = "swimmanager:clubLogo";

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

export default function Settings() {
  const { data: club, isLoading } = useGetClub();
  const { data: settings } = useGetSettings();
  const updateClub = useUpdateClub();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [clubLogo, setClubLogo] = useState<string>(() => localStorage.getItem(LOGO_KEY) ?? "");
  const logoRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const clubForm = useForm<z.infer<typeof clubSchema>>({
    resolver: zodResolver(clubSchema),
    defaultValues: { name: "", abbreviation: "", lsc: "", email: "" },
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

  async function handleManualBackup() {
    setIsBackingUp(true);
    try {
      exportBackupJson();
      toast({ title: "Backup downloaded", description: "JSON backup file saved to your downloads." });
    } catch {
      toast({ title: "Backup failed", variant: "destructive" });
    } finally {
      setIsBackingUp(false);
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

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Logo too large", description: "Please use an image under 2MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setClubLogo(url);
      localStorage.setItem(LOGO_KEY, url);
      toast({ title: "Logo saved", description: "Club logo uploaded and saved locally." });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function removeLogo() {
    setClubLogo("");
    localStorage.removeItem(LOGO_KEY);
    toast({ title: "Logo removed" });
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

      {/* Logo Upload */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            <CardTitle>Club Logo</CardTitle>
          </div>
          <CardDescription>
            Upload your club logo. It will appear in the fullscreen scoreboard and meet reports.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="h-24 w-24 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30 shrink-0">
              {clubLogo ? (
                <img src={clubLogo} alt="Club Logo" className="h-20 w-20 object-contain rounded-lg" />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
              )}
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => logoRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  {clubLogo ? "Replace Logo" : "Upload Logo"}
                </Button>
                {clubLogo && (
                  <Button variant="ghost" className="text-destructive" onClick={removeLogo}>
                    <X className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                )}
                <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </div>
              <p className="text-xs text-muted-foreground">
                Accepted formats: PNG, JPG, SVG, WebP. Max 2MB. Logo is stored locally in your browser.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            <CardTitle>Backup</CardTitle>
          </div>
          <CardDescription>
            Download a complete JSON snapshot of all your SwimManager data. Restore it at any time from the Data Management section below.
            SwimManager works fully offline — all data lives in your browser only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {settings?.lastBackupAt && (
            <div className="flex items-center gap-2 text-sm mb-4">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-muted-foreground">
                Last backup: {new Date(settings.lastBackupAt).toLocaleString()}
              </span>
            </div>
          )}
          <Button
            variant="outline"
            onClick={handleManualBackup}
            disabled={isBackingUp}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isBackingUp ? "animate-spin" : ""}`} />
            {isBackingUp ? "Downloading..." : "Download Backup Now"}
          </Button>
        </CardContent>
      </Card>

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
