/**
 * Kadenz — was der Logger im Browser festhält, damit es ein Neuladen übersteht
 *
 * iOS beendet eine installierte Web-App im Hintergrund, wann es will — gern
 * genau in der Satzpause, wenn das Handy gesperrt in der Tasche liegt. Beim
 * Zurückkommen lädt die Seite frisch. Alles, was bis dahin nur im React-State
 * lag, ist dann weg: die laufende Pause und, schlimmer, Sätze, die ohne Netz
 * abgehakt wurden und noch auf dem Weg zum Server waren.
 *
 * Beides liegt deshalb zusätzlich im localStorage. Jeder Zugriff ist in
 * try/catch — im privaten Fenster wirft localStorage, und dann gilt eben nur
 * der Speicher, nicht die Ablage.
 */

import { wienerDatum } from "./datum";

type Einheit = "push" | "pull";

// ─────────────────────────────────────────────────────────────
// Satzpause
// ─────────────────────────────────────────────────────────────

const PAUSE = "kadenz_satzpause";

export type GespeichertePause = { ende: number; dauer: number; einheit: Einheit };

export function pauseLesen(einheit: Einheit): GespeichertePause | null {
  try {
    const p = JSON.parse(localStorage.getItem(PAUSE) ?? "null") as GespeichertePause | null;
    return p?.einheit === einheit && typeof p.ende === "number" ? p : null;
  } catch {
    return null;
  }
}

/**
 * Geschrieben wird an den Stellen, an denen sich die Pause ändert (abhaken,
 * +30 s, Weiter, abgelaufen) — nicht aus einem Effekt, der dem State
 * hinterherläuft. Ein solcher Effekt schrieb beim ersten Rendern "keine
 * Pause" und löschte den Eintrag, bevor ihn jemand lesen konnte.
 */
export function pauseSchreiben(pause: GespeichertePause | null): void {
  try {
    if (pause === null) localStorage.removeItem(PAUSE);
    else localStorage.setItem(PAUSE, JSON.stringify(pause));
  } catch {}
}

// ─────────────────────────────────────────────────────────────
// Ausgang — Sätze, die noch nicht beim Server angekommen sind
// ─────────────────────────────────────────────────────────────

const AUSGANG = "kadenz_ausgang";

export type OffenerSatz = {
  kind: Einheit;
  exercise: string;
  setIndex: number;
  kg: number;
  reps: number;
  erfasstAm: number;
};

/** Länger hält der Server einen nachgereichten Satz ohnehin nicht für glaubhaft. */
const HOECHSTALTER_MS = 18 * 3600_000;

/**
 * Mit dem Tag: ohne ihn überschrieb der erste Satz von heute einen offenen
 * Satz von gestern Abend mit derselben Übung und Satznummer — der von gestern
 * wäre nie angekommen.
 */
function schluessel(s: Pick<OffenerSatz, "kind" | "exercise" | "setIndex" | "erfasstAm">): string {
  return `${wienerDatum(new Date(s.erfasstAm))}|${s.kind}|${s.exercise}|${s.setIndex}`;
}

function alleLesen(): Record<string, OffenerSatz> {
  try {
    return JSON.parse(localStorage.getItem(AUSGANG) ?? "{}") as Record<string, OffenerSatz>;
  } catch {
    return {};
  }
}

function alleSchreiben(alle: Record<string, OffenerSatz>): void {
  try {
    if (Object.keys(alle).length === 0) localStorage.removeItem(AUSGANG);
    else localStorage.setItem(AUSGANG, JSON.stringify(alle));
  } catch {}
}

/**
 * Vor dem Senden ablegen. Ein zweites Abhaken desselben Satzes (Korrektur)
 * überschreibt den Eintrag — gesendet wird ohnehin per Upsert.
 */
export function ausgangAblegen(satz: OffenerSatz): void {
  const alle = alleLesen();
  alle[schluessel(satz)] = satz;
  alleSchreiben(alle);
}

/**
 * Nach erfolgreichem Senden entfernen — aber nur, wenn der Eintrag noch der
 * gesendete ist. Wurde der Satz inzwischen korrigiert, liegt dort eine neuere
 * Fassung, die selbst noch unterwegs ist.
 */
export function ausgangErledigt(satz: OffenerSatz): void {
  const alle = alleLesen();
  const k = schluessel(satz);
  if (alle[k]?.erfasstAm === satz.erfasstAm) {
    delete alle[k];
    alleSchreiben(alle);
  }
}

/**
 * Was noch offen ist — alle Einheiten, auch von gestern Abend: der Server
 * ordnet jeden Satz über erfasstAm seinem Tag zu. Zu Altes wird verworfen.
 */
export function ausgangOffen(jetzt: number): OffenerSatz[] {
  const alle = alleLesen();
  let verworfen = false;
  for (const [k, s] of Object.entries(alle)) {
    if (jetzt - s.erfasstAm > HOECHSTALTER_MS) {
      delete alle[k];
      verworfen = true;
    }
  }
  if (verworfen) alleSchreiben(alle);
  return Object.values(alle);
}
