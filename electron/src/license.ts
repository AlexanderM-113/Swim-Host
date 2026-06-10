/**
 * Electron-side license validator.
 * On first activation: calls Cloudflare Worker to verify key + record machine.
 * On subsequent launches: validates from locally cached license file (offline).
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import os from "os";

export interface LicenseData {
  key: string;
  clubCode: string;
  clubName: string;
  tier: string;
  expiresAt: string;
  activatedAt: string;
  machineId: string;
}

const WORKER_URL = process.env.LICENSE_WORKER_URL ?? "https://swimmanager-license.YOUR-SUBDOMAIN.workers.dev";

function getLicensePath(userDataPath: string): string {
  return path.join(userDataPath, "license.json");
}

function getMachineId(): string {
  const id = `${os.hostname()}-${os.platform()}-${os.arch()}`;
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

/** Read cached license from disk — works fully offline. */
export function readCachedLicense(userDataPath: string): LicenseData | null {
  const p = getLicensePath(userDataPath);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as LicenseData;
  } catch {
    return null;
  }
}

/** Save license to disk after successful activation. */
function saveLicense(userDataPath: string, data: LicenseData): void {
  fs.mkdirSync(userDataPath, { recursive: true });
  fs.writeFileSync(getLicensePath(userDataPath), JSON.stringify(data, null, 2), "utf8");
}

/** Revoke the local license (e.g. user clicked "Deactivate"). */
export function revokeLicense(userDataPath: string): void {
  const p = getLicensePath(userDataPath);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

/**
 * Activate a key by calling the Cloudflare Worker.
 * Returns the license data on success, throws on failure.
 */
export async function activateLicense(
  userDataPath: string,
  key: string
): Promise<LicenseData> {
  const machineId = getMachineId();

  let res: Response;
  try {
    res = await fetch(`${WORKER_URL}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: key.trim().toUpperCase(), machineId }),
    });
  } catch {
    throw new Error("Could not reach the license server. Check your internet connection and try again.");
  }

  const json = await res.json() as any;
  if (!json.ok) {
    throw new Error(json.error ?? "Invalid license key.");
  }

  const license: LicenseData = {
    key: key.trim().toUpperCase(),
    clubCode: json.clubCode,
    clubName: json.clubName,
    tier: json.tier,
    expiresAt: json.expiresAt,
    activatedAt: new Date().toISOString(),
    machineId,
  };

  saveLicense(userDataPath, license);
  return license;
}

/**
 * Full license check on every app launch.
 * 1. Reads cached license from disk.
 * 2. Checks expiry date.
 * 3. Returns the license or null.
 */
export function checkLicense(userDataPath: string): LicenseData | null {
  const license = readCachedLicense(userDataPath);
  if (!license) return null;
  if (isExpired(license.expiresAt)) return null;
  return license;
}
