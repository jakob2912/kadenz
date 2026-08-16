/**
 * Kadenz — Coach-Logik
 *
 * Das hier ist der Unterschied zwischen einem Tracker und einem Coach.
 * Alles in diesem Modul ist rein: keine Netzwerkaufrufe, kein I/O,
 * damit die Regeln testbar bleiben und nicht in Komponenten verstreut sind.
 */

export type WeightEntry = {
  /** ISO-Datum, YYYY-MM-DD */
  date: string;
  kg: number;
};

export type SetLog = {
  reps: number;
  kg: number;
};

export type ReadinessInput = {
  sleepMin: number;
  deepMin: number;
  restingHr: number;
  hrv: number;
};

/** Persönliche Referenzwerte, aus ruhigen Wochen gemittelt. */
export type ReadinessBaseline = ReadinessInput;

// ─────────────────────────────────────────────────────────────
// Gewicht
// ─────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);
}

/** Gleitender Schnitt über die letzten `window` Einträge. */
export function movingAverage(entries: WeightEntry[], window = 7): number | null {
  if (entries.length === 0) return null;
  const slice = entries.slice(-window);
  return slice.reduce((sum, e) => sum + e.kg, 0) / slice.length;
}

export type TrendVerdict =
  | { usable: true; kgPerWeek: number; basis: WeightEntry }
  | {
      usable: false;
      reason: "zu-wenig-daten" | "luecke" | "nicht-stabilisiert" | "zu-kurz";
      detail: string;
    };

/**
 * Kernregel, entstanden aus dem Urlaub im August 2026:
 *
 * Nach einer Messlücke ist der Trend NICHT verwertbar, bis sich das
 * Gewicht wieder eingependelt hat. Sonst dreht man zweimal in die
 * falsche Richtung — erst "zu schnell zugenommen, Kalorien runter",
 * zehn Tage später "nimmt ab, Kalorien rauf". Beide Male falsch,
 * weil in Wahrheit nur Wasser und Glykogen unterwegs waren.
 *
 * Stabil heißt: drei Messungen in Folge innerhalb von `toleranceKg`.
 */
export function assessTrend(
  entries: WeightEntry[],
  opts: { gapDays?: number; toleranceKg?: number } = {}
): TrendVerdict {
  const gapDays = opts.gapDays ?? 3;
  const toleranceKg = opts.toleranceKg ?? 0.3;

  if (entries.length < 7) {
    return {
      usable: false,
      reason: "zu-wenig-daten",
      detail: `${entries.length} von 7 Messungen — für einen Wochenschnitt zu wenig.`,
    };
  }

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  // Jüngste Lücke suchen: alles davor gehört zu einer anderen Messreihe.
  let gapAt = -1;
  for (let i = sorted.length - 1; i > 0; i--) {
    if (daysBetween(sorted[i - 1].date, sorted[i].date) > gapDays) {
      gapAt = i;
      break;
    }
  }

  if (gapAt >= 0) {
    const since = sorted.slice(gapAt);
    if (!isStabilised(since, toleranceKg)) {
      const missing = daysBetween(sorted[gapAt - 1].date, sorted[gapAt].date) - 1;
      return {
        usable: false,
        reason: "luecke",
        detail:
          `${missing} Tage ohne Messung, danach noch keine drei stabilen Tage. ` +
          `Was du gerade siehst, ist Wasser und Glykogen — kein Gewebe. Ich rechne noch nicht.`,
      };
    }
    // Stabilisiert: nur die neue Messreihe zählt.
    return rate(since);
  }

  if (hasJump(sorted) && !isStabilised(sorted, toleranceKg)) {
    return {
      usable: false,
      reason: "nicht-stabilisiert",
      detail:
        "Sprung im Verlauf, der physiologisch kein Gewebe sein kann. Ich warte drei stabile Tage ab.",
    };
  }

  return rate(sorted);
}

/** Drei Messungen in Folge innerhalb der Toleranz. */
function isStabilised(entries: WeightEntry[], toleranceKg: number): boolean {
  if (entries.length < 3) return false;
  const last3 = entries.slice(-3).map((e) => e.kg);
  return Math.max(...last3) - Math.min(...last3) <= toleranceKg;
}

/**
 * Mehr als 1,5 kg echte Wochenänderung ist bei natürlichem Aufbau nicht möglich —
 * so etwas ist immer Wasser, Darminhalt oder ein Messfehler.
 *
 * Verglichen werden bewusst 3-Tages-Mittel gegen 3-Tages-Mittel, nicht
 * aufeinanderfolgende Tage: das Tagesgewicht schwankt um ±0,4 kg, und ein
 * einzelner Tagesunterschied von 0,5 kg auf eine Woche hochgerechnet ergäbe
 * 3,5 kg/Woche. Damit würde jede normale Messreihe als "Sprung" gelten.
 */
