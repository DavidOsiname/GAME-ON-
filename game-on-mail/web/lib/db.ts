import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString && process.env.NODE_ENV === "production") {
  throw new Error("DATABASE_URL must be configured in production.");
}

const globalForGameOn = globalThis as typeof globalThis & {
  gameOnMailPool?: Pool;
};

function createPool(): Pool {
  return new Pool({
    connectionString:
      connectionString ??
      "postgresql://gameon_mail_dev:local-placeholder-password@127.0.0.1:5432/gameon_mail",
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    allowExitOnIdle: process.env.NODE_ENV !== "production",
    ssl:
      process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: true }
        : undefined,
  });
}

export const db = globalForGameOn.gameOnMailPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForGameOn.gameOnMailPool = db;
}
