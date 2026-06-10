/**
 * License Key Generator — run this on YOUR computer to create keys for customers.
 *
 * Usage:
 *   npx tsx scripts/generate-key.ts <clubCode> "<clubName>" <tier> <expiryYear>
 *
 * Example:
 *   npx tsx scripts/generate-key.ts sharks "Sharks Swim Club" pro 2027
 *
 * Then run the --register flag to save it to Cloudflare:
 *   npx tsx scripts/generate-key.ts sharks "Sharks Swim Club" pro 2027 --register
 *
 * Required env:
 *   WORKER_URL     = https://swimmanager-license.<your-subdomain>.workers.dev
 *   ADMIN_SECRET   = the same ADMIN_SECRET you put in wrangler.toml
 */

import crypto from "crypto";

const WORKER_URL = process.env.WORKER_URL ?? "";
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";

function generateKey(): string {
  return crypto.randomBytes(8).toString("hex").toUpperCase();
}

function formatKey(raw: string): string {
  return `SWIM-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
}

async function main() {
  const [, , clubCode, clubName, tier = "standard", expiryYear = String(new Date().getFullYear() + 1)] = process.argv;
  const register = process.argv.includes("--register");

  if (!clubCode || !clubName) {
    console.error("Usage: npx tsx scripts/generate-key.ts <clubCode> \"<clubName>\" [tier] [expiryYear] [--register]");
    process.exit(1);
  }

  const rawKey = generateKey();
  const formattedKey = formatKey(rawKey);

  console.log("\n=== New License Key ===");
  console.log(`Key:        ${formattedKey}`);
  console.log(`Club:       ${clubName} (${clubCode})`);
  console.log(`Tier:       ${tier}`);
  console.log(`Expires:    ${expiryYear}`);
  console.log("======================\n");

  if (register) {
    if (!WORKER_URL || !ADMIN_SECRET) {
      console.error("Set WORKER_URL and ADMIN_SECRET in your environment to register the key.");
      process.exit(1);
    }

    const res = await fetch(`${WORKER_URL}/admin/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Secret": ADMIN_SECRET,
      },
      body: JSON.stringify({
        key: formattedKey,
        clubCode,
        clubName,
        tier,
        expiresAt: `${expiryYear}-12-31`,
      }),
    });

    const json = await res.json() as any;
    if (json.ok) {
      console.log("✅ Key registered in Cloudflare KV. Ready to send to customer.");
    } else {
      console.error("❌ Registration failed:", json.error);
    }
  } else {
    console.log("(Key not yet registered — re-run with --register to save it to Cloudflare)");
  }
}

main();
