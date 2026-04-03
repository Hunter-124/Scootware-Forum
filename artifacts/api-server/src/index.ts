import "dotenv/config";
import app from "./app";
import { logger } from "./lib/logger";
import { startCryptoMonitor } from "./lib/crypto-monitor";


const rawPort = process.env["PORT"] || "3000";
const port = Number(rawPort);

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Start background crypto payment monitoring loop
  startCryptoMonitor().catch(err => {
    logger.error({ err }, "Failed to start crypto monitor");
  });
});

// Export a close function for graceful shutdown
export function close(cb) {
  server.close(cb);
}
