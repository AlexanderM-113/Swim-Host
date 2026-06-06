import app from "./app";
import { logger } from "./lib/logger";

// Portability: default to 8080 when PORT is unset so the server runs anywhere,
// not just on Replit (which always injects PORT).
const DEFAULT_PORT = 8080;
const rawPort = process.env["PORT"];
const parsedPort = rawPort ? Number(rawPort) : NaN;

if (rawPort && (Number.isNaN(parsedPort) || parsedPort <= 0)) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const port = !Number.isNaN(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT;

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
