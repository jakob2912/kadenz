import { progression, type SetLog } from "./coach";
import { wienerDatum } from "./datum";

/**
 * Jakobs Split. "Push/Pull" meint bei ihm Anterior/Posterior — Beine sind an
 * beiden Tagen dabei, nicht als eigener Tag. Trainiert wird viermal die Woche,
 * Push und Pull im Wechsel, im Zwei-Wochen-Rhythmus — siehe rotationFor().
 *
 * Die Gewichte stammen aus dem Kraftwerte-Log (29.07.2026) und den
 * Lift-Off-Screenshots (16.08.2026).
 *
 * Seit dem Übungskatalog steht dieser Split in der Datenbank und wird von
 * dort geladen. Was hier bleibt, ist zweierlei: die Rückfallebene, wenn keine
 * Datenbank konfiguriert ist (lokal ohne .env.local, im Build), und die
 * Bezeichnungen der beiden Einheiten — title und focus hängen an der Art,
 * nicht an den Übungen, und haben in einer Übungstabelle nichts verloren.
 */

export type Exercise = {
  name: string;
  /**
   * Der Name im Katalog, wenn die Übung heute getauscht ist (tagestausch.ts).
   * Fehlt er, steht die Übung wie geplant da.
   */
  planName?: string;
  note?: string;
  /**
   * Wie viele Sätze heute anstehen.
   *
   * Kommt aus dem Katalog, nicht aus `last`. Vorher zählte heutigeSaetze()
   * die Sätze der letzten Einheit — eine Übung ohne Historie und ohne
   * startWdh bekam damit gar keine, und ein halb abgehaktes Training
   * schrumpfte den Plan beim nächsten Mal still zusammen.
   */
  saetze: number;
  /** Letzte Ausführung — Grundlage für PREV-Spalte und Progression. */
  last: SetLog[];
};

export type Session = {
  key: "push" | "pull";
  title: string;
  focus: string;
  exercises: Exercise[];
};

/**
 * Die Rückfallebene, wenn keine Datenbank erreichbar ist.
 *
 * Muss namentlich mit dem Katalog übereinstimmen — SetLog.exercise hält den
 * Übungsnamen als Text, und wer hier "Lat Pulldown" liefert, während in der
 * Datenbank "Latzug" steht, findet keinen einzigen geloggten Satz. Die Seite
 * zeigte dann Referenzgewichte und behauptete, die Übung sei nie gemacht
 * worden. Genau so war es hier auseinandergelaufen, bevor die Namen am
 * 25.08.2026 abgeglichen wurden.
 *
 * Bankdrücken fehlt weiterhin bewusst: ohne Datenbank gibt es auch keinen
 * Trainingsmax, und ein 5/3/1-Slot ohne Trainingsmax ist eine leere Zeile.
 */
export const SESSIONS: Record<"push" | "pull", Session> = {
  pull: {
    key: "pull",
    title: "Rücken, Bizeps, Hamstrings",
    focus: "Pull · Posterior",
    exercises: [
      {
        name: "Iso-Lateral Row",
        note: "Maschine, unilateral",
        saetze: 2,
        last: [
          { reps: 6, kg: 50 },
          { reps: 5, kg: 50 },
        ],
      },
      {
        name: "Latzug",
        note: "zur Brust ziehen",
        saetze: 2,
        last: [
          { reps: 6, kg: 95 },
          { reps: 5, kg: 95 },
        ],
      },
      {
        name: "T-Bar Row",
        saetze: 2,
        last: [
          { reps: 5, kg: 60 },
          { reps: 4, kg: 60 },
        ],
      },
      {
        name: "Preacher Curl",
        saetze: 2,
        last: [
          { reps: 6, kg: 20 },
          { reps: 5, kg: 20 },
        ],
      },
      {
        name: "Machine Reverse Fly",
        saetze: 2,
        last: [
          { reps: 7, kg: 55 },
          { reps: 6, kg: 55 },
        ],
      },
      {
        name: "Crunch (Maschine)",
        saetze: 2,
        last: [
          { reps: 5, kg: 70 },
          { reps: 5, kg: 70 },
        ],
      },
      {
        name: "Leg Curl",
        saetze: 2,
        last: [
          { reps: 7, kg: 125 },
          { reps: 6, kg: 125 },
        ],
      },
      {
        name: "Stiff-Leg Deadlift",
        saetze: 2,
        last: [
          { reps: 8, kg: 100 },
          { reps: 7, kg: 100 },
        ],
      },
    ],
  },
  push: {
    key: "push",
    title: "Brust, Schulter, Trizeps, Quads",
    focus: "Push · Anterior",
    exercises: [
      {
        name: "Seitheben",
        note: "Maschine, unilateral",
        saetze: 2,
        last: [
          { reps: 8, kg: 37.5 },
          { reps: 7, kg: 37.5 },
        ],
      },
      {
        name: "Butterfly",
        note: "Form laut dir verbesserungswürdig",
        saetze: 2,
        last: [
          { reps: 7, kg: 85 },
          { reps: 6, kg: 85 },
        ],
      },
      {
        name: "Incline Chest Press",
        note: "Maschine",
        saetze: 2,
        last: [
          { reps: 5, kg: 100 },
          { reps: 4, kg: 100 },
        ],
      },
      {
        name: "Shoulder Press",
        note: "Maschine",
        saetze: 2,
        last: [
          { reps: 6, kg: 100 },
          { reps: 5, kg: 100 },
        ],
      },
      {
        name: "Trizeps-Pushdown",
        note: "Cuff am Kabelturm",
        saetze: 2,
        last: [
          { reps: 5, kg: 20 },
          { reps: 5, kg: 20 },
        ],
      },
      { name: "Hack Squat", note: "nur 1 Satz", saetze: 1, last: [{ reps: 7, kg: 95 }] },
      {
        name: "Leg Extension",
        saetze: 2,
        last: [
          { reps: 7, kg: 90 },
          { reps: 6, kg: 90 },
        ],
      },
      { name: "Adduktoren (Maschine)", note: "Maschine", saetze: 2, last: [] },
      {
        name: "Calf Raise",
        note: "Slab Press",
        saetze: 2,
        last: [
          { reps: 6, kg: 130 },
          { reps: 5, kg: 130 },
        ],
      },
    ],
  },
};

