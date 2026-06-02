import { Router } from "express";

const router = Router();

router.post("/backup/push", async (req, res) => {
  const { url, payload } = req.body as { url: string; payload: unknown };

  if (!url) {
    res.status(400).json({ error: "url is required" });
    return;
  }

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    if (!upstream.ok) {
      res.status(502).json({
        error: `Remote server responded ${upstream.status} ${upstream.statusText}`,
      });
      return;
    }

    res.json({ success: true, status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: message });
  }
});

export default router;
