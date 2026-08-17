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
 *
 * Zu DATABASE_URL: bewusst kein harter Abbruch beim Laden des Moduls. `next
 * build` importiert dieses Modul über die Seiten mit, und ein Fehler hier
 * würde den Build abbrechen statt später eine lesbare Meldung zu zeigen. Ob
 * die Variable gesetzt ist, prüfen die Aufrufer über datenbankKonfiguriert()
 * aus konfiguration.ts.
 */
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },

  // Serverless: jede Funktionsinstanz auf Vercel bekommt ihren eigenen Pool
  // und bearbeitet üblicherweise eine Anfrage zur Zeit. Mehr als eine
  // Verbindung pro Instanz bringt dort nichts, belegt aber Plätze im
  // Supavisor-Pool, den sich sämtliche gleichzeitig laufenden Instanzen
  // teilen. Der pg-Standard von 10 wäre bei ein paar parallelen Aufrufen
  // schon aufgebraucht.
  max: 1,

  // Eine eingefrorene Funktionsinstanz hält ihre Verbindung sonst weiter
  // belegt, obwohl sie nichts mehr tut.
  idleTimeoutMillis: 10_000,

  // Lieber ein schneller, klarer Fehler als eine Anfrage, die bis zum Timeout
  // der Funktion hängt und dann ohne Erklärung abbricht.
  connectionTimeoutMillis: 10_000,
});

/**
 * Ein Client pro Prozess, in allen Umgebungen.
 *
 * Im Dev-Modus lädt Next Module bei jeder Änderung neu — ohne diesen Cache
 * entstünde pro Reload ein neuer Pool, bis Supabase dichtmacht. Auf Vercel
 * gilt dasselbe aus einem anderen Grund: eine warme Instanz kann dieses Modul
 * über verschiedene Routen-Bündel mehrfach auswerten, und jeder Durchlauf
 * hinge sonst einen weiteren Pool an dieselbe Instanz.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

globalForPrisma.prisma = prisma;
