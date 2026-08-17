/**
 * Kadenz — Kalendertag in Wiener Zeit
 *
 * Warum ein eigenes Modul: die Frage "welcher Tag ist das?" stellen die
 * Startseite, der Verlauf, die Rotation in plan.ts und die Trainingslogs in
 * workouts.ts. Bisher stand die Antwort nur in components/ui.tsx — und ui.tsx
 * ist eine Server-Komponente mit next/link, die weder eine "use server"-Datei
 * noch der Client-Graph importieren darf. Also lag dieselbe Frage an drei
 * Stellen unterschiedlich beantwortet herum: ui.tsx rechnete in Wiener Zeit,
 * plan.ts und workouts.ts in Prozesszeit.
 *
 * Der Unterschied fällt lokal nie auf, weil der Rechner in Wien steht. Auf
 * Vercel laufen die Server in UTC, und dann liegt zwischen Mitternacht und
 * 02:00 Wiener Zeit ein Kalendertag Unterschied: die Rotation zeigte dort den
 * Rest Day statt Push, und ein Satz landete am Vortag.
 */

/**
 * Kalendertag eines Zeitpunkts in Wiener Zeit, als YYYY-MM-DD.
 *
 * en-CA liefert genau dieses Format; die Formatierung stammt unverändert aus
 * heuteWien() und rendert seit jeher die Startseite.
 */
export function wienerDatum(zeitpunkt: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Vienna",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(zeitpunkt);
}

/** Heutiger Tag als ISO, ausdrücklich in Wiener Zeit statt in Serverzeit. */
export function heuteWien(): string {
  return wienerDatum(new Date());
}
