import { progression, type SetLog } from "./coach";
import { wienerDatum } from "./datum";
import { datenbankKonfiguriert } from "./konfiguration";

/**
 * Jakobs Split. "Push/Pull" meint bei ihm Anterior/Posterior — Beine sind an
 * beiden Tagen dabei, nicht als eigener Tag. Trainiert wird Mo, Mi, Fr und Sa,
 * Push und Pull im Wechsel — siehe rotationFor().
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
 * Der Trainingskalender, in zwei Abschnitten.
 *
 * Bis zum 06.09.2026 lief die Ferienroutine: Push – Pull – Pause, stur alle
 * drei Tage ab einem bekannten Push-Tag (der Gym-Kalender führt "Push FB" ab
 * 15.08.2026). Seit dem 07.09.2026 trainiert Jakob an festen Wochentagen —
 * Mo, Mi, Fr, Sa. Die Dreierrotation konnte das nicht abbilden: auf Pull
 * folgte dort immer ein Rest Day, Fr und Sa sind aber zwei Trainingstage am
 * Stück. Am Fr, 11.09. zeigte die App deshalb Rest Day, obwohl Pull anstand.
 *
 * Gleich bleibt in beiden Abschnitten: Push und Pull wechseln sich mit jedem
 * Trainingstag ab, fortlaufend über die Umstellung hinweg gezählt. Aus dieser
 * Zählung folgen Einheit und Push-Index — und über den Push-Index das 5/3/1,
 * das damit ohne Bruch weiterläuft.
 *
 * Die Vergangenheit behält ihre Beschriftung: bis zum 06.09. rechnet weiter
 * die Dreierrotation. Der 07.09. (Pull) und der 09.09. (Push) liegen in beiden
 * Kalendern gleich, deshalb fällt die Umstellung genau dorthin.
 */
const ANKER_PUSH = Date.UTC(2026, 7, 15);
const WOCHENPLAN_AB = Date.UTC(2026, 8, 7);

/** Trainingstage im Wochenplan als getUTCDay(), 0 ist Sonntag: Mo, Mi, Fr, Sa. */
const TRAININGSWOCHENTAGE: readonly number[] = [1, 3, 5, 6];

const TAG_MS = 864e5;

/**
 * Einzeln eingeschobene Rest Days.
 *
 * Ein Einschub nimmt einen Tag aus der Zählung: in der Ferienroutine rückte
 * damit alles Folgende um einen Kalendertag nach hinten, im Wochenplan rückt
 * die Einheit auf den nächsten Trainingstag. Die Vergangenheit bleibt, wo sie
 * war: der 15.08. war ein Push-Tag und bleibt einer, egal welche Pause danach
 * kam. Deshalb steht hier ein Datum je Einschub, statt den Anker zu
 * verschieben. Ein verschobener Anker hätte rückwirkend jeden zurückliegenden
 * Tag neu beschriftet, und die Push-Indizes wären mitgewandert — der
 * 5/3/1-Zyklus hinge dann plötzlich an anderen Kalendertagen.
 *
 * Aufsteigend halten. Ein neuer Einschub kommt hinten dazu.
 */
export const EINGESCHOBENE_PAUSEN: readonly string[] = ["2026-08-21"];

/** Wie viele Einschübe vor diesem Tag liegen. */
function pausenVor(tagMs: number): number {
  return EINGESCHOBENE_PAUSEN.filter((iso) => Date.parse(`${iso}T00:00:00Z`) < tagMs).length;
}

function isoTag(tagMs: number): string {
  return new Date(tagMs).toISOString().slice(0, 10);
}

/** Ist dieser Kalendertag (UTC-Mitternacht) ein Trainingstag? */
function istTrainingstag(tagMs: number): boolean {
  if (EINGESCHOBENE_PAUSEN.includes(isoTag(tagMs))) return false;
  if (tagMs >= WOCHENPLAN_AB) return TRAININGSWOCHENTAGE.includes(new Date(tagMs).getUTCDay());

  const diff = Math.round((tagMs - ANKER_PUSH) / TAG_MS) - pausenVor(tagMs);
  return ((diff % 3) + 3) % 3 !== 2;
}

/**
 * Wie viele Trainingstage vor diesem Kalendertag liegen, ab dem Anker gezählt.
 * Gerade heißt: der nächste Trainingstag ist Push.
 *
 * Die Ferienroutine rechnet geschlossen — je drei Tage zwei Trainingstage —
 * und gilt damit auch vor dem Anker. Ab dem Wochenplan wird Tag für Tag
 * gezählt: ein paar hundert Schritte im Jahr, und Einschübe laufen ohne
 * Sonderfall mit.
 */
function trainingstageVor(tagMs: number): number {
  const bis = Math.min(tagMs, WOCHENPLAN_AB);
  const diff = Math.round((bis - ANKER_PUSH) / TAG_MS) - pausenVor(bis);
  let n = 2 * Math.floor(diff / 3) + Math.min(((diff % 3) + 3) % 3, 2);

  for (let t = WOCHENPLAN_AB; t < tagMs; t += TAG_MS) {
    if (istTrainingstag(t)) n++;
  }
  return n;
}

/**
 * Der Kalendertag eines Push-Tags, rückwärts aus seinem Index.
 *
 * Gegenstück zu rotationFor(). Gebraucht vom 5/3/1: um den Trainingsmax
 * fortzuschreiben, muss der AMRAP-Satz aus Woche 3 des vorigen Zyklus
 * gefunden werden — und dessen Datum steht nirgends geschrieben, es folgt
 * aus dem Kalender. Ohne diese Umkehrung müsste die Zyklusposition mitgeführt
 * und gepflegt werden; so ist sie jederzeit neu ausrechenbar.
 */