/**
 * Der Trainingskalender, in drei Abschnitten.
 *
 * Bis zum 06.09.2026 lief die Ferienroutine: Push – Pull – Pause, stur alle
 * drei Tage ab einem bekannten Push-Tag (der Gym-Kalender führt "Push FB" ab
 * 15.08.2026). Vom 07.09. bis 15.09. trainierte Jakob Mo, Mi, Fr, Sa, Push und
 * Pull im Wechsel über jeden Trainingstag gezählt.
 *
 * Seit dem 16.09.2026 hängt die Einheit am Wochentag: ein Zwei-Wochen-Rhythmus
 * mit zwei Schaltern je Woche (siehe wocheAm()). Die ersten beiden Abschnitte bleiben als
 * geschlossene Rechnung stehen, damit die Vergangenheit ihre Beschriftung und
 * ihre Push-Indizes behält.
 *
 * Der Push-Index zählt die Push-Tage über alle drei Abschnitte hinweg. Daran
 * hängt das 5/3/1, das damit ohne Bruch weiterläuft.
 */
const ANKER_PUSH = Date.UTC(2026, 7, 15);
const WOCHENPLAN_AB = Date.UTC(2026, 8, 7);
const FESTE_TAGE_AB = Date.UTC(2026, 8, 16);

/** Trainingstage im Wochenplan vom 07.–15.09. als getUTCDay(): Mo, Mi, Fr, Sa. */
const TRAININGSWOCHENTAGE: readonly number[] = [1, 3, 5, 6];

const TAG_MS = 864e5;

/** Der erste Push der Woche: Montag oder Dienstag. */
export type Frueh = "mo" | "di";
/** Das Ende der Woche: Fr Push + Sa Pull, oder Sa Push + So Pull. */
export type Spaet = "frsa" | "saso";

/**
 * Was für eine Woche ausdrücklich gewählt wurde. `woche` ist ihr Montag
 * (ISO). Null heißt: Standard des Zwei-Wochen-Rhythmus.
 */
export type Wochenwahl = { woche: string; frueh: Frueh | null; spaet: Spaet | null };

/** Wie eine Woche tatsächlich aussieht, nach Standard und Sperre. */
export type Woche = {
  /** Montag der Woche, ISO. */
  montag: string;
  /** Woche 1 oder 2 im Zwei-Wochen-Rhythmus. */
  rhythmus: 1 | 2;
  frueh: Frueh;
  spaet: Spaet;
  /** Mo ist gesperrt, weil die Vorwoche auf Sa + So stand. */
  montagGesperrt: boolean;
};

export const FRUEH_NAMEN: Record<Frueh, string> = { mo: "Montag", di: "Dienstag" };
export const SPAET_NAMEN: Record<Spaet, string> = { frsa: "Fr + Sa", saso: "Sa + So" };

function isoTag(tagMs: number): string {
  return new Date(tagMs).toISOString().slice(0, 10);
}

/** Der Montag der Woche (Mo–So), in der dieser Kalendertag liegt. */
export function montagVon(iso: string): string {
  const t = Date.parse(`${iso}T00:00:00Z`);
  return isoTag(t - ((new Date(t).getUTCDay() + 6) % 7) * TAG_MS);
}

/**
 * Der Standard ist ein Zwei-Wochen-Rhythmus nach Jakobs Stundenplan
 * (16.09.2026, "ideal, aber noch nicht fix"):
 *
 *   Woche 1 (langer Dienstag in der Schule): Push Mo, Pull Mi, Push Sa, Pull So
 *   Woche 2 (kurzer Dienstag):               Push Di, Pull Mi, Push Fr, Pull Sa
 *
 * Woche 1 ist die Woche ab dem 14.09.2026, danach im Wechsel. Die Schalter
 * überschreiben den Standard für eine einzelne Woche.
 */
const RHYTHMUS_WOCHE_1 = Date.UTC(2026, 8, 14);

