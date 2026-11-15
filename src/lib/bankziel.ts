/**
 * Kadenz — die Strecke von hier bis 140 kg
 *
 * Rein und ohne Datenbank, wie kraft.ts: hier steht die Rechnung, die Zahlen
 * holt bankuebersicht.ts. Ein Test soll die Projektion greifen können, ohne
 * dafür einen Trainingsmax anzulegen.
 *
 * Nicht in gewichtsplan.ts, obwohl das auch ein Ziel hochrechnet: dort geht es
 * um Körpergewicht, das jeden Tag gemessen wird und sich jeden Tag bewegt.
 * Hier geht es um eine Zahl, die sich planmäßig nur alle 21 bis 28 Tage bewegt. Genau
 * dieser Unterschied ist der Inhalt der Datei.
 */

import { bulkEndeIso } from "./gewichtsplan";
import {
  pushTageImZyklus,
  TEST_ALLE_ZYKLEN,
  TM_ANTEIL,
  TM_SCHRITT_GROSS_KG,
  TM_SCHRITT_KG,
} from "./kraft";

/**
 * Das Einer-Maximum, das erreicht werden soll — mit jeder Technik.
 *
 * Bis zum 15.11.2026 hieß das Ziel "140 kg sauber". Seit der 110-kg-PR vom
 * 26.10.2026 mit gehobener Hüfte zählt, zählt Ego-Bank: das Ziel ist einfach
 * der schwerste Single, egal wie er hochgeht.
 */
export const ZIEL_KG = 140;

/**
 * Bis wann: das Ende des Aufbaus, also der Tag, an dem der erste Cut beginnt.
 *
 * Bis zum 14.11.2026 stand hier der 31.12.2027. Mit dem neuen Gewichtsplan
 * liegt dazwischen ein Cut, und im Defizit wächst keine Bank — 140 kg müssen
 * stehen, solange noch Überschuss da ist. Aus dem Plan abgeleitet statt
 * hingeschrieben, damit ein längerer oder kürzerer Aufbau das Bankziel
 * mitnimmt, statt still von ihm abzuweichen.
 *
 * Kennt der Plan keinen Cut, gilt sein Ende.
 */
export const ZIEL_DATUM: string = bulkEndeIso();

/**
 * Das Ziel in Worten, für jeden Satz, der es nennt: "the end of the bulk
 * (15 April 2027)". An einer Stelle gebaut, damit Bank-Seite, Coach,
 * Tageslage und MCP-Server dasselbe Datum im selben Format sagen.
 *
 * Das Datum als Parameter, damit ein Text, der mit einem anderen Zieldatum
 * gerechnet wurde (in Tests), auch dieses Datum nennt.
 */
export function zielDatumText(zielIso: string = ZIEL_DATUM): string {
  const [jahr, monat, tag] = zielIso.split("-").map(Number);
  return `the end of the bulk (${tag} ${MONATE[monat - 1]} ${jahr})`;
}

/**
 * Der Trainingsmax, der das Ziel trägt.
 *
 * Der Trainingsmax ist definitionsgemäß 90 % des Maximums (TM_ANTEIL), also
 * braucht ein Maximum von 140 kg rechnerisch 126 kg. Nicht andersherum zu
 * rechnen ist wichtig: 140 als Trainingsmax hieße ein Maximum von rund
 * 156 kg, und danach ist nicht gefragt.
 *
 * Aufgerundet auf das 2,5er-Raster und ausdrücklich nicht kaufmännisch
 * gerundet: der Trainingsmax bewegt sich in Schritten von TM_SCHRITT_KG, 126
 * ist keiner davon, und die nächste erreichbare Stufe nach unten wären 125 kg
 * — die behaupten ein Maximum von 138,9 kg. Das Ziel wäre damit rechnerisch
 * erreicht, ohne dass die 140 kg je gestanden hätten. 127,5 kg tragen sie.
 */
export const ZIEL_TM_KG =
  Math.ceil((ZIEL_KG * TM_ANTEIL) / TM_SCHRITT_KG) * TM_SCHRITT_KG;

/**
 * Wie lange ein Zyklus dauert.
 *
 * Drei Programmwochen, im Testzyklus vier (siehe wochenImZyklus() in
 * kraft.ts), und eine Programmwoche ist bei Jakob jede zweite Push-Einheit.
 * Seit dem Wochenplan (rotationFor() in plan.ts) kommt Push zweimal pro
 * Woche, also sieben Tage je Programmwoche — 21 Tage je Zyklus, 28 im
 * Testzyklus. Gerechnet wird nach der Regel ab dem 15.11.2026; ein laufender
 * Zyklus, der vorher angefangen hat, kann eine Woche länger sein.
 *
 * Abgeleitet und nicht hingeschrieben: ändert sich der Kalender, ändert sich
 * diese Zahl mit, und die Projektion bleibt richtig.
 */
