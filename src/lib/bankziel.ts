/**
 * Kadenz — die Strecke von hier bis 140 kg
 *
 * Rein und ohne Datenbank, wie kraft.ts: hier steht die Rechnung, die Zahlen
 * holt bankuebersicht.ts. Ein Test soll die Projektion greifen können, ohne
 * dafür einen Trainingsmax anzulegen.
 *
 * Nicht in gewichtsplan.ts, obwohl das auch ein Ziel hochrechnet: dort geht es
 * um Körpergewicht, das jeden Tag gemessen wird und sich jeden Tag bewegt.
 * Hier geht es um eine Zahl, die sich planmäßig nur alle 28 Tage bewegt. Genau
 * dieser Unterschied ist der Inhalt der Datei.
 */

import { TM_ANTEIL, TM_SCHRITT_KG } from "./kraft";

/** Sauberes Einer-Maximum, das erreicht werden soll. */
export const ZIEL_KG = 140;

/** Bis wann. Letzter Tag des Jahres 2027. */
export const ZIEL_DATUM = "2027-12-31";

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
 * Vier Programmwochen, und eine Programmwoche ist bei Jakob jede zweite
 * Push-Einheit (siehe bankPosition() in kraft.ts). Seit dem Wochenplan
 * (rotationFor() in plan.ts) kommt Push zweimal pro Woche, also sieben Tage je
 * Programmwoche und achtundzwanzig je Zyklus. In der Ferienroutine, Push alle
 * drei Tage, waren es vierundzwanzig.
 *
 * Abgeleitet und nicht als 28 hingeschrieben: ändert sich der Kalender,
 * ändert sich diese Zahl mit, und die Projektion bleibt richtig.
 */
export const WOCHEN_JE_ZYKLUS = 4;
export const PUSH_TAGE_JE_ZYKLUS = WOCHEN_JE_ZYKLUS * 2;
const PUSH_TAGE_JE_KALENDERWOCHE = 2;
export const TAGE_JE_ZYKLUS = (PUSH_TAGE_JE_ZYKLUS / PUSH_TAGE_JE_KALENDERWOCHE) * 7;

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
 *     alle 28 Tage, und dann um 2,5 kg. Dazwischen steht er still, während die
 *     Tagesgewichte zwischen 40 und 95 Prozent auf und ab gehen. Eine gerade
 *     Linie durch diese Welle beschreibt keinen einzigen echten Tag.
 *   - Die vierte Woche jedes Zyklus ist ein Deload. Dass es dort rückwärts
 *     geht, ist keine Stagnation, sondern der Zweck der Woche.
 *
 * Was hier herauskommt, ist deshalb eine echte Treppe, und zwar mit ZWEI
 * Punkten je Zyklus: einer am Anfang, einer am letzten Tag desselben Zyklus,
 * beide auf demselben Trainingsmax. Dazwischen läuft die Linie waagrecht, und
 * erst am Zyklusende springt sie. Mit nur einem Punkt je Zyklus verbindet das
 * Diagramm gleich große Schritte in gleichen Abständen — und zeichnet damit
 * exakt die Gerade, die hier nicht gemeint ist. Die Stufen müssen im Bild
 * stehen, nicht nur im Text darunter.
 *
 * Und es ist ausdrücklich die schnellstmögliche Treppe — sie unterstellt, dass
 * jeder AMRAP-Satz sein Soll trägt und kein Zyklus stehen bleibt. Das ist bei
 * 5/3/1 nicht die Erwartung, sondern der Bestfall: naechsterTm() setzt den
 * Trainingsmax planmäßig zurück, wenn der AMRAP-Satz das Soll verfehlt. Die
 * Kurve ist damit eine Untergrenze für den Zeitbedarf, keine Vorhersage.
 */