export function standardWoche(montag: string): { frueh: Frueh; spaet: Spaet; woche: 1 | 2 } {
  const wochen = Math.round((Date.parse(`${montag}T00:00:00Z`) - RHYTHMUS_WOCHE_1) / (7 * TAG_MS));
  return ((wochen % 2) + 2) % 2 === 0
    ? { frueh: "mo", spaet: "saso", woche: 1 }
    : { frueh: "di", spaet: "frsa", woche: 2 };
}

/** Das Wochenende einer Woche, wie es tatsächlich gilt — Wahl vor Standard. */
function spaetAm(montag: string, wahlen: readonly Wochenwahl[]): Spaet {
  return wahlen.find((w) => w.woche === montag)?.spaet ?? standardWoche(montag).spaet;
}

/**
 * Eine Woche nach Jakobs Regeln.
 *
 * Mi ist immer Pull. Dazu zwei Schalter: der erste Push am Mo oder Di, und
 * das Ende der Woche als Fr Push + Sa Pull oder Sa Push + So Pull. Ohne Wahl
 * gilt der Zwei-Wochen-Rhythmus (standardWoche()). Stand die Vorwoche auf
 * Sa + So, ist Mo gesperrt — sonst wären Sa, So und Mo drei Tage am Stück —
 * und der erste Push liegt am Di.
 *
 * In jeder Variante folgt Push – Pull – Push – Pull, und jede Woche endet mit
 * Pull und beginnt mit Push. Die Abfolge bleibt damit über jede Kombination
 * hinweg ohne Doppelung.
 */
export function wocheAm(montag: string, wahlen: readonly Wochenwahl[]): Woche {
  const vorwoche = isoTag(Date.parse(`${montag}T00:00:00Z`) - 7 * TAG_MS);
  const wahl = wahlen.find((w) => w.woche === montag);
  const standard = standardWoche(montag);
  const montagGesperrt = spaetAm(vorwoche, wahlen) === "saso";

  return {
    montag,
    rhythmus: standard.woche,
    frueh: montagGesperrt ? "di" : (wahl?.frueh ?? standard.frueh),
    spaet: wahl?.spaet ?? standard.spaet,
    montagGesperrt,
  };
}

/** Die Einheit eines Wochentags (getUTCDay()) in einer Woche. */
function einheitInWoche(woche: Woche, wochentag: number): "push" | "pull" | null {
  switch (wochentag) {
    case 1:
      return woche.frueh === "mo" ? "push" : null;
    case 2:
      return woche.frueh === "di" ? "push" : null;
    case 3:
      return "pull";
    case 5:
      return woche.spaet === "frsa" ? "push" : null;
    case 6:
      return woche.spaet === "frsa" ? "pull" : "push";
    case 0:
      return woche.spaet === "saso" ? "pull" : null;
    default:
      return null;
  }
}

export type Wochenstand = Woche & {
  /** Warum der Mo/Di-Schalter gerade nicht umlegbar ist. Null: er ist es. */
  fruehGesperrt: string | null;
  /** Dasselbe für Fr + Sa / Sa + So. */
  spaetGesperrt: string | null;
};

/**
 * Welche Schalter einer Woche sich noch umlegen lassen.
 *
 * Nicht mehr, wenn ihre Tage vorbei oder schon trainiert sind — sonst verlöre
 * eine geloggte Einheit ihren Platz im Plan, und ihr Push-Index wanderte auf
 * einen anderen Tag. Mo/Di zusätzlich nicht nach einer Sa + So-Woche.
 * `geloggt` sind die Tage der Woche (ISO), an denen eine Einheit steht.
 */
export function schalterSperren(
  woche: Woche,
  heute: string,
  geloggt: ReadonlySet<string>
): Pick<Wochenstand, "fruehGesperrt" | "spaetGesperrt"> {
  const [mo, di, fr, sa, so] = [0, 1, 4, 5, 6].map((n) =>
    isoTag(Date.parse(`${woche.montag}T00:00:00Z`) + n * TAG_MS)
  );

  let fruehGesperrt: string | null = null;
  if (woche.montagGesperrt) {
    fruehGesperrt = "Die Woche davor stand auf Sa + So — Mo wäre der dritte Tag am Stück.";
  } else if (geloggt.has(mo) || geloggt.has(di)) {
    fruehGesperrt = "Der erste Push dieser Woche ist schon trainiert.";
  } else if (heute > di) {
    fruehGesperrt = "Mo und Di sind vorbei.";
  }

  let spaetGesperrt: string | null = null;
  if (geloggt.has(fr) || geloggt.has(sa) || geloggt.has(so)) {
    spaetGesperrt = "Das Wochenende dieser Woche ist schon trainiert.";
  } else if (heute > sa) {
    spaetGesperrt = "Das Wochenende ist vorbei.";
  }

  return { fruehGesperrt, spaetGesperrt };
}

/** Kurzbeschreibung einer Woche, z. B. "Push Mo und Sa, Pull Mi und So". */
export function wochenText(woche: Woche): string {
  const erster = woche.frueh === "mo" ? "Mo" : "Di";
  const [push2, pull2] = woche.spaet === "frsa" ? ["Fr", "Sa"] : ["Sa", "So"];
  return `Push ${erster} und ${push2}, Pull Mi und ${pull2}`;
}

