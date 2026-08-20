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

/**
 * Die Stunde in Wiener Zeit, 0–23.
 *
 * Ausgelesen über formatToParts, nicht über Number(...format(...)): de-AT
 * formatiert eine Stunde als "18 Uhr", nicht als "18". Number("18 Uhr") ist
 * NaN, und jeder Vergleich gegen NaN ist falsch — genau daran scheiterte der
 * Gruß auf der Startseite, der deshalb rund um die Uhr "Gute Nacht" sagte.
 *
 * hourCycle "h23" statt hour12: false, damit Mitternacht 0 ergibt und nicht
 * 24 — h24 wäre in keinem Stundenbereich ein Treffer.
 *
 * Hier und nicht in der Seite, weil inzwischen drei Stellen sie brauchen:
 * der Gruß, die Koffein-Regel im Briefing und der MCP-Server. Die Zeitzone
 * gehört ohnehin in dieses Modul — es ist die eine Stelle, die entscheidet,
 * welcher Tag und welche Stunde in Wien gerade sind.
 */
export function wienerStunde(jetzt: Date = new Date()): number {
  const teil = new Intl.DateTimeFormat("de-AT", {
    hour: "numeric",
    hourCycle: "h23",
    timeZone: "Europe/Vienna",
  })
    .formatToParts(jetzt)
    .find((t) => t.type === "hour");

  return Number(teil?.value);
}
