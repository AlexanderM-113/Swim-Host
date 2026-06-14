import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import fs from "fs";
import { spawn, type ChildProcess } from "child_process";
import { validateLicense, type LicenseInfo } from "./license.js";

// ── Environment flags ─────────────────────────────────────────────────────────

const isDev = !app.isPackaged;

// ── User-data paths ───────────────────────────────────────────────────────────

const userDataPath  = app.getPath("userData");
const licenseFile   = path.join(userDataPath, "license.json");
const clubCfgFile   = path.join(userDataPath, "club-config.json");

// ── Runtime state ─────────────────────────────────────────────────────────────

let mainWindow:       BrowserWindow  | null = null;
let activationWindow: BrowserWindow  | null = null;
let apiProcess:       ChildProcess   | null = null;
let currentLicense:   LicenseInfo   | null = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadStoredLicense(): LicenseInfo | null {
  try {
    if (!fs.existsSync(licenseFile)) return null;
    const stored = JSON.parse(fs.readFileSync(licenseFile, "utf-8")) as { key: string };
    const result = validateLicense(stored.key);
    return result.valid ? result.info! : null;
  } catch {
    return null;
  }
}

function loadClubConfig(): Record<string, unknown> | null {
  try {
    if (!fs.existsSync(clubCfgFile)) return null;
    return JSON.parse(fs.readFileSync(clubCfgFile, "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function preloadPath(): string {
  return isDev
    ? path.join(__dirname, "preload.js")
    : path.join(__dirname, "../preload.js");
}

// ── API server ────────────────────────────────────────────────────────────────

function startApiServer(): void {
  const sqlitePath = process.env["SQLITE_PATH"] ??
    path.join(userDataPath, "swimmanager.db");

  // In packaged builds the API bundle lives in resources/api/index.mjs
  const apiBundle = isDev
    ? path.join(__dirname, "../../artifacts/api-server/dist/index.mjs")
    : path.join(process.resourcesPath, "api", "index.mjs");

  if (!fs.existsSync(apiBundle)) {
    console.warn("[electron] API bundle not found:", apiBundle);
    console.warn("[electron] Run: pnpm --filter @workspace/api-server run build");
    return;
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    // Run the Electron binary as plain Node so it executes the API bundle
    // instead of launching a second Electron app instance.
    ELECTRON_RUN_AS_NODE: "1",
    NODE_ENV:    "production",
    PORT:        "8080",
    SQLITE_PATH: sqlitePath,
  };

  apiProcess = spawn(process.execPath, [apiBundle], {
    env,
    stdio: isDev ? "inherit" : "ignore",
    detached: false,
  });

  apiProcess.on("error",  (err)  => console.error("[electron] API error:", err));
  apiProcess.on("exit",   (code) => console.log("[electron] API exited:", code));
}

// ── Windows ───────────────────────────────────────────────────────────────────

function createActivationWindow(): void {
  activationWindow = new BrowserWindow({
    width:     780,
    height:    640,
    resizable: false,
    center:    true,
    title:     "Swim Manager Pro — Software Activation",
    webPreferences: {
      preload:          preloadPath(),
      nodeIntegration:  false,
      contextIsolation: true,
      sandbox:          false,
    },
  });

  activationWindow.setMenu(null);

  const htmlPath = isDev
    ? path.join(__dirname, "activate.html")
    : path.join(__dirname, "../activate.html");

  activationWindow.loadFile(htmlPath).catch(console.error);
  activationWindow.on("closed", () => { activationWindow = null; });
}

function createMainWindow(): void {
  const config   = loadClubConfig();
  const apiHost  = (config?.["apiHost"] as string | undefined) ?? "localhost";
  const appUrl   = `http://${apiHost}:8080`;

  mainWindow = new BrowserWindow({
    width:     1400,
    height:    900,
    minWidth:  1100,
    minHeight: 700,
    center:    true,
    title:     "Swim Manager Pro",
    webPreferences: {
      preload:          preloadPath(),
      nodeIntegration:  false,
      contextIsolation: true,
      sandbox:          false,
    },
  });

  mainWindow.setMenu(null);

  // Poll until Express API is ready (it takes ~1s to boot)
  let attempts = 0;
  const MAX_ATTEMPTS = 30;

  const tryLoad = (): void => {
    fetch(`${appUrl}/api/health`, { signal: AbortSignal.timeout(800) })
      .then(() => { mainWindow?.loadURL(appUrl).catch(console.error); })
      .catch(() => {
        attempts++;
        if (attempts < MAX_ATTEMPTS) {
          setTimeout(tryLoad, 500);
        } else {
          // Fallback: try loading anyway
          mainWindow?.loadURL(appUrl).catch(console.error);
        }
      });
  };

  tryLoad();
  mainWindow.on("closed", () => { mainWindow = null; });
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

ipcMain.handle("license:validate", async (_e, key: string) => {
  const result = validateLicense(key);
  if (result.valid && result.info) {
    fs.mkdirSync(userDataPath, { recursive: true });
    fs.writeFileSync(licenseFile, JSON.stringify({ key }, null, 2));
    currentLicense = result.info;
  }
  return result;
});

ipcMain.handle("license:current", () => currentLicense);

ipcMain.handle("club-config:get", () => loadClubConfig());

ipcMain.handle("activation:complete", () => {
  activationWindow?.close();
  createMainWindow();
});

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  startApiServer();
  currentLicense = loadStoredLicense();

  if (!currentLicense) {
    createActivationWindow();
  } else {
    createMainWindow();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  if (apiProcess) {
    apiProcess.kill();
    apiProcess = null;
  }
});
