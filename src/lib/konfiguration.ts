/**
 * Kadenz — Umgebungsvariablen an einer Stelle
 *
 * Warum ein eigenes Modul: dieselben Variablen brauchen die Seiten, die
 * API-Routen, die Server Actions und der MCP-Server. Solange die Prüfung nur
 * in google-health.ts stand, gab es sie überall sonst nicht — und eine
 * fehlende Variable fiel erst tief im Aufruf als 500 auf, ohne zu sagen,
 * welche fehlt.
 */

/**
 * Eigener Fehlertyp, damit Aufrufer "Variable fehlt" von "Google antwortet
 * gerade nicht" unterscheiden können. Das erste muss Jakob in den
 * Vercel-Einstellungen nachtragen, das zweite geht von selbst wieder weg.
 */
export class KonfigurationsFehler extends Error {
  readonly variablen: string[];

  constructor(variablen: string[]) {
    super(
      variablen.length === 1
        ? `Die Umgebungsvariable ${variablen[0]} ist nicht gesetzt.`
        : `Diese Umgebungsvariablen sind nicht gesetzt: ${variablen.join(", ")}.`
    );
    this.name = "KonfigurationsFehler";
    this.variablen = variablen;
  }
}

/**
 * instanceof allein reicht hier nicht: Next bündelt Module je nach Route
 * mehrfach, dann existiert die Klasse zweimal und der Vergleich schlägt fehl,
 * obwohl es derselbe Fehler ist. Der Name übersteht das Bündeln.
 */
export function istKonfigurationsFehler(e: unknown): e is KonfigurationsFehler {
  return e instanceof Error && e.name === "KonfigurationsFehler";
}

/** Liest eine Variable, die zwingend gesetzt sein muss. */
export function pflichtVariable(name: string): string {
  const wert = process.env[name]?.trim();
  if (!wert) throw new KonfigurationsFehler([name]);
  return wert;
}

/** Ohne diese beiden geht bei Google nichts — weder Login noch Datenabruf. */
const GOOGLE_PFLICHT = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"];

/**
 * Alle fehlenden Google-Variablen auf einmal, statt beim ersten abzubrechen.
 * Wer eine Meldung liest, will wissen, was insgesamt fehlt — nicht dreimal
 * hintereinander deployen, um es einzeln zu erfahren.
 */
export function fehlendeGoogleVariablen(): string[] {
  return GOOGLE_PFLICHT.filter((name) => !process.env[name]?.trim());
}

export function datenbankKonfiguriert(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

/** Setzt Vercel selbst in jeder Build- und Laufzeitumgebung. */
function aufVercel(): boolean {
  return process.env.VERCEL === "1";
}

/**
 * Öffentliche Basis-URL der App, ohne Schrägstrich am Ende.
 *
 * Die Reihenfolge ist Absicht:
 *  1. KADENZ_BASIS_URL — die eigene Domain. Nur sie bleibt über Deployments
 *     hinweg gleich und darf deshalb bei Google als Redirect-URI eingetragen
 *     werden.
 *  2. VERCEL_PROJECT_PRODUCTION_URL — die feste Produktions-Adresse des
 *     Projekts, auch aus einem Vorschau-Deployment heraus sichtbar.
 *  3. VERCEL_URL — die Adresse genau dieses einen Deployments. Ändert sich bei
 *     jedem Push und taugt deshalb zum Ausprobieren, nicht für OAuth.
 *  4. localhost für die Entwicklung.
 */
export function basisUrl(): string {
  const eigene = process.env.KADENZ_BASIS_URL?.trim();
  if (eigene) return ohneEndschraegstrich(mitSchema(eigene));

  const vercel = (
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL
  )?.trim();
  if (vercel) return ohneEndschraegstrich(mitSchema(vercel));

  return `http://localhost:${process.env.PORT?.trim() || "3000"}`;
}

/** Der Pfad, den die Callback-Route bedient — an einer Stelle, nicht zweimal. */
export const GOOGLE_CALLBACK_PFAD = "/api/auth/google/callback";

/**
 * Die redirect_uri für den Google-OAuth-Ablauf.
 *
 * Eine ausdrücklich gesetzte GOOGLE_REDIRECT_URI gewinnt, weil in der Google
 * Cloud Console eine exakte Zeichenkette hinterlegt ist und die notfalls von
 * Hand überschreibbar bleiben muss.
 *
 * Eine Ausnahme davon: zeigt sie auf localhost, während wir auf Vercel laufen,
 * wird sie verworfen. Genau das passiert, wenn man .env.local eins zu eins in
 * die Vercel-Variablen kopiert — und von außen sieht man davon nur ein
 * "redirect_uri_mismatch" bei Google, das nichts über die Ursache sagt.
 */
export function googleRedirectUri(): string {
  const gesetzt = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (gesetzt && !(aufVercel() && zeigtAufLocalhost(gesetzt))) return gesetzt;
  return `${basisUrl()}${GOOGLE_CALLBACK_PFAD}`;
}

function mitSchema(wert: string): string {
  return wert.includes("://") ? wert : `https://${wert}`;
}

function ohneEndschraegstrich(wert: string): string {
  return wert.endsWith("/") ? wert.slice(0, -1) : wert;
}

function zeigtAufLocalhost(uri: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(uri);
}