function hasJump(entries: WeightEntry[]): boolean {
  const W = 3;
  if (entries.length < W * 2) return false;

  const meanOf = (xs: WeightEntry[]) => xs.reduce((s, e) => s + e.kg, 0) / xs.length;

  for (let i = W; i + W <= entries.length; i++) {
    const before = entries.slice(i - W, i);
    const after = entries.slice(i, i + W);
    const days = Math.max(
      1,
      daysBetween(before[W >> 1].date, after[W >> 1].date)
    );
    const perWeek = ((meanOf(after) - meanOf(before)) / days) * 7;
    if (Math.abs(perWeek) > 1.5) return true;
  }
  return false;
}

/**
 * Kürzeste Messreihe, aus der sich eine Rate ableiten lässt.
 *
 * Das Tagesgewicht schwankt um ±0,4 kg. Über eine Woche kann man damit
 * 0,25 von 0,50 kg/Woche schlicht nicht unterscheiden — zwei Drei-Tages-
 * Fenster mit 0,3 kg Unterschied ergeben rechnerisch 0,58 kg/Woche, obwohl
 * in Wahrheit nichts passiert ist. Erst ab zwei Wochen mittelt sich das Rauschen
 * genug heraus. Lieber "weiß ich noch nicht" sagen als eine Zahl erfinden.
 */
const MIN_SPAN_DAYS = 14;

/** Erste gegen zweite Hälfte der Reihe — robuster als Endpunkt minus Startpunkt. */
function rate(entries: WeightEntry[]): TrendVerdict {
  const half = Math.floor(entries.length / 2);
  if (half < 1) {
    return { usable: false, reason: "zu-wenig-daten", detail: "Zu kurze Messreihe." };
  }

  const totalSpan = daysBetween(entries[0].date, entries[entries.length - 1].date);
  if (totalSpan < MIN_SPAN_DAYS) {
    return {
      usable: false,
      reason: "zu-kurz",
      detail:
        `Erst ${totalSpan} Tage seit der letzten belastbaren Basis. ` +
        `Unter ${MIN_SPAN_DAYS} Tagen ist die Tagesschwankung größer als der Trend — ` +
        `jede Rate wäre geraten. Noch ${MIN_SPAN_DAYS - totalSpan} Tage.`,
    };
  }

  const older = entries.slice(0, half);
  const newer = entries.slice(-half);
  const avgOld = movingAverage(older, older.length)!;
  const avgNew = movingAverage(newer, newer.length)!;
  const midOld = older[Math.floor(older.length / 2)].date;
  const midNew = newer[Math.floor(newer.length / 2)].date;
  const spanDays = Math.max(1, daysBetween(midOld, midNew));

  return {
    usable: true,
    kgPerWeek: ((avgNew - avgOld) / spanDays) * 7,
    basis: entries[entries.length - 1],
  };
}

// ─────────────────────────────────────────────────────────────
// Regeneration
// ─────────────────────────────────────────────────────────────

