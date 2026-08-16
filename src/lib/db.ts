import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma";

/**
 * Prisma 7 spricht nicht mehr selbst mit Postgres, sondern über einen
 * Treiber-Adapter. Zur Laufzeit läuft alles über den Supabase-Pool
 * (Port 6543, Transaktionsmodus) — Migrationen dagegen über die
 * Direktverbindung, siehe prisma.config.ts.
 *
 * Zum TLS: Supabase signiert das Pooler-Zertifikat mit einer eigenen CA, die
 * nicht im System-Zertifikatsspeicher liegt. Node lehnt es deshalb mit
 * SELF_SIGNED_CERT_IN_CHAIN ab. Die Verbindung ist verschlüsselt, aber der
 * Server wird nicht verifiziert. Sauber wäre, Supabases CA-Zertifikat
 * mitzuliefern und hier zu hinterlegen — das steht noch aus.
 */
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Im Dev-Modus lädt Next Module bei jeder Änderung neu. Ohne diesen Cache
// entstünde pro Reload ein neuer Pool, bis Supabase die Verbindungen dichtmacht.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
