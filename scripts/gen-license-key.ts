#!/usr/bin/env node
/**
 * Swim Manager Pro — Offline License Key Generator
 * Usage: npx tsx scripts/gen-license-key.ts
 *
 * Set SMP_LICENSE_SECRET env var to match the secret in electron/license.ts
 * before generating production keys.
 */

import crypto from "crypto";
import readline from "readline";

const HMAC_SECRET =
  process.env["SMP_LICENSE_SECRET"] ??
  "SMP-SUNRAY-LLC-AZ-2026-SWIMMANAGER-PRO-SECRET-v1";

type LicenseTier = "starter" | "standard" | "professional";

interface LicensePayload {
  clubName: string;
  clubCode: string;
  expiresAt: string;
  tier: LicenseTier;
  issuedAt: string;
}

function generateKey(payload: LicensePayload): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const hmac = crypto
    .createHmac("sha256", HMAC_SECRET)
    .update(payloadB64)
    .digest("hex");
  return `SMP-${payloadB64}-${hmac}`;
}

function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log("\n🏊 Swim Manager Pro — License Key Generator");
  console.log("=".repeat(50));
  console.log("Secret: " + HMAC_SECRET.slice(0, 12) + "…\n");

  const clubName = await prompt(rl, "Club name:    ");
  const clubCode = (await prompt(rl, "Club code:    ")).toUpperCase();
  const tierRaw  = await prompt(rl, "Tier (starter/standard/professional): ");
  const daysStr  = await prompt(rl, "Valid for days (e.g. 365):  ");
  rl.close();

  const tier = (["starter", "standard", "professional"].includes(tierRaw)
    ? tierRaw
    : "standard") as LicenseTier;

  const days     = parseInt(daysStr, 10) || 365;
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();

  const payload: LicensePayload = { clubName, clubCode, expiresAt, tier, issuedAt };
  const key = generateKey(payload);

  console.log("\n" + "=".repeat(72));
  console.log("GENERATED LICENSE KEY:");
  console.log(key);
  console.log("=".repeat(72));
  console.log(`Club:     ${clubName} (${clubCode})`);
  console.log(`Tier:     ${tier}`);
  console.log(`Issued:   ${new Date(issuedAt).toDateString()}`);
  console.log(`Expires:  ${new Date(expiresAt).toDateString()}  (${days} days)`);
  console.log("=".repeat(72) + "\n");
}

main().catch(console.error);
