# Packaging Swim Manager Pro into a Windows `.exe` (Electron)

This guide walks through building the Swim Manager Pro desktop installer
(`SwimManagerPro-Setup-<version>.exe`) on Windows using **PowerShell** or
**Command Prompt**. The installer bundles the Electron shell, the Express API
server, and the built web app into a single NSIS installer.

---

## 1. Prerequisites

Install these once on the build machine:

| Tool | Version | Notes |
|------|---------|-------|
| **Node.js** | 20.x LTS | <https://nodejs.org> — includes `npm`/`npx`. |
| **pnpm** | 9.x | Package manager used by this repo. |
| **Git** | any | To clone the repository. |

After installing Node, enable **pnpm** via Corepack (ships with Node):

```powershell
corepack enable
corepack prepare pnpm@9.15.4 --activate
```

Verify the toolchain (works the same in PowerShell and Command Prompt):

```powershell
node --version    # v20.x
pnpm --version    # 9.x
```

> The packaging step downloads ~140 MB of Electron + NSIS build tooling from
> GitHub the **first** time it runs, so the build machine needs internet access
> (subsequent builds are cached). Run from a normal user account — no admin
> rights are required to *build* the installer.

---

## 2. Get the code and install dependencies

```powershell
git clone https://github.com/AlexanderM-113/Swim-Host.git
cd Swim-Host
pnpm install
```

`pnpm install` installs dependencies for every workspace package, including the
`electron` shell and `electron-builder`.

---

## 3. One-command build (recommended)

The repo ships a script that builds all three pieces (API, web app, Electron
main) and then runs `electron-builder`:

```powershell
pnpm run electron:pack
```

When it finishes, the installer is written to:

```
dist\installers\SwimManagerPro-Setup-1.0.0.exe
```

(The version number comes from the `version` field in the root `package.json`.)

That's it — skip to [section 6](#6-test-the-installer).

---

## 4. Step-by-step build (if you want to run each stage manually)

`electron:pack` is equivalent to running these in order:

```powershell
# 4a. Build the Express API server  -> artifacts\api-server\dist\index.mjs
pnpm run electron:build-api

# 4b. Build the web app (Vite)       -> artifacts\swim-manager\dist\public\
pnpm run electron:build-app

# 4c. Compile the Electron main/preload TypeScript -> electron\dist\
pnpm run electron:build-main

# 4d. Package everything into the Windows installer
pnpm exec electron-builder --config electron-builder.yml --win
```

Each stage must succeed before the next. If you change source code, re-run the
relevant stage (or just re-run `pnpm run electron:pack`).

---

## 5. What gets packaged

`electron-builder.yml` controls the output:

- **App entry**: `electron/dist/main.js` (declared via `main` in `package.json`).
- **Bundled into the app** (`app.asar`): the compiled Electron `dist/` + `activate.html`.
- **Bundled alongside the app** (`resources\`):
  - `resources\api\` ← `artifacts/api-server/dist` (the Express server)
  - `resources\public\` ← `artifacts/swim-manager/dist/public` (the web UI)
- **Installer type**: NSIS wizard (`oneClick: false`) — lets the user pick the
  install directory, creates Desktop + Start-Menu shortcuts, and shows the EULA
  from `electron/eula.txt`.
- **Icon**: `build-resources\icon.ico` (256×256). A placeholder is committed; to
  brand the app, replace it with your own 256×256 `.ico` (and `icon.png` for
  the Linux target) before building. The placeholder can be regenerated with
  `node build-resources/generate-placeholder-icon.mjs`.

At runtime the Electron main process starts the API server (running the Electron
binary as plain Node via `ELECTRON_RUN_AS_NODE`) on port **8080**, waits for
`/api/health`, then loads the UI. App data (the SQLite DB, license, club config)
lives under `%APPDATA%\Swim Manager Pro\`.

---

## 6. Test the installer

```powershell
# Launch the generated installer
.\dist\installers\SwimManagerPro-Setup-1.0.0.exe
```

Or, to run the **unpacked** app without installing (useful for debugging):

```powershell
.\dist\installers\win-unpacked\"Swim Manager Pro.exe"
```

---

## 7. Troubleshooting

| Symptom | Fix |
|--------|-----|
| `Use pnpm instead` error on install | You ran `npm install`. Use `pnpm install`. |
| `electron` / `@types/node` "cannot find module" during `electron:build-main` | Dependencies aren't installed — run `pnpm install` from the repo root. |
| `image must be at least 256x256` | `build-resources\icon.ico` is too small. Provide a 256×256 `.ico` (or run the generator in section 5). |
| Build hangs on first run | It's downloading Electron/NSIS tooling from GitHub. Ensure internet access; it's cached afterwards. |
| Installer builds but app shows a blank window | Make sure `electron:build-api` **and** `electron:build-app` ran so `resources\api` and `resources\public` are populated (re-run `pnpm run electron:pack`). |
| `signtool.exe ... signing is skipped` | Expected — the build is **unsigned**. To ship without SmartScreen warnings, configure a code-signing certificate (`cscLink` / `cscKeyPassword`). |

---

## 8. Quick reference

```powershell
git clone https://github.com/AlexanderM-113/Swim-Host.git
cd Swim-Host
pnpm install
pnpm run electron:pack
# -> dist\installers\SwimManagerPro-Setup-1.0.0.exe
```