/**
 * Einzeln eingeschobene Rest Days — nur für die Zeit vor dem 16.09.2026.
 *
 * Ein Einschub nahm einen Tag aus der Zählung, alles Folgende rückte nach. Der
 * 14.09. war der letzte: er hat den Plan auf die festen Tage gedreht. Seitdem
 * werden ausgefallene Tage nachgeholt (trainingAls()) oder über einen
 * Wochenwahl verschoben, und neue Einschübe gibt es nicht mehr.
 */
export const EINGESCHOBENE_PAUSEN: readonly string[] = ["2026-08-21", "2026-09-14"];

/** Wie viele Einschübe vor diesem Tag liegen. */
function pausenVor(tagMs: number): number {
  return EINGESCHOBENE_PAUSEN.filter((iso) => Date.parse(`${iso}T00:00:00Z`) < tagMs).length;
}

function tagVon(date: Date): number {
  return Date.parse(`${wienerDatum(date)}T00:00:00Z`);
}

/** Vor dem 16.09.: ist dieser Kalendertag (UTC-Mitternacht) ein Trainingstag? */
function altIstTrainingstag(tagMs: number): boolean {
  if (EINGESCHOBENE_PAUSEN.includes(isoTag(tagMs))) return false;
  if (tagMs >= WOCHENPLAN_AB) return TRAININGSWOCHENTAGE.includes(new Date(tagMs).getUTCDay());

  const diff = Math.round((tagMs - ANKER_PUSH) / TAG_MS) - pausenVor(tagMs);
  return ((diff % 3) + 3) % 3 !== 2;
}

/**
 * Vor dem 16.09.: wie viele Trainingstage vor diesem Kalendertag liegen, ab
 * dem Anker gezählt. Gerade heißt: der nächste Trainingstag ist Push.
 */
function altTrainingstageVor(tagMs: number): number {
  const bis = Math.min(tagMs, WOCHENPLAN_AB);
  const diff = Math.round((bis - ANKER_PUSH) / TAG_MS) - pausenVor(bis);
  let n = 2 * Math.floor(diff / 3) + Math.min(((diff % 3) + 3) % 3, 2);

  for (let t = WOCHENPLAN_AB; t < tagMs; t += TAG_MS) {
    if (altIstTrainingstag(t)) n++;
  }
  return n;
}

/** Push-Tage vor dem 16.09.2026 — der Stand, bei dem die festen Tage weiterzählen. */
const PUSH_VOR_FESTEN_TAGEN = Math.ceil(altTrainingstageVor(FESTE_TAGE_AB) / 2);

/** Welche Einheit an diesem Kalendertag ansteht, oder null am Rest Day. */
function einheitAm(tagMs: number, wahlen: readonly Wochenwahl[]): "push" | "pull" | null {
  if (tagMs >= FESTE_TAGE_AB) {
    const woche = wocheAm(montagVon(isoTag(tagMs)), wahlen);
    return einheitInWoche(woche, new Date(tagMs).getUTCDay());
  }
  if (!altIstTrainingstag(tagMs)) return null;
  return altTrainingstageVor(tagMs) % 2 === 0 ? "push" : "pull";
}

/**
 * Wie viele Push-Tage vor diesem Kalendertag liegen. An einem Push-Tag ist
 * das sein Index, sonst der Index des nächsten.
 */
function pushTageVor(tagMs: number, wahlen: readonly Wochenwahl[]): number {
  if (tagMs <= FESTE_TAGE_AB) return Math.ceil(altTrainingstageVor(tagMs) / 2);

  let n = PUSH_VOR_FESTEN_TAGEN;
  for (let t = FESTE_TAGE_AB; t < tagMs; t += TAG_MS) {
    if (einheitAm(t, wahlen) === "push") n++;
  }
  return n;
}

/**
 * Der Kalendertag eines Push-Tags, rückwärts aus seinem Index.
 *
 * Gegenstück zu rotationFor(). Gebraucht vom 5/3/1: um den Trainingsmax
 * fortzuschreiben, muss der AMRAP-Satz aus Woche 3 des vorigen Zyklus
 * gefunden werden — und dessen Datum steht nirgends geschrieben, es folgt
 * aus dem Kalender.
 *
 * Für künftige Wochen gilt der Standard, solange nichts gewählt ist. Ein
 * späterer Schalter verschiebt diese Daten — das ist gewollt, sie sind eine
 * Vorschau.
 */
export function datumFuerPushIndex(pushIndex: number, wahlen: readonly Wochenwahl[] = []): string {
  // Vor dem Anker gibt es keine Einschübe, dort reicht die Dreierrotation.
  if (pushIndex < 0) return isoTag(ANKER_PUSH + pushIndex * 3 * TAG_MS);

  if (pushIndex < PUSH_VOR_FESTEN_TAGEN) {
    // Push k ist dort Trainingstag Nummer 2k.
    const ziel = pushIndex * 2;
    let n = 0;
    for (let t = ANKER_PUSH; ; t += TAG_MS) {
      if (!altIstTrainingstag(t)) continue;
      if (n === ziel) return isoTag(t);
      n++;
    }
  }

  // Jede Woche hat Push-Tage, die Schleife kommt also immer an.
  let n = PUSH_VOR_FESTEN_TAGEN;
  for (let t = FESTE_TAGE_AB; ; t += TAG_MS) {
    if (einheitAm(t, wahlen) !== "push") continue;
    if (n === pushIndex) return isoTag(t);
    n++;
  }
}

