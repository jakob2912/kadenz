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

// ─────────────────────────────────────────────────────────────
// Kalorienziel anpassen
// ─────────────────────────────────────────────────────────────

/** Ein vollständiges Tagesziel. */
export type Makros = {
  kcal: number;
  kohlenhydrateG: number;
  eiweissG: number;
  fettG: number;
};

/**
 * Zielkorridor der Gewichtszunahme in kg pro Woche.
 *
 * 0,50 ist Jakobs Obergrenze, nicht sein Wunsch — darüber geht der Überschuss
 * vor allem ins Fett. Unter 0,25 passiert zu wenig, um im Aufbau etwas zu
 * bringen. Dieselben beiden Zahlen stehen im Urteil auf der Startseite; sie
 * gehören hierher, damit es nur eine Definition davon gibt.
 */
export const ZIEL_RATE_UNTEN = 0.25;
export const ZIEL_RATE_OBEN = 0.5;

/**
 * Angepeilt wird die Mitte des Korridors, nicht die nächstgelegene Kante.
 *
 * Wer auf 0,25 zielt, landet bei der nächsten Messung mit gleicher
 * Wahrscheinlichkeit knapp darunter wie knapp darüber — und bekommt zehn Tage
 * später den nächsten Vorschlag in dieselbe Richtung. Die Mitte hat nach oben
 * wie nach unten Luft.
 */
const ZIEL_RATE_MITTE = (ZIEL_RATE_UNTEN + ZIEL_RATE_OBEN) / 2;

/**
 * Mindestabstand zwischen zwei Anpassungen in Tagen.
 *
 * Kürzer geht nicht: die Tagesschwankung des Gewichts liegt bei ±0,4 kg, und
 * ob 170 kcal mehr etwas bewirkt haben, ist darunter nicht von Rauschen zu
 * unterscheiden. Wer alle drei Tage nachschraubt, misst nur noch sich selbst.
 */
export const MIN_TAGE_ZWISCHEN_ANPASSUNGEN = 10;

/**
 * Schrittweite einer Anpassung.
 *
 * Nicht "auf einen Schlag die fehlenden 400 kcal": ein großer Sprung landet
 * regelmäßig über dem Korridor, und die Korrektur nach unten kostet mehr Zeit
 * als der kleinere Schritt gespart hätte.
 */
const SCHRITT_MIN_KCAL = 150;
const SCHRITT_MAX_KCAL = 200;

const KCAL_PRO_G_KOHLENHYDRAT = 4;

/**
 * Eiweiß bleibt bei einer Anpassung stehen, die Kalorien gehen in die
 * Kohlenhydrate.
 *
 * Grund: 180 g decken bei Jakobs Gewicht rund 2,2 g/kg ab, und mehr Eiweiß
 * bringt im Aufbau nachweislich nichts. Kohlenhydrate füllen dagegen das
 * Glykogen und tragen das Training. Fett bleibt bei 65 g, weil darunter die
 * Hormonlage leidet und darüber nur die Verdrängung anderer Makros stünde.
 *
 * Die Untergrenze ist kein Rechenwert, sondern eine Meldeschwelle: fällt das
 * Verhältnis darunter, weil er schwerer geworden ist, sagt der Vorschlag das —
 * er entscheidet es nicht still um.
 */
const EIWEISS_G_PRO_KG_UNTERGRENZE = 1.8;

export type Anpassung = {
  richtung: "hoch" | "runter";
  /** Vorzeichenbehaftet: negativ bei einer Senkung. */
  deltaKcal: number;
  neu: Makros;
  gemesseneRate: number;
  zielRate: number;
  begruendung: string;
  /** Nur gesetzt, wenn das Eiweiß nicht mehr zum Körpergewicht passt. */
  eiweissNotiz: string | null;
};

export type AnpassungsUrteil =
  | { art: "vorschlag"; anpassung: Anpassung }
  | { art: "kein-vorschlag"; grund: string };

