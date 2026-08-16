import { progression, type SetLog } from "./coach";

/**
 * Jakobs Split. "Push/Pull" meint bei ihm Anterior/Posterior — Beine sind an
 * beiden Tagen dabei, nicht als eigener Tag. Rotation: Push – Pull – Pause.
 *
 * Die Gewichte stammen aus dem Kraftwerte-Log (29.07.2026) und den
 * Lift-Off-Screenshots (16.08.2026). Sobald die Datenbank steht, kommen sie
 * von dort; bis dahin sind sie hier der Startpunkt.
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

export type Today =
  | { art: "training"; session: Session }
  | { art: "pause"; naechste: Session };

export function sessionFor(date: Date): Today {
  const day = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.round((day - ANKER_PUSH) / 864e5);
  const slot = ((diff % 3) + 3) % 3;

  if (slot === 0) return { art: "training", session: SESSIONS.push };
  if (slot === 1) return { art: "training", session: SESSIONS.pull };
  return { art: "pause", naechste: SESSIONS.push };
}

export type PlannedExercise = Exercise & {
  ziel: number;
  delta: number;
  grund: string | null;
  prev: string[];
};

function baue(ex: Exercise, last: SetLog[]): PlannedExercise {
  const advice = progression(last);
  return {
    ...ex,
    last,
    ziel: advice.kg,
    delta: advice.delta,
    grund: advice.reason,
    prev: last.map((s) => `${String(s.kg).replace(".", ",")} × ${s.reps}`),
  };
}

/**
 * Startgewichte aus den oben hinterlegten Referenzwerten.
 * Nur noch Rückfallebene — bevorzugt planMitHistorie() verwenden.
 */
export function planFor(session: Session): PlannedExercise[] {
  return session.exercises.map((ex) => baue(ex, ex.last));
}

/**
 * Startgewichte aus der tatsächlichen Trainingshistorie.
 *
 * Solange eine Übung noch nie geloggt wurde, greifen die Referenzwerte aus
 * dem Kraftwerte-Log — sonst stünde beim ersten Training überall null. Sobald
 * ein Satz in der Datenbank liegt, zählt ausschließlich der.
 */
export async function planMitHistorie(session: Session): Promise<PlannedExercise[]> {
  const { letzteSaetze } = await import("./workouts");

  return Promise.all(
    session.exercises.map(async (ex) => {
      const ausDb = await letzteSaetze(ex.name);
      return baue(ex, ausDb.length > 0 ? ausDb : ex.last);
    })
  );
}