const PUSH_TAGE_JE_KALENDERWOCHE = 2;
export function tageImZyklus(zyklus: number, tmKg: number): number {
  return (pushTageImZyklus(zyklus, tmKg) / PUSH_TAGE_JE_KALENDERWOCHE) * 7;
}

export type Projektionspunkt = {
  /** ISO-Datum des ersten Tages dieses Zyklus. */
  datum: string;
  zyklus: number;
  tmKg: number;
  /** Das Maximum, das dieser Trainingsmax behauptet. */
  maxKg: number;
};

export type Zielstand = {
  /** Der Trainingsmax, von dem aus gerechnet wird. */
  tmKg: number;
  /** Was er über das Maximum behauptet. */
  maxKg: number;
  /** Wie viel am Trainingsmax noch fehlt. */
  fehltTmKg: number;
  /** Wie viele Zyklen das bei vollem Zuwachs wären. */
  zyklenNoetig: number;
  /**
   * Der frühestmögliche Tag — jeder Zyklus gelingt, kein einziger Stillstand.
   * Ausdrücklich die Untergrenze und nicht die Erwartung.
   */
  fruehestensAm: string;
  /** Das Zieldatum, gegen das gerechnet wurde. */
  zielIso: string;
  /** Liegt dieser Tag noch vor dem Zieldatum? */
  imPlan: boolean;
  /** Tage zwischen dem frühestmöglichen Tag und dem Zieldatum. */
  puffertage: number;
  /** Die erwartete Trainingsmax-Kurve, ein Punkt je Zyklus. */
  kurve: Projektionspunkt[];
};

function tageZwischen(vonIso: string, bisIso: string): number {
  return Math.round(
    (Date.parse(`${bisIso}T00:00:00Z`) - Date.parse(`${vonIso}T00:00:00Z`)) / 864e5
  );
}

function plusTage(iso: string, tage: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + tage * 864e5).toISOString().slice(0, 10);
}

/**
 * Die erwartete Trainingsmax-Kurve bis zum Ziel.
 *
 * Bewusst KEINE Gerade vom heutigen geschätzten Maximum auf 140 kg. Eine
 * solche Linie behauptet, jede Woche brächte denselben Zuwachs, und das ist
 * bei 5/3/1 in zweierlei Hinsicht falsch:
 *
 *   - Der Trainingsmax bewegt sich überhaupt nur am Ende eines Zyklus, also
 *     alle 21 bis 28 Tage, und dann um 2,5 kg. Dazwischen steht er still, während die
 *     Tagesgewichte zwischen 65 und 95 Prozent auf und ab gehen. Eine gerade
 *     Linie durch diese Welle beschreibt keinen einzigen echten Tag.
 *   - Jeder dritte Zyklus hat eine vierte Woche für den Test und dauert
 *     damit eine Woche länger.
 *
 * Was hier herauskommt, ist deshalb eine echte Treppe, und zwar mit ZWEI
 * Punkten je Zyklus: einer am Anfang, einer am letzten Tag desselben Zyklus,
 * beide auf demselben Trainingsmax. Dazwischen läuft die Linie waagrecht, und
 * erst am Zyklusende springt sie. Mit nur einem Punkt je Zyklus verbindet das
 * Diagramm gleich große Schritte in gleichen Abständen — und zeichnet damit
 * exakt die Gerade, die hier nicht gemeint ist. Die Stufen müssen im Bild
 * stehen, nicht nur im Text darunter.
 *
 * Und es ist die Treppe des regulären Schritts — sie unterstellt, dass jeder
 * AMRAP-Satz sein Soll trägt und kein Zyklus stehen bleibt. Schneller geht es
 * seit dem 15.11.2026 nur mit dem großen Schritt (TM_SCHRITT_GROSS_KG) nach
 * einem starken AMRAP-Satz oder einem guten Test; damit zu rechnen hieße,
 * jeden Zyklus als Ausnahme einzuplanen. Der Satz darunter nennt ihn. Das ist bei
 * 5/3/1 nicht die Erwartung, sondern der Bestfall: naechsterTm() setzt den
 * Trainingsmax planmäßig zurück, wenn der AMRAP-Satz das Soll verfehlt. Die
 * Kurve ist damit eine Untergrenze für den Zeitbedarf, keine Vorhersage.
 */