/**
 * Soll das Kalorienziel geändert werden?
 *
 * Die Funktion darf ausdrücklich "weiß ich noch nicht" antworten, und tut das
 * öfter als sie einen Vorschlag macht. Drei Tore stehen davor:
 *
 *  1. Seit der letzten Anpassung müssen MIN_TAGE_ZWISCHEN_ANPASSUNGEN vergangen
 *     sein. Vorher misst man die Änderung nicht, sondern das Wasser danach.
 *  2. Gemessen wird nur ab der letzten Anpassung. Eine Rate, die quer über eine
 *     Kalorienänderung hinweg gebildet wird, mittelt zwei verschiedene
 *     Ernährungen zu einer Zahl, die keine von beiden beschreibt.
 *  3. assessTrend() muss die Reihe für verwertbar halten. Sagt es nein — zu
 *     wenige Messungen, Lücke nach dem Urlaub, noch nicht stabilisiert —, wird
 *     dessen Begründung durchgereicht, statt eine Zahl zu erfinden.
 *
 * Aus 2 und 3 zusammen folgt, dass die tatsächliche Wartezeit nach einer
 * Anpassung oft über zehn Tagen liegt: assessTrend verlangt zusätzlich eine
 * Spanne von 14 Tagen. Das ist beabsichtigt — zehn Tage sind das Minimum,
 * nicht das Versprechen.
 */
export function kalorienAnpassung(opts: {
  aktuell: Makros;
  gewicht: WeightEntry[];
  /** Stichtag der letzten Anpassung als ISO. null = noch nie angepasst. */
  letzteAnpassung: string | null;
  /** Heutiger Kalendertag als ISO, in Ortszeit ermittelt. */
  heute: string;
  /** Für die Eiweiß-Meldeschwelle. null = kein aktueller Messwert. */
  koerpergewichtKg: number | null;
}): AnpassungsUrteil {
  const { aktuell, letzteAnpassung, heute, koerpergewichtKg } = opts;

  let reihe = opts.gewicht;

  if (letzteAnpassung !== null) {
    const tage = daysBetween(letzteAnpassung, heute);
    if (tage < MIN_TAGE_ZWISCHEN_ANPASSUNGEN) {
      const rest = MIN_TAGE_ZWISCHEN_ANPASSUNGEN - tage;
      return {
        art: "kein-vorschlag",
        grund:
          `Das Ziel steht seit ${tage === 1 ? "einem Tag" : `${tage} Tagen`}. ` +
          `Unter ${MIN_TAGE_ZWISCHEN_ANPASSUNGEN} Tagen ist nicht zu erkennen, ob die Änderung ` +
          `gewirkt hat oder ob das nur Wasser war — noch ${rest === 1 ? "ein Tag" : `${rest} Tage`}.`,
      };
    }
    reihe = opts.gewicht.filter((e) => e.date >= letzteAnpassung);
  }

  const trend = assessTrend(reihe);
  if (!trend.usable) return { art: "kein-vorschlag", grund: trend.detail };

  const rate = trend.kgPerWeek;

  if (rate >= ZIEL_RATE_UNTEN && rate <= ZIEL_RATE_OBEN) {
    return {
      art: "kein-vorschlag",
      grund:
        `Dein Schnitt steigt mit ${komma(rate, 2)} kg pro Woche — im Zielkorridor von ` +
        `${komma(ZIEL_RATE_UNTEN, 2)} bis ${komma(ZIEL_RATE_OBEN, 2)}. Am Ziel ist nichts zu ändern.`,
    };
  }

  const deltaKcal = schritt(ZIEL_RATE_MITTE - rate);
  const richtung: "hoch" | "runter" = deltaKcal > 0 ? "hoch" : "runter";

  /* Die neuen Kohlenhydrate aus dem TATSÄCHLICHEN Delta, nicht aus dem
     ungekappten Wunsch: sonst stünde im Vorschlag eine Kalorienzahl, die zu
     den Gramm daneben nicht passt. */
  const kohlenhydrateNeu =
    aktuell.kohlenhydrateG + Math.round(deltaKcal / KCAL_PRO_G_KOHLENHYDRAT);

  const erwarteteRate = rate + (deltaKcal * 7) / KCAL_PER_KG;

  const kopf =
    richtung === "hoch"
      ? `Dein Schnitt steigt mit ${komma(rate, 2)} kg pro Woche — unter dem Zielkorridor ` +
        `von ${komma(ZIEL_RATE_UNTEN, 2)} bis ${komma(ZIEL_RATE_OBEN, 2)}.`
      : `Dein Schnitt steigt mit ${komma(rate, 2)} kg pro Woche — über deiner Obergrenze ` +
        `von ${komma(ZIEL_RATE_OBEN, 2)}. Ab hier geht der Überschuss vor allem ins Fett.`;

  const rechnung =
    `${Math.abs(deltaKcal)} kcal ${richtung === "hoch" ? "mehr" : "weniger"} ` +
    `bringen dich rechnerisch auf ${komma(erwarteteRate, 2)} kg pro Woche. ` +
    `Sie ${richtung === "hoch" ? "gehen in die" : "kommen aus den"} Kohlenhydrate` +
    `${richtung === "hoch" ? "" : "n"}: ${aktuell.kohlenhydrateG} → ${kohlenhydrateNeu} g. ` +
    `Eiweiß und Fett bleiben.`;

  return {
    art: "vorschlag",
    anpassung: {
      richtung,
      deltaKcal,
      neu: {
        kcal: aktuell.kcal + deltaKcal,
        kohlenhydrateG: kohlenhydrateNeu,
        eiweissG: aktuell.eiweissG,
        fettG: aktuell.fettG,
      },
      gemesseneRate: rate,
      zielRate: ZIEL_RATE_MITTE,
      begruendung: `${kopf} ${rechnung}`,
      eiweissNotiz: eiweissNotiz(aktuell.eiweissG, koerpergewichtKg),
    },
  };
}