/**
 * Der erste Push-Tag an oder nach einem Datum, als Index.
 *
 * Gegenstück zu datumFuerPushIndex(). Das 5/3/1 verankert damit seinen
 * Zyklus am Tag, an dem der Trainingsmax gesetzt wurde.
 */
export function pushIndexAbDatum(iso: string, wahlen: readonly Wochenwahl[] = []): number {
  return pushTageVor(Date.parse(`${iso}T00:00:00Z`), wahlen);
}

export type Rotation =
  | {
      art: "training";
      einheit: "push" | "pull";
      /**
       * Der wievielte Push-Tag seit dem Anker. Nur an Push-Tagen gesetzt und
       * nur dort gebraucht: daraus rechnet bankPosition(), ob heute Bank-Tag
       * ist und in welcher Programmwoche der Zyklus steht.
       */
      pushIndex: number | null;
    }
  | { art: "pause"; naechste: "push" | "pull" };

/**
 * Eine geloggte Einheit, so wie der Kalender sie braucht: Tag (ISO) und Art.
 * Die Datenbank hält höchstens eine je Tag und Art (Workout @@unique).
 */
export type Eintrag = { datum: string; einheit: "push" | "pull" };

/** Ein geplanter Trainingstag einer Woche — ein "Platz". */
type Platz = { datum: string; einheit: "push" | "pull"; pushIndex: number | null };

/** Die geplanten Plätze einer Woche, aufsteigend. Erst ab den festen Tagen. */
function plaetzeDerWoche(montag: string, wahlen: readonly Wochenwahl[]): Platz[] {
  const mo = Date.parse(`${montag}T00:00:00Z`);
  const plaetze: Platz[] = [];
  for (let n = 0; n < 7; n++) {
    const t = mo + n * TAG_MS;
    if (t < FESTE_TAGE_AB) continue;
    const einheit = einheitAm(t, wahlen);
    if (einheit === null) continue;
    plaetze.push({
      datum: isoTag(t),
      einheit,
      pushIndex: einheit === "push" ? pushTageVor(t, wahlen) : null,
    });
  }
  return plaetze;
}

function eintragsSchluessel(e: Eintrag): string {
  return `${e.datum}|${e.einheit}`;
}

/**
 * Welche geloggte Einheit einer Woche welchen Platz belegt.
 *
 * Seit dem 28.10.2026 hängt der Plan nicht mehr starr am Wochentag: jede
 * eingetragene Einheit belegt, der Reihe nach, den frühesten noch freien
 * Platz ihrer Art in dieser Woche. Damit gilt beides zugleich:
 *
 *   - Nachholen: fällt der Mo-Push aus und läuft am Di, belegt er den Mo-Platz
 *     und trainiert dessen 5/3/1-Vorgabe.
 *   - Vorziehen: läuft am Di "trotzdem Pull", belegt er den Mi-Pull — der
 *     Mittwoch ist dann frei. Ein Push am Do nimmt den nächsten Push-Platz
 *     samt Bankprogramm, und dessen Tag wird frei.
 *
 * Ist kein Platz dieser Art mehr frei, ist die Einheit eine Extra-Einheit
 * (null) und verschiebt nichts. Plätze verfallen am Sonntag — offene Plätze
 * wandern nicht in die nächste Woche.
 */
function zuordnung(
  montag: string,
  wahlen: readonly Wochenwahl[],
  eintraege: readonly Eintrag[]
): Map<string, Platz | null> {
  const sonntag = isoTag(Date.parse(`${montag}T00:00:00Z`) + 6 * TAG_MS);
  const frei = plaetzeDerWoche(montag, wahlen);
  const ergebnis = new Map<string, Platz | null>();

  const derWoche = eintraege
    .filter((e) => e.datum >= montag && e.datum <= sonntag)
    .sort((a, b) => (a.datum === b.datum ? a.einheit.localeCompare(b.einheit) : a.datum < b.datum ? -1 : 1));

  for (const e of derWoche) {
    const i = frei.findIndex((p) => p.einheit === e.einheit);
    ergebnis.set(eintragsSchluessel(e), i === -1 ? null : frei.splice(i, 1)[0]);
  }
  return ergebnis;
}

/** Die freien Plätze einer Woche nach der Zuordnung. */
function freiePlaetze(montag: string, wahlen: readonly Wochenwahl[], eintraege: readonly Eintrag[]): Platz[] {
  const belegt = new Set(
    [...zuordnung(montag, wahlen, eintraege).values()].flatMap((p) => (p ? [p.datum] : []))
  );
  return plaetzeDerWoche(montag, wahlen).filter((p) => !belegt.has(p.datum));
}

