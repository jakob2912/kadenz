/**
 * Kadenz — Zugangsschutz
 *
 * Bis hierher war Kadenz offen: wer die Vercel-Adresse kannte, sah Schlaf,
 * Ruhepuls, HRV und Gewicht, und jede Server Action — Satz speichern,
 * Kalorienziel annehmen, Trainingsmax setzen — nahm Aufrufe von überall an.
 * Die Adresse ist nicht geheim; sie steht in jedem geteilten Link und in
 * Vercels öffentlicher Deployment-Liste.
 *
 * Der Schutz ist ein einziges Passwort aus der Umgebungsvariable
 * KADENZ_PASSWORT. Ist sie nicht gesetzt, bleibt alles wie bisher — so sperrt
 * ein Deployment niemanden aus, bevor die Variable bei Vercel eingetragen ist.
 *
 * Im Cookie liegt nicht das Passwort, sondern ein daraus abgeleiteter
 * Schlüssel (PBKDF2, 100 000 Runden). Wer das Passwort ändert, meldet damit
 * alle Geräte ab. Die Runden sind der Punkt: aus einem gestohlenen Cookie
 * ließe sich ein schnell gehashtes Passwort offline durchprobieren, mit
 * PBKDF2 kostet jeder Versuch spürbar Zeit. Läuft über WebCrypto, damit
 * derselbe Code im Proxy und in der Server Action rechnet; der Proxy merkt
 * sich das Ergebnis, statt es bei jeder Anfrage neu abzuleiten.
 */

export const ZUGANG_COOKIE = "kadenz_zugang";

/** Ein Jahr: man meldet sich einmal pro Gerät an, nicht pro Woche. */
export const ZUGANG_MAX_ALTER = 60 * 60 * 24 * 365;

export function zugangsPasswort(): string | null {
  return process.env.KADENZ_PASSWORT?.trim() || null;
}

export async function zugangsToken(passwort: string): Promise<string> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passwort),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      // Fest statt zufällig: es gibt genau ein Passwort, und der Proxy muss
      // aus ihm ohne Datenbank denselben Wert ableiten können.
      salt: new TextEncoder().encode("kadenz-zugang-v2"),
      iterations: 100_000,
    },
    material,
    256
  );
  return Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, "0")).join("");
}

let gemerkt: { passwort: string; token: Promise<string> } | null = null;

/** Der erwartete Cookie-Wert, je Prozess einmal abgeleitet. */
export function erwartetesToken(passwort: string): Promise<string> {
  if (gemerkt?.passwort !== passwort) gemerkt = { passwort, token: zugangsToken(passwort) };
  return gemerkt.token;
}

/** Vergleich in konstanter Zeit — die Antwortdauer verrät nichts über die Stelle des Fehlers. */
export function gleich(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
