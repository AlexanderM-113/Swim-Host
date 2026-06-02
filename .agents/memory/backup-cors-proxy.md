---
name: Backup CORS proxy
description: Why the backup webhook must be proxied through the Express API server
---

The backup service originally used a direct browser `fetch()` to the user-configured webhook URL (e.g. webhook.site). This fails with a CORS error because webhook.site (and most webhook receivers) don't send `Access-Control-Allow-Origin` headers.

**Why:** Browsers enforce CORS. External webhook URLs rarely add the required CORS headers. The fix is to route the backup POST through the Express API server at `POST /api/backup/push`, which accepts `{ url, payload }` and forwards server-side — no CORS restriction applies server-to-server.

**How to apply:** Any time user-configurable external URLs need to be called from the browser, proxy them through the Express API server. The backup route is at `artifacts/api-server/src/routes/backup.ts`.
