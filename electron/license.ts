import crypto from "crypto";

/**
 * Offline HMAC-SHA256 license key validator for Swim Manager Pro.
 *
 * Key format:  SMP-{BASE64URL_JSON_PAYLOAD}-{HEX_HMAC_SHA256}
 *
 * Payload JSON (base64url-encoded):
 *   { clubName, clubCode, expiresAt (ISO-8601), tier, issuedAt (ISO-8601) }
 *
 * To generate keys offline use the companion key-tool (scripts/gen-license-key.ts).
 * Contact: licensing@sunrayllc.com
 */

// ── Secret ──────────────────────────────────────────────────────────────────
// Change this before distributing a production build.
// Keep it out of version control — replace with an env-injected build constant.
const HMAC_SECRET =
  process.env.SMP_LICENSE_SECRET ??
  "SMP-SUNRAY-LLC-AZ-2026-SWIMMANAGER-PRO-SECRET-v1";

export type LicenseTier = "starter" | "standard" | "professional";

export interface LicensePayload {
  clubName: string;
  clubCode: string;
  expiresAt: string;
  tier: LicenseTier;
  issuedAt: string;
}

export interface LicenseInfo extends LicensePayload {
  key: string;
}

export interface ValidationResult {
  valid: boolean;
  info: LicenseInfo | null;
  error?: string;
}

// ── Generator (used by the key-tool script) ─────────────────────────────────

export function generateLicenseKey(payload: LicensePayload): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const hmac = crypto
    .createHmac("sha256", HMAC_SECRET)
    .update(payloadB64)
    .digest("hex");
  return `SMP-${payloadB64}-${hmac}`;
}

// ── Validator ────────────────────────────────────────────────────────────────

export function validateLicense(key: string): ValidationResult {
  if (!key || typeof key !== "string") {
    return { valid: false, info: null, error: "No license key provided." };
  }

  const trimmed = key.trim();

  // Must start with "SMP-"
  if (!trimmed.startsWith("SMP-")) {
    return {
      valid: false,
      info: null,
      error: 'Invalid key format — keys begin with "SMP-".',
    };
  }

  // Split off the last segment (64 hex chars = SHA-256) as the HMAC
  const lastDash = trimmed.lastIndexOf("-");
  if (lastDash <= 4) {
    return { valid: false, info: null, error: "Invalid key format." };
  }

  const payloadPart = trimmed.slice(4, lastDash);   // between SMP- and last -
  const hmacPart    = trimmed.slice(lastDash + 1);   // after last -

  if (hmacPart.length !== 64) {
    return { valid: false, info: null, error: "Invalid key format." };
  }

  // Constant-time HMAC comparison
  const expectedHmac = crypto
    .createHmac("sha256", HMAC_SECRET)
    .update(payloadPart)
    .digest("hex");

  let hmacOk: boolean;
  try {
    hmacOk = crypto.timingSafeEqual(
      Buffer.from(hmacPart,    "hex"),
      Buffer.from(expectedHmac, "hex"),
    );
  } catch {
    return {
      valid: false,
      info: null,
      error: "License key is invalid. Please check and try again.",
    };
  }

  if (!hmacOk) {
    return {
      valid: false,
      info: null,
      error: "License key is invalid. Please check and try again.",
    };
  }

  // Decode payload
  let payload: LicensePayload;
  try {
    payload = JSON.parse(
      Buffer.from(payloadPart, "base64url").toString("utf-8"),
    ) as LicensePayload;
  } catch {
    return { valid: false, info: null, error: "License key is corrupted." };
  }

  if (!payload.clubName || !payload.clubCode || !payload.expiresAt || !payload.tier) {
    return { valid: false, info: null, error: "License key is missing required fields." };
  }

  // Expiry check
  if (new Date(payload.expiresAt) < new Date()) {
    return {
      valid: false,
      info: null,
      error: `This license expired on ${new Date(payload.expiresAt).toLocaleDateString()}. Please contact licensing@sunrayllc.com to renew.`,
    };
  }

  return { valid: true, info: { ...payload, key: trimmed } };
}
