import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// ── Health check (used by Electron main to detect readiness) ─────────────────
app.get("/api/health", (_req, res) => { res.json({ ok: true }); });

// ── Static frontend (Electron / production) ───────────────────────────────────
// In Electron the built Vite files are placed under resources/public.
// STATIC_DIR can be set to any absolute path; defaults to resources/public
// relative to the running executable.
if (process.env["NODE_ENV"] === "production") {
  const staticDir =
    process.env["STATIC_DIR"] ??
    path.join(
      path.dirname(process.execPath),
      "resources",
      "public",
    );

  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    // SPA fallback — any non-API route returns index.html
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(path.join(staticDir, "index.html"));
    });
    logger.info({ staticDir }, "Serving frontend static files");
  } else {
    logger.warn({ staticDir }, "Static dir not found — frontend not served");
  }
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
