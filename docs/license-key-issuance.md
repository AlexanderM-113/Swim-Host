# SwimManager Pro — License Key Guide

All licensing is **offline** — keys are self-contained HMAC-signed tokens validated
locally in the Electron app. No server calls are required.

---

## Key Format

```
SMP-{base64url-payload}-{sha256-hmac}
```

The payload is a JSON object encoded as base64url:

```json
{
  "clubName": "Sharks Swim Club",
  "clubCode": "SHARKS",
  "tier": "standard",
  "issuedAt": "2026-06-23T00:00:00.000Z",
  "expiresAt": "2027-06-23T00:00:00.000Z"
}
```

---

## Generating a Key

Run the generator from the repo root:

```powershell
npx tsx scripts/gen-license-key.ts
```

It will prompt for:

| Field | Example |
|-------|---------|
| Club name | Sharks Swim Club |
| Club code | SHARKS |
| Tier | `starter` / `standard` / `professional` |
| Valid for days | 365 |

The key is printed to the console — copy it and send it to the customer.

### HMAC Secret

By default, the generator and the Electron app both use a built-in secret.
To use your own, set the `SMP_LICENSE_SECRET` environment variable before
generating keys **and** before building the Electron app:

```powershell
$env:SMP_LICENSE_SECRET = "your-secret-here"
npx tsx scripts/gen-license-key.ts
```

---

## How Activation Works

1. User opens the app for the first time → activation window appears.
2. User pastes the key → the app validates the HMAC signature and expiry date locally.
3. If valid, the key is saved to `%APPDATA%\Swim Manager Pro\license.json`.
4. On subsequent launches the app reads the cached key and re-validates offline.

---

## Tiers

| Tier | Intended Use |
|------|--------------|
| `starter` | Small clubs, basic features |
| `standard` | Full feature access |
| `professional` | Multi-club / advanced integrations |

Tier enforcement is done via the `LicenseGate` component in the frontend.

---

## Revoking a Key

Since keys are validated offline, revocation means issuing a new key with an
updated expiry. The old key continues to work until its expiry date passes.

---

## Record Keeping

Keep a spreadsheet of issued keys:

| Key | Club | Tier | Issued | Expires | Customer Email |
|-----|------|------|--------|---------|----------------|
| SMP-… | Sharks SC | standard | 2026-06-23 | 2027-06-23 | coach@sharks.com |

---

## Security

- **Never commit your `SMP_LICENSE_SECRET`** — inject it at build time.
- The default secret in the source is for development only.
- Keys are tamper-proof: changing any byte invalidates the HMAC.
