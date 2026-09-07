/**
 * Kadenz — alles fürs Bankdrücken an einer Stelle
 *
 * Der Bank-Tab fragt vier Dinge auf einmal: was ist gelaufen, wo steht der
 * Zyklus, was kommt, und wie weit ist es noch bis 140 kg. Zusammengefasst in
 * EINEM Modul und in wenigen Abfragen, nicht je Karte eine — der Pool in db.ts
 * steht auf max 1, dort läuft nichts nebenläufig.
 *
 * Kein "use server": wird auch vom MCP-Server geladen. Dasselbe Muster wie
 * ernaehrung.ts und bank.ts.
 */

import {
  aktuellerTrainingsmax,
  bankPositionFuer,
  bankstandFuer,
  trainingsmaxHistorie,
  type Bankstand,
  type Trainingsmax,
} from "./bank";
import { saetzeFuerMehrere } from "./kraftverlauf";
import { heuteWien } from "./datum";
import { datumFuerPushIndex, pushIndexAbDatum, rotationFor } from "./plan";
import { progression } from "./coach";
import {
  PRESSVARIANTEN,
  PRESS_NAMEN,
  bankPlan,
  bankPosition,
  besterSatz,
  varianteFuer,
  e1rm,
  istPressvariante,
  type BankSatz,
  type BankWoche,
  type GeloggterSatz,
  type Pressvariante,
  type Variante,
  type Zyklusanker,
} from "./kraft";
import { zielProjektion, type Zielstand } from "./bankziel";

/**
 * Wie weit zurück der Bank-Tab liest.
 *
 * Ein Jahr statt der 120 Tage aus kraftverlauf.ts: dieser Tab ist die
 * Langzeitansicht einer einzigen Übung, und die Trainingsmax-Historie reicht
 * ohnehin bis zum Programmstart zurück. Die Datenmenge bleibt trotzdem klein —
 * drei Sätze je Bankeinheit, gut zwei Einheiten je Woche.
 */
export const BANK_FENSTER_TAGE = 365;

/** Eine Bankeinheit, wie sie in der Zeitleiste steht. */
export type Bankeinheit = {
  datum: string;
  uebung: Pressvariante;
  /** "5/3/1", "Paused", "Spoto" — die kurze Beschriftung. */
  kurz: string;
  /** Bewegt diese Variante den Trainingsmax? */
  schwer: boolean;
  saetze: GeloggterSatz[];
  /** Schwerster Satz des Tages, unsaubere übergangen. */
  best: GeloggterSatz | null;
  /** Geschätztes Maximum aus dem besten Satz. Null, wenn nichts verwertbar ist. */
  e1rm: number | null;
  /** Wurde an diesem Tag mindestens ein Satz als unsauber markiert? */
  unsauber: boolean;
};

export type Wochenvorschau = {
  zyklus: number;
  woche: BankWoche;
  /** Kalendertag dieses TM-Tags. */
  datum: string;
  saetze: BankSatz[];
  /** Deload-Woche — keine AMRAP-Zeile, bewusst leicht. */
  deload: boolean;
};

export type Bankuebersicht = {
  tm: Trainingsmax | null;
  historie: Trainingsmax[];
  /** Der Stand am nächsten Push-Tag — Zyklus, Woche, Vorgabe. */
  stand: Bankstand | null;
  /** Kalendertag, auf den sich `stand` bezieht. */
  standTag: string;
  /** Die laufende und die nächste Programmwoche. */
  vorschau: Wochenvorschau[];
  einheiten: Bankeinheit[];
  ziel: Zielstand | null;
  /** Welche Pressvariante heute ansteht. Null an einem Tag ohne Presse. */
  heute: Pressvariante | null;
  /**
   * Das Arbeitsgewicht je submaximaler Variante, aus ihrer eigenen Historie.
   *
   * Nur für Paused und Spoto: beim schweren Bankdrücken gibt der Trainingsmax
   * die Gewichte vor, und die stehen satzweise in der Vorschau. Ein zweiter
   * Wert daneben wäre eine zweite Meinung darüber, was heute aufliegt.
   */
  arbeitsgewicht: Partial<Record<Pressvariante, number>>;
};

/** Welche Übung eine Ausprägung des Tages auf die Bank legt. */
function presseFuer(variante: Variante): Pressvariante | null {
  if (variante === "schwer") return PRESS_NAMEN[0];
  if (variante === "leicht") return "Paused Bench Press";
  if (variante === "presse") return "Spoto Press";
  return null;
}

