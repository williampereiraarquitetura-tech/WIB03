import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];
const port = rawPort ? Number(rawPort) : 3000;

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Enable pgvector extension (idempotent — safe to run on every startup)
pool.query("CREATE EXTENSION IF NOT EXISTS vector;")
  .then(() => logger.info("pgvector extension ready"))
  .catch((err) => logger.warn({ err }, "pgvector extension setup skipped"));

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
