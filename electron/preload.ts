import { contextBridge, ipcRenderer } from "electron";

/**
 * Exposes a secure bridge from the Electron main process to the renderer.
 * All IPC calls go through this preload — contextIsolation is enabled so
 * the renderer has no direct access to Node APIs.
 */

export interface ElectronBridge {
  isElectron: true;
  validateLicense: (key: string) => Promise<import("./license").ValidationResult>;
  getCurrentLicense: () => Promise<import("./license").LicenseInfo | null>;
  getClubConfig: () => Promise<ClubConfig | null>;
  activationComplete: () => Promise<void>;
}

export interface ClubConfig {
  clubName: string;
  clubCode: string;
  licenseKey: string;
  apiHost: string;      // defaults to "localhost"; set to LAN IP for multi-seat
  liveRelayUrl: string; // URL of the live-relay server, e.g. "https://relay.swimmanagerpro.com"
}

contextBridge.exposeInMainWorld("electronBridge", {
  isElectron: true,
  validateLicense: (key: string) =>
    ipcRenderer.invoke("license:validate", key),
  getCurrentLicense: () =>
    ipcRenderer.invoke("license:current"),
  getClubConfig: () =>
    ipcRenderer.invoke("club-config:get"),
  activationComplete: () =>
    ipcRenderer.invoke("activation:complete"),
} satisfies ElectronBridge);