/**
 * Der Push-Index einer Einheit, die an diesem Tag läuft oder laufen würde.
 *
 * Belegt sie einen Platz, ist es dessen Index. Eine Extra-Einheit wiederholt
 * die Vorgabe des letzten planmäßigen Push-Tags an oder vor diesem Tag — so
 * wie es vor dem 28.10.2026 für jede Einheit außer Plan galt.
 */
function pushIndexFuer(
  tagMs: number,
  wahlen: readonly Wochenwahl[],
  eintraege: readonly Eintrag[]
): number {
  const e: Eintrag = { datum: isoTag(tagMs), einheit: "push" };
  const mit = eintraege.some((x) => eintragsSchluessel(x) === eintragsSchluessel(e))
    ? eintraege
    : [...eintraege, e];
  const platz = zuordnung(montagVon(e.datum), wahlen, mit).get(eintragsSchluessel(e));
  return platz?.pushIndex ?? pushTageVor(tagMs, wahlen) - 1;
}

/**
 * Was an einem Tag ansteht, wenn man weiß, was schon trainiert wurde.
 *
 * In dieser Reihenfolge:
 *   1. Ist heute schon etwas eingetragen, ist es das.
 *   2. Wurde gestern und vorgestern trainiert, ist Rest Day — nach zwei Tagen
 *      am Stück kommt immer mindestens einer Pause.
 *   3. Sonst steht ein freier Platz an, dessen Tag heute oder schon vorbei
 *      ist. Sind beide Arten offen, die andere als zuletzt — Push und Pull
 *      wechseln sich ab —, sonst der früheste.
 *   4. Sonst Rest Day.
 */
function einheitMitLog(
  tagMs: number,
  wahlen: readonly Wochenwahl[],
  eintraege: readonly Eintrag[]
): { einheit: "push" | "pull"; pushIndex: number | null } | null {
  const heute = isoTag(tagMs);

  const schon = eintraege.find((e) => e.datum === heute);
  if (schon) {
    return {
      einheit: schon.einheit,
      pushIndex: schon.einheit === "push" ? pushIndexFuer(tagMs, wahlen, eintraege) : null,
    };
  }

  const trainiert = (t: number) => eintraege.some((e) => e.datum === isoTag(t));
  if (trainiert(tagMs - TAG_MS) && trainiert(tagMs - 2 * TAG_MS)) return null;

  const offen = freiePlaetze(montagVon(heute), wahlen, eintraege).filter((p) => p.datum <= heute);
  if (offen.length === 0) return null;

  const zuletzt = eintraege
    .filter((e) => e.datum < heute)
    .reduce<Eintrag | null>((a, e) => (a === null || e.datum >= a.datum ? e : a), null);
  const platz = offen.find((p) => zuletzt !== null && p.einheit !== zuletzt.einheit) ?? offen[0];
  return { einheit: platz.einheit, pushIndex: platz.pushIndex };
}

/**
 * Welche Einheit an einem Zeitpunkt ansteht.
 *
 * Der Kalendertag wird ausdrücklich in Wiener Zeit bestimmt — lokal läuft der
 * Prozess in Wien, auf Vercel in UTC, und zwischen Mitternacht und 02:00
 * zeigten die beiden sonst verschiedene Tage.
 *
 * Rein und ohne Datenbankzugriff: die Wochenwahlen und die geloggten
 * Einheiten reicht der Aufrufer herein (kalenderLesen() in wochenplan.ts).
 * Ohne `eintraege` gilt der starre Wochenplan — so rechnen die Vorschauen und
 * der Teil vor dem 16.09.2026.
 */
export function rotationFor(
  date: Date,
  wahlen: readonly Wochenwahl[] = [],
  eintraege?: readonly Eintrag[]
): Rotation {
  const tagMs = tagVon(date);
  const mitLog = eintraege !== undefined && tagMs >= FESTE_TAGE_AB;

  const amTag = (t: number) => {
    if (!mitLog) {
      const einheit = einheitAm(t, wahlen);
      return einheit === null
        ? null
        : { einheit, pushIndex: einheit === "push" ? pushTageVor(t, wahlen) : null };
    }
    return einheitMitLog(t, wahlen, eintraege);
  };

  const heute = amTag(tagMs);
  if (heute !== null) return { art: "training", ...heute };

  // Höchstens eine Woche weit: jede Woche hat Trainingstage.
  for (let t = tagMs + TAG_MS; t <= tagMs + 8 * TAG_MS; t += TAG_MS) {
    const naechste = amTag(t);
    if (naechste !== null) return { art: "pause", naechste: naechste.einheit };
  }
  throw new Error(`Ab ${isoTag(tagMs)} steht eine Woche lang keine Einheit an.`);
}

export type Trainingstag = Extract<Rotation, { art: "training" }>;

/**
 * Eine Einheit, die man an diesem Tag ausdrücklich wählt — "trotzdem Push"
 * am Rest Day, Pull statt Push.
 *
 * Mit `eintraege` belegt sie wie jede eingetragene Einheit den frühesten
 * freien Platz ihrer Art (siehe zuordnung()) und trainiert dessen
 * 5/3/1-Vorgabe — vorgezogen oder nachgeholt. Ohne `eintraege` gilt die alte
 * Regel: der letzte Push-Tag an oder vor diesem Tag.
 *
 * An einem Tag, an dem die Einheit ohnehin dran ist, kommt genau dasselbe
 * heraus wie aus rotationFor().
 */
