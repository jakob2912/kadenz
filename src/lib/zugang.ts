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
 * Im Cookie liegt nicht das Passwort, sondern ein HMAC daraus. Wer das
 * Passwort ändert, meldet damit alle Geräte ab; ein gestohlenes Cookie verrät
 * das Passwort nicht. Läuft über WebCrypto, damit derselbe Code im Proxy und
 * in der Server Action rechnet.
 */

export const ZUGANG_COOKIE = "kadenz_zugang";

/** Ein Jahr: man meldet sich einmal pro Gerät an, nicht pro Woche. */
export const ZUGANG_MAX_ALTER = 60 * 60 * 24 * 365;

export function zugangsPasswort(): string | null {
  return process.env.KADENZ_PASSWORT?.trim() || null;
}

export async function zugangsToken(passwort: string): Promise<string> {
  const schluessel = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passwort),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", schluessel, new TextEncoder().encode("kadenz-zugang-v1"));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Vergleich in konstanter Zeit — die Antwortdauer verrät nichts über die Stelle des Fehlers. */
export function gleich(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