/**
 * Der Tag, für den der Bank-Tab den Stand zeigt.
 *
 * Heute, wenn heute Push ist — sonst der nächste Push-Tag. Ein Rest Day soll
 * nicht "kein Bankdrücken" anzeigen und damit genau die Frage offenlassen, mit
 * der man diesen Tab öffnet: was steht als nächstes an.
 *
 * Höchstens acht Tage weit gesucht, aus demselben Grund wie in
 * naechsterTrainingstag(): drei Tage Rotation plus jeder denkbare Einschub
 * liegen darunter, und eine Endlosschleife wäre schlimmer als ein leerer Tab.
 */
function naechsterPushTag(heute: string): { iso: string; pushIndex: number } | null {
  for (let n = 0; n < 8; n++) {
    const iso = new Date(Date.parse(`${heute}T00:00:00Z`) + n * 864e5)
      .toISOString()
      .slice(0, 10);
    const r = rotationFor(new Date(`${iso}T12:00:00Z`));
    if (r.art === "training" && r.einheit === "push" && r.pushIndex !== null) {
      return { iso, pushIndex: r.pushIndex };
    }
  }
  return null;
}

/**
 * Die Sätze eines Tages zu einer Einheit zusammenfassen.
 *
 * Gruppiert wird über Tag UND Übungsname. Vor den Session-Varianten hieß jede
 * Bankeinheit "Bankdrücken", ob schwer oder submaximal — eine Zeitleiste
 * daraus zeigte 85 kg und 65 kg nebeneinander, ohne dass man sah, dass das
 * zwei verschiedene Übungen an zwei verschiedenen Tagen waren.
 */
function zuEinheiten(saetze: GeloggterSatz[]): Bankeinheit[] {
  const gruppen = new Map<string, GeloggterSatz[]>();

  for (const s of saetze) {
    if (!istPressvariante(s.uebung)) continue;
    const schluessel = `${s.datum}|${s.uebung}`;
    const liste = gruppen.get(schluessel);
    if (liste) liste.push(s);
    else gruppen.set(schluessel, [s]);
  }

  const einheiten: Bankeinheit[] = [];
  for (const [schluessel, liste] of gruppen) {
    const trenner = schluessel.indexOf("|");
    const datum = schluessel.slice(0, trenner);
    const uebung = schluessel.slice(trenner + 1) as Pressvariante;
    const meta = PRESSVARIANTEN[uebung];

    /* besterSatz() übergeht unsaubere Sätze von selbst — das ist der Sinn der
       Markierung. Der Tag verschwindet deswegen nicht: er hat stattgefunden,
       die Sätze stehen in der Liste, und `unsauber` sagt, dass etwas dabei
       war. Was wegfällt, ist ausschließlich die Behauptung über die Kraft. */
    const best = (besterSatz(liste) as GeloggterSatz | null) ?? null;

    einheiten.push({
      datum,
      uebung,
      kurz: meta.kurz,
      schwer: meta.schwer,
      saetze: [...liste].sort((a, b) => a.kg - b.kg),
      best,
      e1rm: best ? e1rm(best) : null,
      unsauber: liste.some((s) => s.sauber === false),
    });
  }

  // Jüngste zuerst: der Tab beantwortet "was war zuletzt", nicht "wie fing es an".
  return einheiten.sort((a, b) => b.datum.localeCompare(a.datum));
}

/**
 * Was das Programm in dieser und der nächsten Woche vorsieht.
 *
 * Zwei Wochen und nicht der ganze Zyklus: die übernächste liegt zwölf Tage
 * entfernt, und bis dahin kann sich der Trainingsmax bewegt haben. Weiter weg
 * wäre eine Zahl mit Verfallsdatum.
 *
 * In Einerschritten gesucht, aber nur TM-Tage aufgenommen: nur jede zweite
 * Push-Einheit trägt die Welle (bankPosition()), die dazwischen läuft
 * submaximal und gehört nicht in eine Programmvorschau.
 */
function vorschauAb(
  pushIndex: number,
  anker: Zyklusanker,
  tmKg: number
): Wochenvorschau[] {
  const out: Wochenvorschau[] = [];

  for (let n = 0; out.length < 2 && n < 6; n++) {
    const index = pushIndex + n;
    const pos = bankPosition(index, anker);
    if (pos.art !== "tm") continue;

    out.push({
      zyklus: pos.zyklus,
      woche: pos.woche,
      datum: datumFuerPushIndex(index),
      saetze: bankPlan(tmKg, pos.woche),
      deload: pos.woche === 4,
    });
  }

  return out;
}