/**
 * Vom rechnerischen Bedarf zur erlaubten Schrittweite.
 *
 * Gerundet wird auf 10 kcal, wie schon in calorieTarget() — eine Zahl wie
 * 173 kcal täuscht eine Genauigkeit vor, die aus einer Gewichtsreihe mit
 * ±0,4 kg Tagesschwankung nicht herauszuholen ist.
 */
function schritt(rateLuecke: number): number {
  const roh = (rateLuecke * KCAL_PER_KG) / 7;
  const betrag = Math.min(SCHRITT_MAX_KCAL, Math.max(SCHRITT_MIN_KCAL, Math.abs(roh)));
  return Math.sign(roh) * Math.round(betrag / 10) * 10;
}

function eiweissNotiz(eiweissG: number, koerpergewichtKg: number | null): string | null {
  if (koerpergewichtKg === null || koerpergewichtKg <= 0) return null;

  const proKg = eiweissG / koerpergewichtKg;
  if (proKg >= EIWEISS_G_PRO_KG_UNTERGRENZE) return null;

  return (
    `Eiweiß bleibt bei ${eiweissG} g — bei ${komma(koerpergewichtKg, 1)} kg sind das nur noch ` +
    `${komma(proKg, 2)} g/kg. Ab hier gehört der nächste Schritt ins Eiweiß statt in die ` +
    `Kohlenhydrate. Das ist eine Frage an Fitnessbell, nicht an mich.`
  );
}

/**
 * Deutsches Dezimalkomma.
 *
 * Eigene Fassung statt de() aus components/ui.tsx: dieses Modul ist rein und
 * darf keine Komponentendatei importieren — ui.tsx zieht next/link nach.
 */
function komma(n: number, digits: number): string {
  return n.toFixed(digits).replace(".", ",");
}

// ─────────────────────────────────────────────────────────────
// Tagesbriefing
// ─────────────────────────────────────────────────────────────

