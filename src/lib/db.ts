// ─────────────────────────────────────────────────────────────
// Prisma Client Singleton
// ─────────────────────────────────────────────────────────────
// In development, Next.js hot-reloads modules on every save.
// Without a singleton, each reload creates a NEW PrismaClient
// instance, quickly exhausting database connections.
//
// This pattern stores the client on `globalThis` so it survives
// hot reloads. In production, this is a normal single instance.
// ─────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
