import app from "./app";
import { logger } from "./lib/logger";
import { startScheduler, stopScheduler } from "./engine/scheduler";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  const schedulerIntervalMs = process.env["SCHEDULER_INTERVAL_MS"]
    ? Number(process.env["SCHEDULER_INTERVAL_MS"])
    : 10000;
  startScheduler(schedulerIntervalMs);
});

// Graceful shutdown handling
function shutdown(signal: string) {
  logger.info({ signal }, "Received shutdown signal. Stopping scheduler and closing HTTP server...");
  stopScheduler();
  server.close((err) => {
    if (err) {
      logger.error({ err }, "Error closing HTTP server");
      process.exit(1);
    }
    logger.info("HTTP server closed cleanly.");
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

