/**
 * SwimManager Pro — License Checker (Cloudflare Worker)
 * Paste this file into the Cloudflare Worker web editor.
 *
 * Routes:
 *   POST /activate        — customer app calls on first launch
 *   POST /admin/create    — YOU call to register a new key
 *   POST /admin/revoke    — YOU call to kill a key
 *   GET  /admin/list      — YOU call to see all keys
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function isAdmin(request, env) {
  return request.headers.get("X-Admin-Secret") === env.ADMIN_SECRET;
}

function normalizeKey(key) {
  return key.trim().toUpperCase().replace(/\s+/g, "");
}

// ─── POST /activate ───────────────────────────────────────────────────────────

async function handleActivate(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const { key, machineId } = body;
  if (!key || !machineId) {
    return json({ ok: false, error: "Missing key or machineId." }, 400);
  }

  const normalizedKey = normalizeKey(key);
  const record = await env.LICENSES.get(normalizedKey, "json");

  if (!record) {
    return json({ ok: false, error: "License key not found. Check the key and try again." }, 404);
  }

  if (record.revoked) {
    return json({ ok: false, error: "This license key has been revoked. Contact support." }, 403);
  }

  if (new Date(record.expiresAt) < new Date()) {
    return json({ ok: false, error: "This license key has expired. Contact support to renew." }, 403);
  }

  const maxActivations = parseInt(env.MAX_ACTIVATIONS || "3");
  const alreadyActivated = record.activations.find((a) => a.machineId === machineId);

  if (!alreadyActivated) {
    if (record.activations.length >= maxActivations) {
      return json({
        ok: false,
        error: `This key is already active on ${record.activations.length} computers (maximum: ${maxActivations}). Contact support to add more seats.`,
      }, 403);
    }
    record.activations.push({ machineId, activatedAt: new Date().toISOString() });
    await env.LICENSES.put(normalizedKey, JSON.stringify(record));
  }

  return json({
    ok: true,
    clubCode: record.clubCode,
    clubName: record.clubName,
    tier: record.tier,
    expiresAt: record.expiresAt,
  });
}

// ─── POST /admin/create ───────────────────────────────────────────────────────

async function handleAdminCreate(request, env) {
  if (!isAdmin(request, env)) {
    return json({ ok: false, error: "Unauthorized." }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const { key, clubCode, clubName, tier = "standard", expiresAt } = body;
  if (!key || !clubCode || !clubName || !expiresAt) {
    return json({ ok: false, error: "Missing required fields: key, clubCode, clubName, expiresAt." }, 400);
  }

  const normalizedKey = normalizeKey(key);
  const existing = await env.LICENSES.get(normalizedKey);
  if (existing) {
    return json({ ok: false, error: "A license with this key already exists." }, 409);
  }

  const record = {
    key: normalizedKey,
    clubCode,
    clubName,
    tier,
    expiresAt,
    createdAt: new Date().toISOString(),
    activations: [],
    revoked: false,
  };

  await env.LICENSES.put(normalizedKey, JSON.stringify(record));
  return json({ ok: true, key: normalizedKey });
}

// ─── POST /admin/revoke ───────────────────────────────────────────────────────

async function handleAdminRevoke(request, env) {
  if (!isAdmin(request, env)) {
    return json({ ok: false, error: "Unauthorized." }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const { key } = body;
  const normalizedKey = normalizeKey(key);
  const record = await env.LICENSES.get(normalizedKey, "json");

  if (!record) {
    return json({ ok: false, error: "Key not found." }, 404);
  }

  record.revoked = true;
  await env.LICENSES.put(normalizedKey, JSON.stringify(record));
  return json({ ok: true, message: `Key ${normalizedKey} revoked.` });
}

// ─── GET /admin/list ──────────────────────────────────────────────────────────

async function handleAdminList(request, env) {
  if (!isAdmin(request, env)) {
    return json({ ok: false, error: "Unauthorized." }, 401);
  }

  const list = await env.LICENSES.list();
  const records = await Promise.all(
    list.keys.map((k) => env.LICENSES.get(k.name, "json"))
  );

  return json({
    ok: true,
    total: records.length,
    licenses: records.filter(Boolean).map((r) => ({
      key: r.key,
      clubName: r.clubName,
      clubCode: r.clubCode,
      tier: r.tier,
      expiresAt: r.expiresAt,
      activations: r.activations.length,
      revoked: r.revoked,
    })),
  });
}

// ─── Main export (ES Module format — required) ───────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret",
        },
      });
    }

    if (request.method === "POST" && url.pathname === "/activate") {
      return handleActivate(request, env);
    }
    if (request.method === "POST" && url.pathname === "/admin/create") {
      return handleAdminCreate(request, env);
    }
    if (request.method === "POST" && url.pathname === "/admin/revoke") {
      return handleAdminRevoke(request, env);
    }
    if (request.method === "GET" && url.pathname === "/admin/list") {
      return handleAdminList(request, env);
    }

    return json({ ok: false, error: "Not found." }, 404);
  },
};
