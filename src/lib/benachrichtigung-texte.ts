/**
 * Kadenz — was in den geplanten Nachrichten steht
 *
 * Rein und ohne Datenbank, damit die Texte testbar sind. Die Cron-Routen
 * (app/api/cron/morgen und …/abend) sammeln die Lage ein und reichen sie
 * hier herein.
 *
 * Grundsatz wie beim Briefing auf der Startseite: eine Nachricht nur, wenn
 * sie etwas sagt. Eine Erinnerung, die jeden Abend kommt, auch wenn das
 * Training längst gelaufen ist, wird nach einer Woche weggewischt, ohne sie
 * zu lesen — und dann auch an dem Abend, an dem sie gestimmt hätte.
 */

import { SESSIONS } from "./plan";
import type { Nachricht } from "./push";

type Einheit = "push" | "pull";

export type MorgenLage =
  | { verbunden: false; grund: string }
  | {
      verbunden: true;
      /** Null, wenn die Nacht keine vollständige Messung hat. */
      regeneration: { score: number; band: "gut" | "mittel" | "schlecht" } | null;
      gewogenHeute: boolean;
    };

export type Plan = { art: "training"; einheit: Einheit } | { art: "pause"; naechste: Einheit };

const BAND_WORT = { gut: "erholt", mittel: "erholt sich", schlecht: "unerholt" } as const;

function einheitText(e: Einheit): string {
  return `${SESSIONS[e].focus.split(" · ")[0]} (${SESSIONS[e].title})`;
}

/**
 * Die Morgen-Nachricht.
 *
 * Kommt immer, wenn eingeschaltet — sie ist der Ersatz dafür, die App zu
 * öffnen, um zu sehen, was heute ansteht. Ist Google abgelaufen, sagt sie
 * das zuerst: genau das fällt sonst erst auf, wenn man die Startseite
 * öffnet und dort statt Zahlen nur "neu verbinden" steht.
 */
export function morgenNachricht(lage: MorgenLage, plan: Plan): Nachricht {
  const heute =
    plan.art === "training"
      ? `Heute ${einheitText(plan.einheit)}.`
      : `Heute Rest Day, als Nächstes ${SESSIONS[plan.naechste].focus.split(" · ")[0]}.`;

  if (!lage.verbunden) {
    return {
      title: "Google Health neu verbinden",
      body: `${heute} Schlaf, HRV und Gewicht fehlen, bis Kadenz wieder verbunden ist — ein Tipp auf die Startseite.`,
      url: "/",
      tag: "morgen",
    };
  }

  const teile: string[] = [heute];
  if (!lage.gewogenHeute) teile.push("Morgengewicht noch eintragen.");

  const titel = lage.regeneration
    ? `Regeneration ${lage.regeneration.score} · ${BAND_WORT[lage.regeneration.band]}`
    : "Guten Morgen";

  if (lage.regeneration?.band === "schlecht" && plan.art === "training") {
    teile.push("Heute eher Gewichte halten als steigern.");
  }

  return { title: titel, body: teile.join(" "), url: "/", tag: "morgen" };
}

export type AbendLage = {
  plan: Plan;
  /** Läuft oder lief heute irgendeine Einheit — egal ob die geplante? */
  trainiertHeute: boolean;
  kalorienvorschlagOffen: boolean;
};

/**
 * Die Abend-Nachricht — oder keine.
 *
 * Training: nur an einem Trainingstag, an dem noch nichts begonnen wurde.
 * Wer stattdessen die andere Einheit trainiert hat, hat trainiert; die
 * Erinnerung wäre dann eine Rüge für eine bewusste Entscheidung.
 *
 * Kalorienvorschlag: ein offener Vorschlag wartet auf ein Ja oder Nein, und
 * bis dahin läuft das alte Ziel weiter. Er steht nur auf der Essen-Seite —
 * wer dort ein paar Tage nicht hinsieht, merkt nicht, dass etwas wartet.
 */
export function abendNachricht(lage: AbendLage): Nachricht | null {
  const offen = lage.plan.art === "training" && !lage.trainiertHeute ? lage.plan.einheit : null;

  if (offen) {
    return {
      title: `Heute noch ${SESSIONS[offen].focus.split(" · ")[0]}`,
      body: lage.kalorienvorschlagOffen
        ? `${SESSIONS[offen].title} — noch nicht begonnen. Außerdem wartet ein Kalorienvorschlag auf deine Entscheidung.`
        : `${SESSIONS[offen].title} — noch nicht begonnen.`,
      url: "/training",
      tag: "abend",
    };
  }

  if (lage.kalorienvorschlagOffen) {
    return {
      title: "Kalorienvorschlag wartet",
      body: "Kadenz schlägt ein neues Kalorienziel vor. Bis du Ja oder Nein sagst, gilt das alte.",
      url: "/ernaehrung",
      tag: "abend",
    };
  }

  return null;
}
