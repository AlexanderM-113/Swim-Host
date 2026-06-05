import { readStore, readSettings, writeSettings } from "./local-store";

let _intervalHandle: ReturnType<typeof setInterval> | null = null;

export function exportBackupJson(): void {
  try {
    const payload = {
      timestamp: new Date().toISOString(),
      store: readStore(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
    a.href = url;
    a.download = `swimmanager-backup-${ts}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    const settings = readSettings();
    writeSettings({ ...settings, lastBackupAt: new Date().toISOString(), lastBackupStatus: "success" });
    window.dispatchEvent(new Event("swimmanager:backup"));
  } catch (err) {
    console.error("[backup] export failed", err);
    const settings = readSettings();
    writeSettings({ ...settings, lastBackupAt: new Date().toISOString(), lastBackupStatus: "error" });
    window.dispatchEvent(new Event("swimmanager:backup"));
  }
}

export async function runBackup(): Promise<{ success: boolean; error?: string }> {
  try {
    exportBackupJson();
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}

export function startAutoBackup(): void {
  stopAutoBackup();
  const settings = readSettings();
  if (settings.backupIntervalMinutes <= 0) return;
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
