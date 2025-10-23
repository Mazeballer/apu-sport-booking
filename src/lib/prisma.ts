// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

// Give globalThis a typed slot to hold the Prisma instance in dev (to avoid hot-reload duplicates)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['warn', 'error'], // optional
  });

// In dev, store the instance on globalThis. In production, let it be GC'd normally.
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