export function zielProjektion(tmKg: number, zyklus: number, abIso: string): Zielstand {
  const fehltTmKg = Math.max(0, ZIEL_TM_KG - tmKg);
  const zyklenNoetig = Math.ceil(fehltTmKg / TM_SCHRITT_KG);

  const kurve: Projektionspunkt[] = [];
  for (let n = 0; n <= zyklenNoetig; n++) {
    const tm = Math.min(ZIEL_TM_KG, tmKg + n * TM_SCHRITT_KG);
    const punkt = { zyklus: zyklus + n, tmKg: tm, maxKg: tm / TM_ANTEIL };

    kurve.push({ datum: plusTage(abIso, n * TAGE_JE_ZYKLUS), ...punkt });

    /* Der zweite Punkt liegt am letzten Tag desselben Zyklus — einen Tag vor
       dem nächsten Anstieg. Er trägt die Waagrechte. Beim letzten Zyklus
       entfällt er: dort ist der Anfang zugleich das Ziel, und eine Linie, die
       danach noch 27 Tage flach weiterliefe, behauptete eine Wartezeit, die
       es nicht gibt. */
    if (n < zyklenNoetig) {
      kurve.push({ datum: plusTage(abIso, (n + 1) * TAGE_JE_ZYKLUS - 1), ...punkt });
    }
  }

  const fruehestensAm = kurve[kurve.length - 1].datum;

  return {
    tmKg,
    maxKg: tmKg / TM_ANTEIL,
    fehltTmKg,
    zyklenNoetig,
    fruehestensAm,
    imPlan: fruehestensAm <= ZIEL_DATUM,
    puffertage: tageZwischen(fruehestensAm, ZIEL_DATUM),
    kurve,
  };
}

/**
 * Der Satz, der über der Kurve steht.
 *
 * Formuliert die Nichtlinearität aus, statt sie nur zu zeichnen: eine Treppe
 * wird als Gerade gelesen, wenn niemand dazuschreibt, dass sie keine ist. Und
 * die Zahl, auf die es ankommt, ist nicht "noch 50 kg", sondern "noch so und
 * so viele Zyklen à 28 Tage".
 */
export function zielSatz(stand: Zielstand): string {
  if (stand.fehltTmKg === 0) {
    return (
      `Der Trainingsmax steht bei ${zahl(stand.tmKg)} kg und trägt damit die ` +
      `${ZIEL_KG} kg. Ab hier zählt nur noch, sie auch einmal sauber zu heben.`
    );
  }

  const monate = Math.round((stand.zyklenNoetig * TAGE_JE_ZYKLUS) / 30.44);

  const tempo = stand.imPlan
    ? `Das sind rund ${monate} Monate — und selbst dann nur, wenn kein einziger Zyklus stehen bleibt. ` +
      `Bis Ende 2027 blieben ${Math.round(stand.puffertage / 30.44)} Monate Luft, und die wirst du brauchen.`
    : `Damit läge das Ziel frühestens im ${monatName(stand.fruehestensAm)} — nach Ende 2027. ` +
      `Mit ${zahl(TM_SCHRITT_KG)} kg je Zyklus geht es sich rechnerisch nicht aus.`;

  return (
    `Für saubere ${ZIEL_KG} kg braucht es einen Trainingsmax von ${zahl(ZIEL_TM_KG)} kg — ` +
    `${zahl(stand.fehltTmKg)} kg mehr als heute. Das 5/3/1 holt sie nicht gleichmäßig, ` +
    `sondern ${zahl(TM_SCHRITT_KG)} kg am Ende eines Zyklus; dazwischen steht der ` +
    `Trainingsmax still, und die vierte Woche geht bewusst zurück. ` +
    `${stand.zyklenNoetig} Zyklen à ${TAGE_JE_ZYKLUS} Tage. ${tempo}`
  );
}

const MONATE = [
  "Jänner",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

function monatName(iso: string): string {
  return `${MONATE[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}

function zahl(n: number): string {
  const s = n.toFixed(1).replace(".", ",");
  return s.endsWith(",0") ? s.slice(0, -2) : s;
}