export function trainingAls(
  date: Date,
  einheit: "push" | "pull",
  wahlen: readonly Wochenwahl[] = [],
  eintraege?: readonly Eintrag[]
): Trainingstag {
  if (einheit === "pull") return { art: "training", einheit, pushIndex: null };

  const tagMs = tagVon(date);
  if (eintraege !== undefined && tagMs >= FESTE_TAGE_AB) {
    return { art: "training", einheit, pushIndex: pushIndexFuer(tagMs, wahlen, eintraege) };
  }

  const heute = rotationFor(date, wahlen);
  if (heute.art === "training" && heute.einheit === "push") return heute;

  return { art: "training", einheit, pushIndex: pushTageVor(tagMs, wahlen) - 1 };
}

/**
 * Die Tage, an denen ein bestimmter Push-Platz trainiert wurde.
 *
 * Gegenstück zur Zuordnung für das 5/3/1: der AMRAP-Satz eines Push-Index
 * liegt an dem Tag, dessen Einheit diesen Platz belegt hat — vorgezogen,
 * nachgeholt oder planmäßig. `eintraege` muss die Woche des Platzes abdecken.
 * Leer, wenn der Platz nicht trainiert wurde.
 */
export function tageFuerPushIndex(
  pushIndex: number,
  wahlen: readonly Wochenwahl[],
  eintraege: readonly Eintrag[]
): string[] {
  const montag = montagVon(datumFuerPushIndex(pushIndex, wahlen));
  return [...zuordnung(montag, wahlen, eintraege)]
    .filter(([, p]) => p?.pushIndex === pushIndex)
    .map(([k]) => k.split("|")[0]);
}

/**
 * Die noch offenen Trainingstage der Woche dieses Tages, als "Push Sat".
 * Für Texte am Rest Day: was diese Woche noch ansteht, nach Vorziehen und
 * Nachholen — nicht mehr der starre Wochenplan.
 */
export function offenePlaetze(
  iso: string,
  wahlen: readonly Wochenwahl[],
  eintraege: readonly Eintrag[]
): { datum: string; einheit: "push" | "pull" }[] {
  return freiePlaetze(montagVon(iso), wahlen, eintraege)
    .filter((p) => p.datum > iso)
    .map(({ datum, einheit }) => ({ datum, einheit }));
}

/** Ab diesem Tag gilt die Zuordnung über Plätze (die festen Wochentage). */
export const FESTE_TAGE_AB_ISO = isoTag(FESTE_TAGE_AB);

/** Ein vom Programm vorgegebener Satz — Gewicht und Sollwiederholungen stehen fest. */
export type GeplanterSatz = { kg: number; wdh: number; amrap: boolean };

/** Eine Übung, deren Sätze ein Programm vorgibt statt progression(). */
export type Programmvorgabe = {
  saetze: GeplanterSatz[];
  /** Warum das Programm gerade nichts vorgeben kann. Null, wenn alles steht. */
  hinweis: string | null;
};

export type ZuPlanen = Exercise & { programm?: Programmvorgabe };

/**
 * Was eine Oberfläche von einer Einheit braucht, um sie zu beschriften.
 *
 * Eigener Typ statt Session: seit dem Übungskatalog kommen die Übungen aus
 * der Datenbank, und der Trainings-Logger hat sie ohnehin getrennt als
 * PlannedExercise[] bekommen. Session mitzuschleppen hieße, ihm eine zweite,
 * veraltete Übungsliste in die Hand zu geben.
 */
export type Einheitskopf = { key: "push" | "pull"; title: string; focus: string };

export type PlannedExercise = Exercise & {
  ziel: number;
  delta: number;
  grund: string | null;
  prev: string[];
  /** Leer, wenn progression() zuständig ist. */
  programmSaetze: GeplanterSatz[];
  programmHinweis: string | null;
};

function baue(ex: ZuPlanen, last: SetLog[]): PlannedExercise {
  const prev = last.map((s) => `${String(s.kg).replace(".", ",")} × ${s.reps}`);

  /* Gibt ein Programm die Sätze vor, hat progression() hier nichts zu suchen:
     die beiden würden sich widersprechen. Das 5/3/1 rechnet aus dem
     Trainingsmax, und der bewegt sich am Ende eines Zyklus, nicht nach jedem
     guten Satz. */
  if (ex.programm) {
    const saetze = ex.programm.saetze;
    return {
      ...ex,
      last,
      ziel: saetze.length > 0 ? saetze[saetze.length - 1].kg : 0,
      delta: 0,
      grund: null,
      prev,
      programmSaetze: saetze,
      programmHinweis: ex.programm.hinweis,
    };
  }

  const advice = progression(last);
  return {
    ...ex,
    last,
    ziel: advice.kg,
    delta: advice.delta,
    grund: advice.reason,
    prev,
    programmSaetze: [],
    programmHinweis: null,
  };
}

/**
 * Startgewichte aus den oben hinterlegten Referenzwerten.
 * Nur noch Rückfallebene — bevorzugt mitHistorie() verwenden.
 */