export function zielProjektion(
  tmKg: number,
  zyklus: number,
  abIso: string,
  /* Standard ist das Ende des Aufbaus laut Plan. Tests geben ein festes
     Datum mit, damit sie nicht jedes Mal brechen, wenn sich der Plan ändert. */
  zielIso: string = ZIEL_DATUM
): Zielstand {
  const fehltTmKg = Math.max(0, ZIEL_TM_KG - tmKg);
  const zyklenNoetig = Math.ceil(fehltTmKg / TM_SCHRITT_KG);

  const kurve: Projektionspunkt[] = [];
  let tage = 0;
  for (let n = 0; n <= zyklenNoetig; n++) {
    const tm = Math.min(ZIEL_TM_KG, tmKg + n * TM_SCHRITT_KG);
    const punkt = { zyklus: zyklus + n, tmKg: tm, maxKg: tm / TM_ANTEIL };
    const dauer = tageImZyklus(zyklus + n, tm);

    kurve.push({ datum: plusTage(abIso, tage), ...punkt });

    /* Der zweite Punkt liegt am letzten Tag desselben Zyklus — einen Tag vor
       dem nächsten Anstieg. Er trägt die Waagrechte. Beim letzten Zyklus
       entfällt er: dort ist der Anfang zugleich das Ziel, und eine Linie, die
       danach noch 27 Tage flach weiterliefe, behauptete eine Wartezeit, die
       es nicht gibt. */
    if (n < zyklenNoetig) {
      kurve.push({ datum: plusTage(abIso, tage + dauer - 1), ...punkt });
    }
    tage += dauer;
  }

  const fruehestensAm = kurve[kurve.length - 1].datum;

  return {
    tmKg,
    maxKg: tmKg / TM_ANTEIL,
    fehltTmKg,
    zyklenNoetig,
    fruehestensAm,
    zielIso,
    imPlan: fruehestensAm <= zielIso,
    puffertage: tageZwischen(fruehestensAm, zielIso),
    kurve,
  };
}

/**
 * Der Satz, der über der Kurve steht.
 *
 * Formuliert die Nichtlinearität aus, statt sie nur zu zeichnen: eine Treppe
 * wird als Gerade gelesen, wenn niemand dazuschreibt, dass sie keine ist. Und
 * die Zahl, auf die es ankommt, ist nicht "noch 50 kg", sondern "noch so und
 * so viele Zyklen à 21 bis 28 Tage".
 */
export function zielSatz(stand: Zielstand): string {
  if (stand.fehltTmKg === 0) {
    return (
      `The training max is at ${zahl(stand.tmKg)} kg and so supports the ` +
      `${ZIEL_KG} kg. From here all that counts is lifting it once.`
    );
  }

  const monate = Math.round(tageZwischen(stand.kurve[0].datum, stand.fruehestensAm) / 30.44);

  const tempo = stand.imPlan
    ? `That's about ${monate} months — and only if not a single cycle stalls. ` +
      `That leaves ${Math.round(stand.puffertage / 30.44)} months of buffer until ${zielDatumText(stand.zielIso)}, and you'll need it.`
    : `That puts the goal in ${monatName(stand.fruehestensAm)} at the earliest — after ${zielDatumText(stand.zielIso)}. ` +
      `At ${zahl(TM_SCHRITT_KG)} kg per cycle the numbers don't work out — only cycles that ` +
      `earn the ${zahl(TM_SCHRITT_GROSS_KG)} kg step can close the gap.`;

  return (
    `A ${ZIEL_KG} kg single needs a training max of ${zahl(ZIEL_TM_KG)} kg — ` +
    `${zahl(stand.fehltTmKg)} kg more than today. 5/3/1 doesn't add that evenly ` +
    `but ${zahl(TM_SCHRITT_KG)} kg at the end of each cycle (${zahl(TM_SCHRITT_GROSS_KG)} kg after a ` +
    `strong AMRAP set or test); in between the training max holds still, and every ` +
    `${TEST_ALLE_ZYKLEN}rd cycle runs a week longer for the test. ` +
    `${stand.zyklenNoetig} cycles of 21 to 28 days. ${tempo}`
  );
}

const MONATE = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function monatName(iso: string): string {
  return `${MONATE[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}

function zahl(n: number): string {
  const s = n.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}