export type ReadinessVerdict = {
  score: number;
  band: "gut" | "mittel" | "schlecht";
  /** Krafttraining ist deutlich robuster gegen schlechte Erholung als Cardio. */
  allowLifting: boolean;
  allowCardio: boolean;
  drivers: string[];
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function readiness(
  now: ReadinessInput,
  base: ReadinessBaseline
): ReadinessVerdict {
  const drivers: string[] = [];

  const sleep = clamp((now.sleepMin / base.sleepMin) * 100, 0, 110);
  if (now.sleepMin < base.sleepMin - 45) drivers.push("zu wenig Schlaf");

  const deep = clamp((now.deepMin / base.deepMin) * 100, 0, 110);
  if (now.deepMin < base.deepMin - 20) drivers.push("wenig Tiefschlaf");

  // Ruhepuls: jeder Schlag über Baseline kostet 8 Punkte
  const hrElevation = now.restingHr - base.restingHr;
  const hr = clamp(100 - hrElevation * 8, 0, 110);
  if (hrElevation > 2) {
    // Baseline ist ein Mittelwert und damit fast immer gebrochen —
    // ohne Rundung steht hier "12.100000000000001 über Normal".
    drivers.push(`Ruhepuls ${hrElevation.toFixed(1).replace(".", ",")} über Normal`);
  }

  // HRV reagiert am empfindlichsten auf Systembelastung — entsprechend steil bewertet
  const hrvRatio = now.hrv / base.hrv;
  const hrv = clamp(100 + (hrvRatio - 1) * 140, 0, 110);
  if (hrvRatio < 0.85) drivers.push("HRV gedrückt");

  let score = Math.round(sleep * 0.25 + deep * 0.15 + hr * 0.3 + hrv * 0.3);

  /* Autonome Marker dominieren. Eine gute Schlafdauer darf einen erhöhten
     Ruhepuls nicht wegmitteln — genau das führt sonst dazu, dass die App
     nach einer Urlaubswoche "alles super, mach Cardio" sagt, während der
     Körper noch mit der Erholung beschäftigt ist. */
  if (hrElevation >= 3) score = Math.min(score, 70);
  if (hrvRatio <= 0.85) score = Math.min(score, 72);
  if (drivers.length >= 3) score = Math.min(score, 68);

  score = clamp(score, 0, 100);
  const band = score >= 75 ? "gut" : score >= 55 ? "mittel" : "schlecht";

  /* Krafttraining verträgt schlechte Erholung deutlich besser als Cardio:
     es belastet primär lokal, nicht das Herz-Kreislauf-System. Deshalb hat
     Cardio zusätzlich zum Score harte Kriterien an den autonomen Markern. */
  const allowCardio = score >= 72 && hrElevation <= 2 && hrvRatio >= 0.9;

  return { score, band, allowLifting: score >= 45, allowCardio, drivers };
}

// ─────────────────────────────────────────────────────────────
// Progression
// ─────────────────────────────────────────────────────────────

export type ProgressionAdvice = {
  kg: number;
  delta: number;
  reason: string | null;
};

/**
 * Jakobs Regel, wörtlich aus dem Vault:
 * "bei 8 Reps geschafft → Gewicht leicht erhöhen; unter 5 Reps → Gewicht verringern"
 *
 * Sein zweiter Satz ist systematisch ~1 Wiederholung schwächer. Deshalb
 * entscheidet Satz 1 über die Erhöhung, aber JEDER Satz unter der
 * Untergrenze löst eine Reduktion aus — sonst klebt man wochenlang am
 * Limit und sammelt Sätze mit 4 Wiederholungen (siehe T Bar Row 08/2026).
 */
export function progression(
  lastSets: SetLog[],
  opts: { minReps?: number; maxReps?: number; step?: number } = {}
): ProgressionAdvice {
  const minReps = opts.minReps ?? 5;
  const maxReps = opts.maxReps ?? 8;
  const step = opts.step ?? 2.5;

  if (lastSets.length === 0) return { kg: 0, delta: 0, reason: null };

  const current = lastSets[0].kg;
  const belowFloor = lastSets.find((s) => s.reps < minReps);

  if (belowFloor) {
    const delta = -roundToStep(Math.max(step, current * 0.05), step);
    return {
      kg: current + delta,
      delta,
      reason: `Ein Satz lief mit ${belowFloor.reps} Wiederholungen — unter deiner Untergrenze von ${minReps}.`,
    };
  }

  if (lastSets[0].reps >= maxReps) {
    return {
      kg: current + step,
      delta: step,
      reason: `${lastSets[0].reps} Wiederholungen im ersten Satz — Obergrenze erreicht.`,
    };
  }

  return { kg: current, delta: 0, reason: null };
}

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

// ─────────────────────────────────────────────────────────────
// Kalorien
// ─────────────────────────────────────────────────────────────

/**
 * Der Verbrauch ist NICHT konstant. Seit dem Ende des RRI-Jobs (August 2026)
 * gibt es nur noch zwei Zustände: Schulzeit ab 07.09.2026 mit festem
 * Tagesablauf und Weg zur Schule, davor Ferien ohne Verpflichtungen.
 * Ein fixes Kalorienziel wäre damit die halbe Zeit falsch.
 */
export type Phase = "schule" | "ferien";

/** Ab diesem Datum gilt wieder die Schulzeit-Phase. */
export const SCHULSTART = "2026-09-07";

export function phaseFor(date: Date | string): Phase {
  const iso = typeof date === "string" ? date : date.toISOString().slice(0, 10);
  return iso >= SCHULSTART ? "schule" : "ferien";
}

/** ~6000 kcal pro kg Körpermasse im Aufbau (Gewebe + Wasser, nicht reines Fett). */
const KCAL_PER_KG = 6000;

export function calorieTarget(
  tdee: Record<Phase, number>,
  phase: Phase,
  targetKgPerWeek: number
): { kcal: number; surplus: number } {
  const surplus = Math.round((targetKgPerWeek * KCAL_PER_KG) / 7);
  return { kcal: Math.round((tdee[phase] + surplus) / 10) * 10, surplus };
}

/**
 * Rückrechnung: Was verbraucht er wirklich? Zuverlässiger als jede Formel,
 * weil es auf seinen eigenen Messwerten beruht statt auf einer Schätzung.
 * Nur aufrufen, wenn assessTrend() den Verlauf für verwertbar hält.
 */
export function inferTdee(intakeKcal: number, actualKgPerWeek: number): number {
  return Math.round((intakeKcal - (actualKgPerWeek * KCAL_PER_KG) / 7) / 10) * 10;
}

/** Wochen bis zum Zielgewicht bei gegebener Rate. */
export function weeksToGoal(
  currentKg: number,
  goalKg: number,
  kgPerWeek: number
): number | null {
  if (kgPerWeek <= 0) return null;
  return Math.ceil((goalKg - currentKg) / kgPerWeek);
}
