import { progression, type SetLog } from "./coach";
import { wienerDatum } from "./datum";
import { datenbankKonfiguriert } from "./konfiguration";

/**
 * Jakobs Split. "Push/Pull" meint bei ihm Anterior/Posterior — Beine sind an
 * beiden Tagen dabei, nicht als eigener Tag. Rotation: Push – Pull – Pause.
 *
 * Die Gewichte stammen aus dem Kraftwerte-Log (29.07.2026) und den
 * Lift-Off-Screenshots (16.08.2026).
 *
 * Seit dem Übungskatalog steht dieser Split in der Datenbank und wird von
 * dort geladen. Was hier bleibt, ist zweierlei: die Rückfallebene, wenn keine
 * Datenbank konfiguriert ist (lokal ohne .env.local, im Build), und die
 * Bezeichnungen der beiden Einheiten — title und focus hängen an der Art,
 * nicht an den Übungen, und haben in einer Übungstabelle nichts verloren.
 *
 * Der Katalog kennt zusätzlich Bankdrücken auf Push-Platz 1. Hier fehlt es
 * bewusst: ohne Datenbank gibt es auch keinen Trainingsmax, und ein
 * 5/3/1-Slot ohne Trainingsmax ist eine leere Zeile.
 */

export type Exercise = {
  name: string;
  note?: string;
  /** Letzte Ausführung — Grundlage für PREV-Spalte und Progression. */
  last: SetLog[];
};

export type Session = {
  key: "push" | "pull";
  title: string;
  focus: string;
  exercises: Exercise[];
};

