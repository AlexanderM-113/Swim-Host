// Centralized, de-duplicated error notifications.
//
// Every user-facing error should flow through `notifyError` so that (a) it's
// recorded in the logger, and (b) the user isn't spammed with the same toast
// over and over. Identical messages are suppressed for a short window.

import { toast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";

const DEDUPE_WINDOW_MS = 4000;
const recentToasts = new Map<string, number>();

export function messageFromError(err: unknown, fallback = "Something went wrong"): string {
  if (err instanceof Error) return err.message || fallback;
  if (typeof err === "string") return err || fallback;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}

/**
 * Show a destructive toast for an error, de-duplicated by message, and log it.
 * Returns true if a toast was actually shown (false if suppressed as a dupe).
 */
export function notifyError(
  title: string,
  err: unknown,
  opts?: { detail?: unknown; logMessage?: string },
): boolean {
  const description = messageFromError(err);
  logger.error(opts?.logMessage ?? title, opts?.detail ?? err);

  const key = `${title}::${description}`;
  const now = Date.now();
  const last = recentToasts.get(key);
  if (last && now - last < DEDUPE_WINDOW_MS) return false;
  recentToasts.set(key, now);

  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (recentToasts.size > 50) {
    for (const [k, t] of recentToasts) {
      if (now - t > DEDUPE_WINDOW_MS) recentToasts.delete(k);
    }
  }

  toast({
    title,
    description: description.length > 160 ? `${description.slice(0, 157)}…` : description,
    variant: "destructive",
  });
  return true;
}
