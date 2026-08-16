import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Next lädt .env.local automatisch, die Prisma-CLI nicht — daher explizit.
config({ path: ".env.local" });

/**
 * Prisma 7 hat `url` und `directUrl` aus schema.prisma entfernt; die
 * Verbindungsdaten stehen jetzt hier.
 *
 * Wichtig für Supabase: hier steht bewusst DIRECT_URL (Port 5432, Session-
 * Modus). Der Pool auf Port 6543 läuft im Transaktionsmodus und kann keine
 * Migrationen ausführen — dort fehlen Prepared Statements und Advisory Locks.
 * Die laufende App nutzt umgekehrt den Pool, siehe src/lib/db.ts.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
