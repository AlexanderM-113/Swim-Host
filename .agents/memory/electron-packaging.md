---
name: Electron packaging
description: Architecture and constraints for the Swim Manager Pro Electron wrapper
---

## Structure

- `electron/main.ts` — Electron main process: checks license, shows activation or main window, spawns Express API as child process
- `electron/license.ts` — HMAC-SHA256 offline validator. Key format: `SMP-{base64url_JSON}-{hex_hmac}`. Secret in HMAC_SECRET constant (also reads SMP_LICENSE_SECRET env var for CI).
- `electron/preload.ts` — contextBridge exposing `window.electronBridge` (isElectron, validateLicense, getCurrentLicense, getClubConfig, activationComplete)
- `electron/activate.html` — standalone EULA + license key UI (no React, no component changes). Step 1: scroll EULA, click I Agree. Step 2: enter SMP key, validate, open app.
- `electron/eula.txt` — plain-text EULA for NSIS installer (shown during Windows install wizard)
- `electron-builder.yml` — Windows NSIS target; `licenseFile: electron/eula.txt`; bundles api-server dist → resources/api and swim-manager dist → resources/public
- `scripts/gen-license-key.ts` — interactive CLI to generate license keys

## Runtime flow

1. NSIS installer shows EULA (user must click "I Agree" to install)
2. On first launch: activation window opens (`activate.html`) → user agrees EULA again → enters license key → IPC validates → saves to `userData/license.json`
3. On subsequent launches: reads `userData/license.json`, validates HMAC + expiry → opens main window directly
4. Main window loads `http://localhost:8080` (Express serves Vite static files)
5. Express API also serves `/api/health` used by Electron to poll readiness

## Club config

`userData/club-config.json` shape: `{ clubName, clubCode, licenseKey, apiHost, liveRelayUrl }`
- `apiHost` defaults to "localhost"; set to LAN IP for multi-seat
- `liveRelayUrl` used by live-push.ts for scoreboard relay; empty = skip push

## SQLite constraint

**Cannot switch drizzle driver to better-sqlite3 without changing schema files.**
Schemas use `pgTable` from `drizzle-orm/pg-core`; Drizzle requires dialect-specific table definitions. In Electron, the frontend uses localStorage (works natively in renderer), so the DB layer is unused. `lib/db/src/index.ts` gracefully skips DB setup when SQLITE_PATH is set but no DATABASE_URL.

**Why:** The migration spec said "do not change lib/db/src/schema/" AND "switch to better-sqlite3" — these are contradictory. localStorage is sufficient for single-seat Electron use.

## Build commands

```
pnpm run electron:build-all   # compile everything
pnpm run electron:pack        # build + run electron-builder → dist/installers/
pnpm run gen-license          # interactive license key generator
```

Place a 256×256 ICO at `build-resources/icon.ico` before packaging.