/**
 * Ab dieser Uhrzeit kein Koffein mehr.
 *
 * Kreatin und Koffein nimmt Jakob täglich; als Checkliste haben sie im
 * Dashboard nichts verloren. Der eine Fall, der eine Ansage wert ist: das
 * Training rutscht hinter den Cutoff. Dann ist die Frage nicht mehr "hast du
 * genommen", sondern "heute besser ohne".
 */
export const KOFFEIN_CUTOFF_STUNDE = 15;

export type Vorschlag = {
  /** Was zu tun ist — als Handlung, nicht als Zustandsbeschreibung. */
  text: string;
  /** Der gemessene Wert, aus dem er folgt. */
  grund: string;
};

export type Briefing = {
  /** Wie die Nacht war, gegen die persönliche Referenz. */
  schlaf: string;
  /** Die Freigabe für heute, in einem Satz. */
  befund: string;
  vorschlaege: Vorschlag[];
};

export type BriefingEingabe = {
  heute: ReadinessInput;
  baseline: ReadinessBaseline;
  urteil: ReadinessVerdict;
  /** Aufwachtag der ausgewerteten Nacht, ISO. */
  nachtDatum: string;
  /** Heutiger Kalendertag in Wiener Zeit, ISO. */
  heuteIso: string;
  /** Steht heute eine Einheit an? Nur dann ist die Koffein-Regel eine Frage. */
  trainingHeute: boolean;
  /** Stunde in Wiener Zeit, 0–23. */
  stunde: number;
};

/**
 * Das Tagesbriefing: wie die Nacht war und was daraus folgt.
 *
 * Jeder Vorschlag hängt an einem gemessenen Treiber. Liegt keiner vor, ist
 * die Liste leer — und das ist die Aussage. Eine Liste, die immer drei Punkte
 * hat, wird nach einer Woche überblättert, weil sie an guten Tagen dasselbe
 * sagt wie an schlechten.
 *
 * Rein wie der Rest der Datei: den Text erzeugen App und MCP-Server aus
 * derselben Funktion, sonst gäbe Kadenz im Chat einen anderen Rat als auf der
 * Startseite.
 */
export function briefing(e: BriefingEingabe): Briefing {
  const { heute, baseline, urteil } = e;

  const schlafDelta = heute.sleepMin - baseline.sleepMin;
  const tiefDelta = heute.deepMin - baseline.deepMin;
  const hrElevation = heute.restingHr - baseline.restingHr;
  const hrvAnteil = heute.hrv / baseline.hrv;

  const tageAlt = Math.round(
    (Date.parse(`${e.heuteIso}T00:00:00Z`) - Date.parse(`${e.nachtDatum}T00:00:00Z`)) / 864e5
  );

  const vorschlaege: Vorschlag[] = [];

  /* Die Schwellen sind dieselben, die readiness() zu drivers führen. Zwei
     verschiedene Grenzen für dieselbe Aussage hießen, dass die Karte einen
     Treiber nennt, zu dem darunter kein Vorschlag steht. */
  if (schlafDelta < -45) {
    vorschlaege.push({
      text: `Geh heute rund ${Math.round(-schlafDelta / 5) * 5} Minuten früher ins Bett als gestern.`,
      grund: `${hm(heute.sleepMin)} statt deiner üblichen ${hm(baseline.sleepMin)}.`,
    });
  }

  if (tiefDelta < -20) {
    vorschlaege.push({
      text: "Heute nichts Schweres mehr in den letzten drei Stunden vor dem Schlafen, und das Training nicht in den späten Abend schieben.",
      grund:
        `${Math.round(heute.deepMin)} statt ${Math.round(baseline.deepMin)} Minuten Tiefschlaf. ` +
        `Woran es lag, misst die Uhr nicht — Alkohol, spätes Essen und ein spätes Training ` +
        `sind die drei üblichen, und alle drei kannst du heute anders machen.`,
    });
  }

  if (hrElevation >= 3) {
    vorschlaege.push({
      text: "Heute keine zusätzliche Ausdauerbelastung. Kraft ja, aber ohne Extras drumherum.",
      grund:
        `Ruhepuls ${komma(hrElevation, 1)} Schläge über deinem Normalwert. Krafttraining ` +
        `belastet vor allem lokal und verträgt das; Cardio zieht die Erholung in die Länge, ` +
        `ohne dir im Aufbau etwas zu bringen.`,
    });
  }

  if (hrvAnteil <= 0.85) {
    vorschlaege.push({
      text: "Nimm heute Volumen raus statt Gewicht — einen Satz weniger je Übung, die Gewichte lässt du stehen.",
      grund:
        `HRV bei ${Math.round(hrvAnteil * 100)} % deines Normalwerts. Das ist der Marker, der ` +
        `am empfindlichsten auf Gesamtbelastung reagiert. Weniger Sätze senken sie, ` +
        `leichtere Gewichte kosten dich nur den Reiz.`,
    });
  }

  if (e.trainingHeute && e.stunde >= KOFFEIN_CUTOFF_STUNDE) {
    vorschlaege.push({
      text: "Heute ohne Koffein trainieren.",
      grund:
        `Es ist nach ${KOFFEIN_CUTOFF_STUNDE}:00, deinem Cutoff. Jetzt noch genommen steht es ` +
        `dir nachts im Weg — und der Schlaf ist der Hebel, an dem alles andere hängt.`,
    });
  }

  return {
    schlaf: schlafSatz(heute, baseline, schlafDelta, tiefDelta, tageAlt, e.nachtDatum),
    befund: befundSatz(urteil),
    vorschlaege,
  };
}

