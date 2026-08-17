import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Next lädt .env.local automatisch, die Prisma-CLI nicht — daher explizit.
// Auf Vercel gibt es die Datei nicht; dotenv meldet das und macht weiter.
config({ path: ".env.local" });

/**
 * Prisma 7 hat `url` und `directUrl` aus schema.prisma entfernt; die
 * Verbindungsdaten stehen jetzt hier.
 *
 * Wichtig für Supabase: hier steht bewusst DIRECT_URL (Port 5432, Session-
 * Modus). Der Pool auf Port 6543 läuft im Transaktionsmodus und kann keine
 * Migrationen ausführen — dort fehlen Prepared Statements und Advisory Locks.
 * Die laufende App nutzt umgekehrt den Pool, siehe src/lib/db.ts.
 *
 * Warum kein env("DIRECT_URL") aus prisma/config mehr: dessen env() wirft
 * schon beim Laden dieser Datei, wenn die Variable fehlt. Auf Vercel läuft
 * aber `prisma generate` im postinstall — und generate braucht überhaupt keine
 * Datenbankverbindung. Der Build wäre also an einer Variable gescheitert, die
 * er nie benutzt. Fehlt sie beim tatsächlichen Migrieren, sagt Prisma das von
 * selbst.
 */
const direkteVerbindung = process.env.DIRECT_URL?.trim();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  ...(direkteVerbindung ? { datasource: { url: direkteVerbindung } } : {}),
});