export const SESSIONS: Record<"push" | "pull", Session> = {
  pull: {
    key: "pull",
    title: "Rücken, Bizeps, Hamstrings",
    focus: "Pull · Posterior",
    exercises: [
      {
        name: "Iso-Lateral Row",
        note: "Maschine, unilateral",
        last: [
          { reps: 6, kg: 50 },
          { reps: 5, kg: 50 },
        ],
      },
      {
        name: "Lat Pulldown",
        note: "zur Brust ziehen",
        last: [
          { reps: 6, kg: 95 },
          { reps: 5, kg: 95 },
        ],
      },
      {
        name: "T Bar Row",
        last: [
          { reps: 5, kg: 60 },
          { reps: 4, kg: 60 },
        ],
      },
      {
        name: "Machine Reverse Fly",
        last: [
          { reps: 7, kg: 55 },
          { reps: 6, kg: 55 },
        ],
      },
      {
        name: "Preacher Curl",
        last: [
          { reps: 6, kg: 20 },
          { reps: 5, kg: 20 },
        ],
      },
      {
        name: "Leg Curl",
        last: [
          { reps: 7, kg: 125 },
          { reps: 6, kg: 125 },
        ],
      },
      {
        name: "Stiff-Leg-Deadlift",
        last: [
          { reps: 8, kg: 100 },
          { reps: 7, kg: 100 },
        ],
      },
      {
        name: "Crunch (Maschine)",
        last: [
          { reps: 5, kg: 70 },
          { reps: 5, kg: 70 },
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
        name: "Incline Chest Press",
        note: "Maschine",
        last: [
          { reps: 5, kg: 100 },
          { reps: 4, kg: 100 },
        ],
      },
      {
        name: "Butterfly",
        note: "Form laut dir verbesserungswürdig",
        last: [
          { reps: 7, kg: 85 },
          { reps: 6, kg: 85 },
        ],
      },
      {
        name: "Shoulder Press",
        note: "Maschine",
        last: [
          { reps: 6, kg: 100 },
          { reps: 5, kg: 100 },
        ],
      },
      {
        name: "Seitheben",
        note: "Maschine, unilateral",
        last: [
          { reps: 8, kg: 37.5 },
          { reps: 7, kg: 37.5 },
        ],
      },
      {
        name: "Trizeps-Pushdown",
        note: "Cuff am Kabelturm",
        last: [
          { reps: 5, kg: 20 },
          { reps: 5, kg: 20 },
        ],
      },
      { name: "Hex Squat", note: "nur 1 Satz", last: [{ reps: 7, kg: 95 }] },
      {
        name: "Leg Extension",
        last: [
          { reps: 7, kg: 90 },
          { reps: 6, kg: 90 },
        ],
      },
      {
        name: "Calf Raise",
        note: "Slab Press",
        last: [
          { reps: 6, kg: 130 },
          { reps: 5, kg: 130 },
        ],
      },
    ],
  },
};

/**
 * Rotation Push – Pull – Pause, verankert an einem bekannten Push-Tag.
 * Der Gym-Kalender führt "Push FB" ab 15.08.2026 alle drei Tage.
 */
const ANKER_PUSH = Date.UTC(2026, 7, 15);

/**
 * Einzeln eingeschobene Rest Days.
 *
 * Die Rotation läuft stur alle drei Tage. Wer einen Tag zusätzlich pausiert,
 * schiebt damit alles Folgende um einen Tag nach hinten — die Vergangenheit
 * aber nicht: der 15.08. war ein Push-Tag und bleibt einer, egal welche Pause
 * danach kam. Deshalb steht hier ein Datum je Einschub, statt den Anker zu
 * verschieben. Ein verschobener Anker hätte rückwirkend jeden zurückliegenden
 * Tag neu beschriftet, und die Push-Indizes wären mitgewandert — der
 * 5/3/1-Zyklus hinge dann plötzlich an anderen Kalendertagen.
 *
 * Aufsteigend halten. Ein neuer Einschub kommt hinten dazu.
 */
export const EINGESCHOBENE_PAUSEN: readonly string[] = ["2026-08-21"];

/** Wie viele Einschübe bis einschließlich dieses Tages liegen. */
function pausenBis(tagMs: number): number {
  return EINGESCHOBENE_PAUSEN.filter((iso) => Date.parse(`${iso}T00:00:00Z`) <= tagMs).length;
}

/**
 * Der Kalendertag eines Push-Tags, rückwärts aus seinem Index.
 *
 * Gegenstück zu rotationFor(). Gebraucht vom 5/3/1: um den Trainingsmax
 * fortzuschreiben, muss der AMRAP-Satz aus Woche 3 des vorigen Zyklus
 * gefunden werden — und dessen Datum steht nirgends geschrieben, es folgt
 * aus der Rotation. Ohne diese Umkehrung müsste die Zyklusposition mitgeführt
 * und gepflegt werden; so ist sie jederzeit neu ausrechenbar.
 */
export function datumFuerPushIndex(pushIndex: number): string {
  /* Die Einschübe verschieben das Datum nach hinten, und ein weiter hinten
     liegendes Datum kann wieder über einen Einschub hinwegkommen. Deshalb
     nicht einmal addieren, sondern bis zum Festpunkt rechnen. Die Schleife
     läuft höchstens so oft, wie es Einschübe gibt; die Schranke fängt nur den
     Fall ab, dass die Liste einmal unsortiert oder doppelt befüllt wird. */
  let ms = ANKER_PUSH + pushIndex * 3 * 864e5;

  for (let n = 0; n <= EINGESCHOBENE_PAUSEN.length; n++) {
    const soll = ANKER_PUSH + (pushIndex * 3 + pausenBis(ms)) * 864e5;
    if (soll === ms) break;
    ms = soll;
  }

  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Der erste Push-Tag an oder nach einem Datum, als Index.
 *
 * Gegenstück zu datumFuerPushIndex(). Das 5/3/1 braucht es, um seinen Zyklus
 * dort zu verankern, wo das Programm tatsächlich angefangen hat — am Tag, an
 * dem der Trainingsmax gesetzt wurde. An ANKER_PUSH zu hängen wäre falsch
 * gewesen: der markiert den Beginn der Push-Pull-Rotation, und die lief
 * schon, bevor es das Programm gab. Die erste Bankeinheit wäre je nach
 * Startdatum mitten im Zyklus gelandet — im schlechtesten Fall gleich in
 * Woche 3 mit 95 %.
 */
export function pushIndexAbDatum(iso: string): number {
  const day = Date.parse(`${iso}T00:00:00Z`);
  const tage = (day - ANKER_PUSH) / 864e5 - pausenBis(day);
  return Math.ceil(tage / 3);
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
  | { art: "pause"; naechste: "push" };

/**
 * Welche Einheit an einem Zeitpunkt ansteht.
 *
 * Der Kalendertag wird ausdrücklich in Wiener Zeit bestimmt. Vorher standen
 * hier getFullYear/getMonth/getDate — die lesen die Zeitzone des Prozesses.
 * Lokal ist das Wien, auf Vercel UTC, und zwischen Mitternacht und 02:00
 * Wiener Zeit zeigte die Trainingsseite dort die Einheit von gestern: Rest Day
 * statt Push, Push statt Pull. Die Startseite rechnete gleichzeitig über
 * heuteWien() richtig — zwei Seiten, zwei Meinungen darüber, welcher Tag ist.
 *
 * Gibt seit dem Übungskatalog nur noch die Art zurück, nicht mehr die
 * Übungen: die stehen jetzt in der Datenbank und kommen aus
 * einheitFuerTag() in uebungen.ts. Damit bleibt diese Funktion rein und ohne
 * Datenbankzugriff — die Datumsrechnung ist der Teil, der schon einmal falsch
 * war, und der Teil, den ein Test greifen kann.
 */
export function rotationFor(date: Date): Rotation {
  const iso = wienerDatum(date);
  const day = Date.parse(`${iso}T00:00:00Z`);

  // Ein eingeschobener Rest Day ist einer, egal was die Rotation sagen würde.
  if (EINGESCHOBENE_PAUSEN.includes(iso)) return { art: "pause", naechste: "push" };

  const diff = Math.round((day - ANKER_PUSH) / 864e5) - pausenBis(day);
  const slot = ((diff % 3) + 3) % 3;

  if (slot === 0) {
    return { art: "training", einheit: "push", pushIndex: Math.floor(diff / 3) };
  }
  if (slot === 1) return { art: "training", einheit: "pull", pushIndex: null };
  return { art: "pause", naechste: "push" };
}

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
export async function mitHistorie(uebungen: ZuPlanen[]): Promise<PlannedExercise[]> {
  // Ist gar keine Datenbank konfiguriert, wären die Abfragen unten so viele
  // vergebliche Verbindungsversuche, wie es Übungen gibt — bei einem Pool mit
  // max 1 nacheinander. Dann lieber gleich die Referenzwerte.
  if (!datenbankKonfiguriert()) return uebungen.map((ex) => baue(ex, ex.last));

  const { letzteSaetze } = await import("./workouts");

  return Promise.all(
    uebungen.map(async (ex) => {
      let ausDb: SetLog[] = [];
      try {
        ausDb = await letzteSaetze(ex.name);
      } catch (e) {
        // Im Gym zählt, dass der Plan dasteht. Ist die Datenbank kurz weg,
        // fällt diese Übung auf ihren Referenzwert zurück, statt die ganze
        // Seite mit einem 500 abzuräumen. Das Loggen meldet den Ausfall
        // ohnehin sichtbar — satzSpeichern gibt { ok: false, fehler } zurück
        // und die Karte zeigt das an.
        console.error(`Historie für "${ex.name}" nicht lesbar, nutze Referenzwerte:`, e);
      }
      return baue(ex, ausDb.length > 0 ? ausDb : ex.last);
    })
  );
}

/**
 * Die Sätze, die heute anstehen.
 *
 * Zwei Quellen, eine Liste: entweder gibt ein Programm die Sätze samt Gewicht
 * vor (5/3/1), oder sie leiten sich aus der letzten Ausführung ab — so viele
 * Sätze wie zuletzt, alle auf dem Zielgewicht aus progression().
 *
 * Der Logger rechnete das vorher selbst aus ex.last und ex.ziel. Mit dem
 * Bank-Slot hätte er eine zweite Fassung davon gebraucht, und zwei Stellen,
 * die zählen, wie viele Sätze heute anstehen, kommen irgendwann auf
 * verschiedene Zahlen.
 */
export function heutigeSaetze(ex: PlannedExercise): GeplanterSatz[] {
  if (ex.programmSaetze.length > 0) return ex.programmSaetze;
  return ex.last.map((s) => ({ kg: ex.ziel, wdh: s.reps, amrap: false }));
}
