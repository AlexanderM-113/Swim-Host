# Packaging Swim Manager Pro — Windows `.exe`

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20.x LTS |
| pnpm | 9.x |
| Git | any |

Enable pnpm via Corepack:

```powershell
corepack enable
corepack prepare pnpm@9.15.4 --activate
```

## Build the Installer

```powershell
git clone https://github.com/AlexanderM-113/Swim-Host.git
cd Swim-Host
pnpm install
pnpm run electron:pack
```

The installer is written to:

```
dist\installers\SwimManagerPro-Setup-1.0.0.exe
```

## What Gets Packaged

- **Electron main**: `electron/dist/main.js`
- **API server**: `artifacts/api-server/dist` → `resources\api\`
- **Web UI**: `artifacts/swim-manager/dist/public` → `resources\public\`
- **Installer**: NSIS wizard with EULA from `electron/eula.txt`
- **Icon**: `build-resources\icon.ico` (256x256)

## Manual Step-by-Step

```powershell
pnpm run electron:build-api     # Build Express API
pnpm run electron:build-app     # Build Vite web app
pnpm run electron:build-main    # Compile Electron main/preload
pnpm exec electron-builder --config electron-builder.yml --win
```

## Testing

Run the installer:
```powershell
.\dist\installers\SwimManagerPro-Setup-1.0.0.exe
```

Or run unpacked:
```powershell
.\dist\installers\win-unpacked\"Swim Manager Pro.exe"
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Use pnpm instead` | Use `pnpm install`, not `npm install` |
| Missing modules during `electron:build-main` | Run `pnpm install` from repo root |
| Icon too small | Provide a 256x256 `.ico` at `build-resources\icon.ico` |
| Build hangs on first run | Downloading Electron/NSIS tooling — needs internet, cached after |
| Blank window | Ensure `electron:build-api` and `electron:build-app` ran successfully |
| Signing skipped | Expected for unsigned builds — add a code-signing cert to remove SmartScreen warnings |