function schlafSatz(
  heute: ReadinessInput,
  baseline: ReadinessBaseline,
  schlafDelta: number,
  tiefDelta: number,
  tageAlt: number,
  nachtDatum: string
): string {
  /* Bei veralteten Daten steht das Datum vorne, nicht als Fußnote. "Du hast
     6 h 10 geschlafen" ist schlicht falsch, wenn die Nacht drei Tage her ist,
     und wer den Satz liest, bezieht ihn sonst auf heute. */
  const kopf =
    tageAlt >= 1
      ? `Die letzte ausgewertete Nacht ist die auf ${nachtDatum} — nicht heute Nacht. Damals: `
      : "";

  const dauer =
    Math.abs(schlafDelta) < 15
      ? `${hm(heute.sleepMin)}, praktisch genau deine übliche Länge`
      : schlafDelta < 0
        ? `${hm(heute.sleepMin)} statt deiner üblichen ${hm(baseline.sleepMin)} — ${Math.round(-schlafDelta)} Minuten weniger`
        : `${hm(heute.sleepMin)} statt deiner üblichen ${hm(baseline.sleepMin)} — ${Math.round(schlafDelta)} Minuten mehr`;

  const tief =
    Math.abs(tiefDelta) < 10
      ? `Tiefschlaf ${Math.round(heute.deepMin)} Minuten, auf Referenzniveau.`
      : tiefDelta < 0
        ? `Tiefschlaf ${Math.round(heute.deepMin)} statt ${Math.round(baseline.deepMin)} Minuten.`
        : `Tiefschlaf ${Math.round(heute.deepMin)} Minuten, ${Math.round(tiefDelta)} über Referenz.`;

  return `${kopf}${dauer}. ${tief}`;
}

function befundSatz(urteil: ReadinessVerdict): string {
  if (urteil.band === "gut") {
    return "Volle Freigabe. Deine Werte liegen auf Normalniveau — Training läuft wie geplant, Cardio ist frei.";
  }
  if (urteil.allowLifting) {
    return "Krafttraining ja, Cardio nein.";
  }
  return "Heute nur locker.";
}

/** Minuten als "7 h 05". Eigene Fassung, damit das Modul rein bleibt. */
function hm(minuten: number): string {
  const m = Math.round(minuten);
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}
