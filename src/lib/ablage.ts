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
  /** Wiederholungen in Reserve, falls schon angegeben. */
  rir?: number | null;
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
 * gesendete ist. Wurde der Satz inzwischen korrigiert oder die Reserve
 * nachgetragen, liegt dort eine neuere Fassung, die selbst noch unterwegs
 * ist. Der Zeitpunkt allein reicht dafür nicht: die Reserve-Angabe trägt
 * bewusst denselben wie der Satz.
 */
export function ausgangErledigt(satz: OffenerSatz): void {
  const alle = alleLesen();
  const k = schluessel(satz);
  const da = alle[k];
  if (
    da &&
    da.erfasstAm === satz.erfasstAm &&
    da.kg === satz.kg &&
    da.reps === satz.reps &&
    (da.rir ?? null) === (satz.rir ?? null)
  ) {
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

// ─────────────────────────────────────────────────────────────
// Satzanzahl je Übung — heute mehr oder weniger als geplant
// ─────────────────────────────────────────────────────────────

/**
 * Wie viele Sätze je Übung heute dazukommen (+1) oder wegfallen (−1).
 *
 * Am Gerät hängt, nicht am Server: die Änderung gilt für dieses eine
 * Training, auf dem Handy, auf dem es läuft. Abgehakte Zusatzsätze stehen
 * ohnehin in der Datenbank und erscheinen von dort wieder — gespeichert
 * werden muss nur, was noch offen ist. Je Tag und Einheit ein Eintrag,
 * ältere räumt das Lesen weg.
 */
const SATZZAHL = "kadenz_satzzahl";

export function satzzahlLesen(tag: string, einheit: Einheit): Record<string, number> {
  try {
    const alles = JSON.parse(localStorage.getItem(SATZZAHL) ?? "null") as {
      tag: string;
      einheit: Einheit;
      je: Record<string, number>;
    } | null;
    return alles && alles.tag === tag && alles.einheit === einheit ? alles.je : {};
  } catch {
    return {};
  }
}

export function satzzahlSchreiben(tag: string, einheit: Einheit, je: Record<string, number>): void {
  try {
    localStorage.setItem(SATZZAHL, JSON.stringify({ tag, einheit, je }));
  } catch {}
}