export async function bankuebersicht(): Promise<Bankuebersicht> {
  const heute = heuteWien();
  const naechster = naechsterPushTag(heute);

  const [historie, saetze] = await Promise.all([
    trainingsmaxHistorie(24),
    saetzeFuerMehrere(PRESS_NAMEN, BANK_FENSTER_TAGE),
  ]);

  let stand: Bankstand | null = null;
  if (naechster) {
    try {
      stand = await bankstandFuer(naechster.pushIndex);
    } catch (e) {
      // Der Verlauf und die Historie stehen auch ohne den Stand. Diesen Tab
      // wegen einer nicht lesbaren Fortschreibung ganz zu leeren wäre falsch.
      console.error("Bankstand für die Übersicht nicht lesbar:", e);
    }
  }

  /* Nach bankstandFuer() lesen: das schreibt den Zyklus nötigenfalls fort, und
     danach steht ein anderer Trainingsmax da als davor. Die Reihenfolge ist
     hier kein Stil, sondern der Unterschied zwischen dem Wert von gestern und
     dem von heute. */
  const tm = stand?.tm ?? historie[0] ?? (await aktuellerTrainingsmax());

  const einheiten = zuEinheiten(saetze);

  let vorschau: Wochenvorschau[] = [];
  let ziel: Zielstand | null = null;

  if (tm !== null && naechster !== null) {
    /* Der Anker ist der Anfang des LAUFENDEN Zyklus, nicht der des Programms:
       gueltigAb der jüngsten Trainingsmax-Zeile. Genau daran hängt seit dem
       Deload-Skip die Wochenzählung — siehe zyklusanker() in bank.ts. */
    const anker: Zyklusanker = {
      pushIndex: pushIndexAbDatum(tm.gueltigAb),
      zyklus: tm.zyklus,
    };

    vorschau = vorschauAb(naechster.pushIndex, anker, tm.tmKg);

    /* Die Projektion beginnt am Anfang des laufenden Zyklus, nicht heute: der
       Trainingsmax gilt für diesen Zyklus bereits, und ihn ab heute
       weiterzuzählen verschöbe die ganze Treppe um bis zu 24 Tage nach hinten. */
    ziel = zielProjektion(tm.tmKg, anker.zyklus, datumFuerPushIndex(anker.pushIndex));
  }

  /* Was heute auf der Bank liegt. Ausdrücklich HEUTE und nicht am nächsten
     Push-Tag: `standTag` beantwortet "wann wird wieder schwer gebankt", diese
     Zeile beantwortet "was mache ich jetzt gerade". An einem Pull-Tag mit
     Spoto Press sind das zwei verschiedene Antworten. */
  let heutigePresse: Pressvariante | null = null;
  const rotationHeute = rotationFor(new Date(`${heute}T12:00:00Z`));
  if (rotationHeute.art === "training") {
    try {
      const pos = await bankPositionFuer(rotationHeute.bezugPushIndex);
      heutigePresse = presseFuer(varianteFuer(rotationHeute.einheit, pos));
    } catch (e) {
      console.error("Heutige Pressvariante nicht bestimmbar:", e);
    }
  }

  /* Arbeitsgewicht der submaximalen Varianten: dieselbe Rechnung, die auch
     der Trainingsplan anstellt (progression() über die letzte Ausführung).
     Zweimal gerechnet statt einmal geladen, weil der Plan an einer Einheit
     hängt und dieser Tab an keiner — aber aus derselben Quelle, damit hier
     nicht eine andere Zahl steht als morgen im Logger. */
  const arbeitsgewicht: Partial<Record<Pressvariante, number>> = {};
  for (const name of PRESS_NAMEN) {
    if (PRESSVARIANTEN[name].schwer) continue;
    const letzte = einheiten.find((e) => e.uebung === name);
    if (!letzte) continue;
    const rat = progression(letzte.saetze.map((s) => ({ kg: s.kg, reps: s.reps })));
    if (rat.kg > 0) arbeitsgewicht[name] = rat.kg;
  }

  return {
    tm,
    historie,
    stand,
    standTag: naechster?.iso ?? heute,
    vorschau,
    einheiten,
    ziel,
    heute: heutigePresse,
    arbeitsgewicht,
  };
}
