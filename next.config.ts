import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Baut nach NEXT_DIST_DIR, falls gesetzt — sonst nach .next.
   *
   * .env.example versprach diese Umlenkung bereits ("Lenkt einen
   * Produktionsbau in ein anderes Verzeichnis, damit er ein parallel
   * laufendes `next dev` nicht überschreibt"), nur hat sie niemand
   * eingebaut: Next kennt von sich aus nur das interne __NEXT_DIST_DIR und
   * fällt sonst auf .next zurück. Ein `NEXT_DIST_DIR=.next-build next build`
   * schrieb damit trotzdem nach .next und riss dem laufenden Dev-Server das
   * Verzeichnis unter den Füßen weg — genau das, was der Hinweis verhindern
   * sollte.
   *
   * Auf Vercel ist die Variable nicht gesetzt, dort bleibt es bei .next.
   */
  distDir: process.env.NEXT_DIST_DIR?.trim() || ".next",

  /**
   * Cache Components — der Grund, warum der Wechsel zwischen den Tabs vorher
   * gehangen hat.
   *
   * Alle Seiten standen auf `dynamic = "force-dynamic"`, und keine hatte eine
   * Suspense-Grenze. Next musste damit den kompletten Server-Render abwarten,
   * bevor überhaupt etwas erschien: erst ein OAuth-Refresh zu Google, dann
   * vier Health-Abrufe, dazu die Datenbank. Bis dahin blieb der alte Tab
   * stehen, ohne jede Rückmeldung — und beim Zurückwechseln fing dasselbe
   * von vorne an, weil nichts wiederverwendet wurde.
   *
   * Das Flag bringt in Next 16 drei Dinge auf einmal, die genau diese drei
   * Beschwerden treffen:
   *
   *   - Partial Prerendering: die statische Hülle einer Seite (Kopfzeile,
   *     Karten-Gerüst, Tab-Leiste) ist vorgerendert und steht sofort da; die
   *     Teile, die auf Daten warten, strömen nach.
   *   - React <Activity>: eine verlassene Route wird nicht mehr abgebaut,
   *     sondern versteckt. Wer von Verlauf auf Essen und zurück wechselt,
   *     findet den Verlauf so vor, wie er ihn verlassen hat.
   *   - "use cache" / "use cache: private": geladene Daten lassen sich
   *     ausdrücklich behalten, statt bei jedem Aufruf neu geholt zu werden.
   *     Siehe loadDashboard() in src/lib/health-service.ts.
   *
   * Damit fällt `force-dynamic` überall weg. Was wirklich bei jedem Aufruf
   * frisch sein muss, sagt das jetzt an der Stelle, an der es gilt, statt
   * pauschal für eine ganze Seite.
   */
  cacheComponents: true,
};

export default nextConfig;