export function datumFuerPushIndex(pushIndex: number): string {
  // Vor dem Anker gibt es keine Einschübe, dort reicht die Dreierrotation.
  if (pushIndex < 0) return isoTag(ANKER_PUSH + pushIndex * 3 * TAG_MS);

  /* Der Push-Tag mit Index k ist der Trainingstag Nummer 2k. Jeder Woche hat
     Trainingstage, die Schleife kommt also immer an. */
  const ziel = pushIndex * 2;
  let n = 0;
  for (let t = ANKER_PUSH; ; t += TAG_MS) {
    if (!istTrainingstag(t)) continue;
    if (n === ziel) return isoTag(t);
    n++;
  }
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
  return Math.ceil(trainingstageVor(Date.parse(`${iso}T00:00:00Z`)) / 2);
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
      /**
       * Der Push-Tag, zu dem dieser Trainingstag gehört: an einem Push-Tag er
       * selbst, an einem Pull-Tag der Push-Tag davor.
       *
       * Neu für die Session-Varianten. Auch ein Pull-Tag muss wissen, wo die
       * 5/3/1-Welle gerade steht — die Spoto Press steht nur am Pull nach
       * einer leichten Push-Einheit, und in der Deload-Woche gar nicht. Ohne
       * diesen Bezug müsste jede Stelle selbst einen Tag zurückrechnen, und
       * das über den Wiener Kalendertag samt eingeschobener Pausen.
       *
       * Getrennt von pushIndex und nicht an dessen Stelle: pushIndex heißt
       * weiterhin "heute ist ein Push-Tag, und zwar dieser". Beides in ein
       * Feld zu legen hieße, dass bankstandFuer() an Pull-Tagen einen
       * scheinbar gültigen Index bekäme und den Trainingsmax von einem Tag aus
       * fortschriebe, an dem gar nicht gebankt wird.
       */
      bezugPushIndex: number;
    }
  | { art: "pause"; naechste: "push" | "pull" };

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
  const tagMs = Date.parse(`${wienerDatum(date)}T00:00:00Z`);
  const vorher = trainingstageVor(tagMs);
  const einheit = vorher % 2 === 0 ? "push" : "pull";

  // An einem Rest Day ist `vorher` zugleich die Nummer des nächsten Trainingstags.
  if (!istTrainingstag(tagMs)) return { art: "pause", naechste: einheit };

  return trainingNach(vorher, einheit);
}

export type Trainingstag = Extract<Rotation, { art: "training" }>;

/**
 * Eine Einheit an einem Tag, an dem der Kalender sie nicht vorsieht —
 * "trotzdem Pull" am Push-Tag, Training am Rest Day.
 *
 * Push gilt als der nächste anstehende Push-Tag, am Push-Tag also er selbst:
 * wer vorzieht, trainiert dessen 5/3/1-Vorgabe. Pull bezieht sich wie jedes
 * Pull auf den letzten Push-Tag davor — daran hängt, ob die Spoto Press
 * mitkommt. An einem Tag, an dem die Einheit ohnehin dran ist, kommt genau
 * dasselbe heraus wie aus rotationFor().
 */
export function trainingAls(date: Date, einheit: "push" | "pull"): Trainingstag {
  return trainingNach(trainingstageVor(Date.parse(`${wienerDatum(date)}T00:00:00Z`)), einheit);
}

/**
 * Hinter heute liegen `vorher` Trainingstage. Der nächste Push-Tag ist damit
 * Nummer ⌈vorher / 2⌉, der letzte davor Nummer ⌊(vorher − 1) / 2⌋. Am
 * planmäßigen Tag fällt beides mit dem Kalender zusammen: Trainingstag 2k ist
 * Push k, Trainingstag 2k + 1 das Pull danach mit Bezug k.
 */
function trainingNach(vorher: number, einheit: "push" | "pull"): Trainingstag {
  if (einheit === "push") {
    const pushIndex = Math.ceil(vorher / 2);
    return { art: "training", einheit, pushIndex, bezugPushIndex: pushIndex };
  }
  return { art: "training", einheit, pushIndex: null, bezugPushIndex: Math.floor((vorher - 1) / 2) };
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

  const { letzteSaetzeFuer } = await import("./workouts");

  /* Eine Abfrage für die ganze Einheit statt zwei je Übung. Vorher lief hier
     ein Promise.all über letzteSaetze() — das sah nebenläufig aus, war es
     aber nicht: der Pool in db.ts steht auf max 1, also gingen die zwanzig
     Abfragen einer Push-Einheit nacheinander über die Leitung. Genau das war
     die Wartezeit beim Wechsel auf den Trainings-Tab.

     Der try umschließt jetzt den einen Aufruf statt jede Übung einzeln. Die
     Haltung bleibt dieselbe: im Gym zählt, dass der Plan dasteht. Ist die
     Datenbank kurz weg, fällt die Einheit auf ihre Referenzwerte zurück,
     statt die Seite mit einem 500 abzuräumen. Das Loggen meldet den Ausfall
     ohnehin sichtbar — satzSpeichern gibt { ok: false, fehler } zurück und
     die Karte zeigt das an. */
  let historie = new Map<string, SetLog[]>();
  try {
    historie = await letzteSaetzeFuer(uebungen.map((ex) => ex.name));
  } catch (e) {
    console.error("Trainingshistorie nicht lesbar, nutze Referenzwerte:", e);
  }

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
