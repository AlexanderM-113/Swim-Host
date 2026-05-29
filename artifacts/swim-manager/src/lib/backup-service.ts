import { readStore, readSettings, writeSettings } from "./local-store";

let _intervalHandle: ReturnType<typeof setInterval> | null = null;

export async function runBackup(): Promise<{ success: boolean; error?: string }> {
  const settings = readSettings();
  if (!settings.backupUrl) return { success: false, error: "No backup URL configured" };

  const payload = {
    timestamp: new Date().toISOString(),
    store: readStore(),
  };

  try {
    const res = await fetch(settings.backupUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Server responded ${res.status} ${res.statusText}`);
    writeSettings({ ...settings, lastBackupAt: new Date().toISOString(), lastBackupStatus: "success" });
    window.dispatchEvent(new Event("swimmanager:backup"));
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    writeSettings({ ...settings, lastBackupAt: new Date().toISOString(), lastBackupStatus: "error" });
    window.dispatchEvent(new Event("swimmanager:backup"));
    return { success: false, error };
  }
}

export function startAutoBackup(): void {
  stopAutoBackup();
  const settings = readSettings();
  if (!settings.backupUrl || settings.backupIntervalMinutes <= 0) return;
  const ms = settings.backupIntervalMinutes * 60 * 1000;
  _intervalHandle = setInterval(() => runBackup(), ms);
}

export function stopAutoBackup(): void {
  if (_intervalHandle !== null) {
    clearInterval(_intervalHandle);
    _intervalHandle = null;
  }
}

export function restartAutoBackup(): void {
  startAutoBackup();
}