export function planFor(session: Session): PlannedExercise[] {
  return session.exercises.map((ex) => baue(ex, ex.last));
}

/**
 * Startgewichte aus der tatsächlichen Trainingshistorie.
 *
 * Solange eine Übung noch nie geloggt wurde, greifen die Referenzwerte aus
 * dem Katalog — sonst stünde beim ersten Training überall null. Sobald ein
 * Satz in der Datenbank liegt, zählt ausschließlich der.
 *
 * Nimmt seit dem Übungskatalog eine Übungsliste statt einer Session entgegen:
 * woher die Liste kommt, entscheidet der Aufrufer — aus der Datenbank im
 * Normalfall, aus SESSIONS als Rückfall.
 */
export function mitHistorie(
  uebungen: ZuPlanen[],
  historie: ReadonlyMap<string, SetLog[]>
): PlannedExercise[] {
  /* Rein: die Historie lädt der Aufrufer (trainingsplanAls() in uebungen.ts).
     Bis zum 22.10.2026 holte diese Funktion sie selbst per dynamischem Import
     — und weil plan.ts auch im Browser läuft (heutigeSaetze im Logger),
     landete der Datenbanktreiber damit im Client-Bündel, sobald das
     importierte Modul keine Server-Action-Datei mehr war. */
  return uebungen.map((ex) => {
    const ausDb = historie.get(ex.name) ?? [];
    return baue(ex, ausDb.length > 0 ? ausDb : ex.last);
  });
}

/**
 * Wie viele Sätze eine Übung an diesem Tag vorsieht.
 *
 * Die einzige Stelle, an der die Bank-Tag-Reduktion entschieden wird. Sie
 * greift unter genau zwei Bedingungen zugleich: heute ist Bank-Tag, UND für
 * diese Übung ist ausdrücklich eine abweichende Anzahl hinterlegt. Fehlt eines
 * von beiden, gilt die gewöhnliche Anzahl.
 *
 * Hier und nicht in uebungen.ts, obwohl der Katalog dort liegt: das ist
 * Planungslogik, keine Persistenz. Dieselbe Trennung wie bei rotationFor() —
 * der Teil, der stimmen muss, soll ohne Datenbank prüfbar sein. "Nur dort, wo
 * tatsächlich vorgesehen" ist eine Behauptung, und ein Test soll sie halten
 * können, ohne dafür einen Trainingsmax anzulegen.
 */
export function saetzeFuerTag(
  eintrag: { saetze: number; saetzeBankTag: number | null },
  istBankTag: boolean
): number {
  if (istBankTag && eintrag.saetzeBankTag !== null) return eintrag.saetzeBankTag;
  return eintrag.saetze;
}

/**
 * Die Sollwiederholungen, wenn eine Übung noch nie geloggt wurde.
 *
 * Die Obergrenze von Jakobs Spanne 5–8, nicht die Mitte: dort erhöht
 * progression() das Gewicht. Wer eine neue Übung mit einem konservativen Ziel
 * beginnt, hängt eine Einheit länger am Startgewicht fest, ohne dass die Zahl
 * ihm etwas gesagt hätte.
 */
const WDH_OHNE_HISTORIE = 8;

/**
 * Die Sätze, die heute anstehen.
 *
 * Zwei Quellen, eine Liste: entweder gibt ein Programm die Sätze samt Gewicht
 * vor (5/3/1), oder es sind ex.saetze Sätze auf dem Zielgewicht aus
 * progression().
 *
 * Die Anzahl kam bis zum 25.08.2026 aus ex.last — so viele Sätze wie zuletzt.
 * Das hatte zwei Fehler auf einmal: eine Übung ohne Historie und ohne
 * startWdh bekam gar keine Sätze (so stand der Adductor mit einer leeren
 * Tabelle im Plan), und wer von zwei geplanten Sätzen nur einen abhakte,
 * bekam beim nächsten Training nur noch einen vorgeschlagen. Der Plan
 * schrumpfte still auf das, was zuletzt geschafft wurde.
 *
 * Die Wiederholungen kommen weiterhin aus der letzten Ausführung — sie sind
 * die Vorlage, gegen die man sich vergleicht. Reicht die Historie nicht so
 * weit (drei geplante Sätze, zwei geloggte), wiederholt sich der letzte
 * bekannte Wert, statt die Zeile leer zu lassen.
 *
 * Der Logger rechnete das vorher selbst aus ex.last und ex.ziel. Mit dem
 * Bank-Slot hätte er eine zweite Fassung davon gebraucht, und zwei Stellen,
 * die zählen, wie viele Sätze heute anstehen, kommen irgendwann auf
 * verschiedene Zahlen.
 */
export function heutigeSaetze(ex: PlannedExercise): GeplanterSatz[] {
  if (ex.programmSaetze.length > 0) return ex.programmSaetze;

  return Array.from({ length: Math.max(0, ex.saetze) }, (_, i) => ({
    kg: ex.ziel,
    wdh: ex.last[Math.min(i, ex.last.length - 1)]?.reps ?? WDH_OHNE_HISTORIE,
    amrap: false,
  }));
}
