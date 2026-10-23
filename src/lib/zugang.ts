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
 * Schlüssel (PBKDF2, 600 000 Runden). Wer das Passwort ändert, meldet damit
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
      // OWASP-Empfehlung für PBKDF2-SHA256. Kostet je Anmeldung rund eine
      // Viertelsekunde; der Proxy rechnet es je Prozess nur einmal.
      iterations: 600_000,
    },
    material,
    256
  );
  return Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, "0")).join("");
}

let gemerkt: { passwort: string; token: Promise<string> } | null = null;

/** Der erwartete Cookie-Wert, je Prozess einmal abgeleitet. */
export function erwartetesToken(passwort: string): Promise<string> {
  if (gemerkt?.passwort !== passwort) {
    const token = zugangsToken(passwort);
    // Ein Fehlschlag soll nicht für die ganze Lebensdauer des Prozesses
    // gemerkt bleiben — beim nächsten Aufruf wird neu abgeleitet.
    token.catch(() => {
      if (gemerkt?.token === token) gemerkt = null;
    });
    gemerkt = { passwort, token };
  }
  return gemerkt.token;
}

/**
 * Nur Pfade innerhalb von Kadenz als Ziel nach der Anmeldung. Ein
 * ?weiter=https://… würde aus der Anmeldung sonst eine Umleitung auf
 * beliebige Seiten machen.
 *
 * Aufgelöst wie der Browser es tut, statt am Text zu prüfen: "/\\evil.com"
 * beginnt mit einem einzelnen Schrägstrich, Browser lesen den Backslash aber
 * als zweiten. Und auch eine aufgelöste URL auf dem eigenen Host reicht
 * nicht: "/.//evil.com" bleibt beim Auflösen zu Hause, hat aber den Pfad
 * "//evil.com" — und den liest der Browser beim Umleiten wieder als fremden
 * Host. Deshalb zusätzlich: der Pfad darf nicht mit zwei Schrägstrichen
 * beginnen.
 */
export function sicheresZiel(weiter: unknown): string {
  const roh = typeof weiter === "string" ? weiter : "/";
  try {
    const basis = "http://kadenz.invalid";
    const url = new URL(roh, basis);
    if (url.origin !== basis || url.pathname.startsWith("//")) return "/";
    return `${url.pathname}${url.search}`;
  } catch {
    return "/";
  }
}

/** Vergleich in konstanter Zeit — die Antwortdauer verrät nichts über die Stelle des Fehlers. */
export function gleich(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
