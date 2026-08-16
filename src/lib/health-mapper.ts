/**
 * Übersetzt die Rohantworten der Google Health API in unsere Domänentypen.
 *
 * Zwei Fallen, die hier zentral abgefangen werden:
 *
 * 1. Protobuf-JSON serialisiert 64-Bit-Ganzzahlen als STRING. `minutesAsleep`
 *    und `beatsPerMinute` kommen als "627" bzw. "75", während `weightGrams`
 *    und der HRV-Wert echte Zahlen sind. Naives Weiterrechnen ergibt
 *    Stringverkettung statt Addition.
 *
 * 2. Daten hängen an zwei verschiedenen Zeitachsen: `physicalTime` (UTC) und
 *    `civilTime` (Ortszeit). Für "welcher Tag war das?" zählt IMMER die
 *    Ortszeit — sonst rutscht das Morgengewicht um Mitternacht auf den
 *    Vortag und der Wochenschnitt wird falsch.
 */

import type { WeightEntry } from "./coach";

// ─────────────────────────────────────────────────────────────
// Rohtypen, wie sie tatsächlich ankommen
// ─────────────────────────────────────────────────────────────

type CivilDate = { year: number; month: number; day: number };

type SampleTime = {
  physicalTime: string;
  utcOffset?: string;
  civilTime?: { date: CivilDate; time?: unknown };
};

export type ApiSleepPoint = {
  sleep: {
    interval: { startTime: string; endTime: string };
    type?: string;
    metadata?: { mainSleep?: boolean };
    summary?: {
      minutesAsleep?: string;
      minutesAwake?: string;
      minutesInSleepPeriod?: string;
      stagesSummary?: Array<{ type: string; minutes: string; count?: string }>;
    };
  };
};

export type ApiRestingHrPoint = {
  dailyRestingHeartRate: { date: CivilDate; beatsPerMinute: string };
};

export type ApiHrvPoint = {
  heartRateVariability: {
    sampleTime: SampleTime;
    rootMeanSquareOfSuccessiveDifferencesMilliseconds: number;
  };
};

export type ApiWeightPoint = {
  weight: { sampleTime: SampleTime; weightGrams: number };
};

// ─────────────────────────────────────────────────────────────
// Hilfen
// ─────────────────────────────────────────────────────────────

/** "627" → 627, 627 → 627, undefined → 0 */
function int(v: string | number | undefined | null): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isoFromCivil(d: CivilDate): string {
  return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}

/**
 * Ortsdatum eines Zeitstempels. Nutzt die von der API mitgelieferte civilTime,
 * falls vorhanden — die kennt den korrekten Offset besser als wir.
 */
function localDate(t: SampleTime): string {
  if (t.civilTime?.date) return isoFromCivil(t.civilTime.date);
  const offsetSec = int(t.utcOffset?.replace("s", ""));
  return new Date(Date.parse(t.physicalTime) + offsetSec * 1000)
    .toISOString()
    .slice(0, 10);
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// ─────────────────────────────────────────────────────────────
// Mapper
// ─────────────────────────────────────────────────────────────

export function mapWeight(points: ApiWeightPoint[]): WeightEntry[] {
  const byDay = new Map<string, number[]>();
  for (const p of points) {
    const day = localDate(p.weight.sampleTime);
    const list = byDay.get(day);
    if (list) list.push(p.weight.weightGrams / 1000);
    else byDay.set(day, [p.weight.weightGrams / 1000]);
  }
  // Mehrfachmessungen am selben Tag: die früheste zählt (nüchtern am Morgen).
  return [...byDay.entries()]
    .map(([date, kgs]) => ({ date, kg: Math.round(kgs[0] * 100) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type SleepNight = {
  /** Datum des Aufwachens — so, wie ein Mensch die Nacht benennt. */
  date: string;
  startMs: number;
  endMs: number;
  sleepMin: number;
  deepMin: number;
  remMin: number;
  awakeMin: number;
};

export function mapSleep(points: ApiSleepPoint[]): SleepNight[] {
  const nights = points
    .filter((p) => p.sleep.metadata?.mainSleep !== false)
    .map((p) => {
      const stages = p.sleep.summary?.stagesSummary ?? [];
      const minutesOf = (type: string) =>
        int(stages.find((s) => s.type === type)?.minutes);

      const endMs = Date.parse(p.sleep.interval.endTime);
      return {
        date: new Date(endMs).toISOString().slice(0, 10),
        startMs: Date.parse(p.sleep.interval.startTime),
        endMs,
        sleepMin: int(p.sleep.summary?.minutesAsleep),
        deepMin: minutesOf("DEEP"),
        remMin: minutesOf("REM"),
        awakeMin: int(p.sleep.summary?.minutesAwake),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  /* Fitbit meldet gelegentlich zwei Sessions für dieselbe Nacht — etwa wenn
     jemand zwischendurch länger wach war (bei Jakob am 01.08.: 306 und 448
     Minuten). Beide tragen mainSleep, beide würden als eigener Tag in die
     Reihe wandern und den Schnitt verfälschen. Pro Aufwachtag bleibt deshalb
     die längste Session stehen; kürzere Abschnitte werden ihr zugeschlagen. */
  const byDate = new Map<string, SleepNight>();
  for (const n of nights) {
    const prev = byDate.get(n.date);
    if (!prev) {
      byDate.set(n.date, n);
      continue;
    }
    const [main, extra] = prev.sleepMin >= n.sleepMin ? [prev, n] : [n, prev];
    byDate.set(n.date, {
      ...main,
      startMs: Math.min(main.startMs, extra.startMs),
      endMs: Math.max(main.endMs, extra.endMs),
      sleepMin: main.sleepMin + extra.sleepMin,
      deepMin: main.deepMin + extra.deepMin,
      remMin: main.remMin + extra.remMin,
      awakeMin: main.awakeMin + extra.awakeMin,
    });
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function mapRestingHr(points: ApiRestingHrPoint[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of points) {
    out.set(
      isoFromCivil(p.dailyRestingHeartRate.date),
      int(p.dailyRestingHeartRate.beatsPerMinute)
    );
  }
  return out;
}

/**
 * Aus ~2000 Einzelmessungen einen Wert pro Nacht machen.
 *
 * Zugeordnet wird über die Schlafintervalle statt über das Kalenderdatum:
 * eine Messung um 23:45 gehört zur Nacht, die morgens um 07:18 endet, nicht
 * zum Kalendertag ihres Zeitstempels. Der Median ist robuster als der
 * Mittelwert — einzelne Ausreißer bei Bewegung im Schlaf ziehen ihn nicht mit.
 */
export function nightlyHrv(
  hrvPoints: ApiHrvPoint[],
  nights: SleepNight[]
): Map<string, number> {
  const samples = hrvPoints
    .map((p) => ({
      ms: Date.parse(p.heartRateVariability.sampleTime.physicalTime),
      rmssd:
        p.heartRateVariability.rootMeanSquareOfSuccessiveDifferencesMilliseconds,
    }))
    .filter((s) => Number.isFinite(s.ms) && s.rmssd > 0)
    .sort((a, b) => a.ms - b.ms);

  const out = new Map<string, number>();
  for (const night of nights) {
    const inNight = samples
      .filter((s) => s.ms >= night.startMs && s.ms <= night.endMs)
      .map((s) => s.rmssd);
    if (inNight.length > 0) {
      out.set(night.date, Math.round(median(inNight) * 10) / 10);
    }
  }
  return out;
}

export type DailyReadiness = {
  date: string;
  sleepMin: number;
  deepMin: number;
  restingHr: number;
  hrv: number;
};

/**
 * Führt die drei Quellen zu einer Zeile pro Tag zusammen.
 *
 * Unvollständige Tage werden AUSSORTIERT, nicht mit Nullen aufgefüllt.
 * Ein fehlender Ruhepuls als 0 würde in readiness() als "0 Schläge unter
 * Baseline" gelesen und damit als hervorragende Erholung — fehlende Daten
 * dürfen niemals wie gute Daten aussehen.
 *
 * Der Ruhepuls kommt bei Fitbit aus dem Nachtschlaf ("WITH_SLEEP"), wird von
 * Google aber auf den Kalendertag des Einschlafens datiert, während wir
 * Nächte nach dem Aufwachtag benennen. Deshalb wird zusätzlich der Vortag
 * geprüft, bevor ein Tag verworfen wird.
 */
export function buildDailySeries(
  nights: SleepNight[],
  restingHr: Map<string, number>,
  hrv: Map<string, number>
): { series: DailyReadiness[]; unvollstaendig: string[] } {
  const series: DailyReadiness[] = [];
  const unvollstaendig: string[] = [];

  for (const n of nights) {
    const vortag = new Date(Date.parse(n.date) - 864e5).toISOString().slice(0, 10);
    const hr = restingHr.get(n.date) ?? restingHr.get(vortag) ?? 0;
    const v = hrv.get(n.date) ?? 0;

    if (n.sleepMin > 0 && hr > 0 && v > 0) {
      series.push({
        date: n.date,
        sleepMin: n.sleepMin,
        deepMin: n.deepMin,
        restingHr: hr,
        hrv: v,
      });
    } else {
      unvollstaendig.push(n.date);
    }
  }

  return { series, unvollstaendig };
}

/**
 * Persönliche Referenz aus den ruhigsten Tagen des Zeitraums.
 *
 * Bewusst NICHT der Mittelwert über alles: eine Urlaubswoche oder ein Infekt
 * würde die Baseline mitverschieben, und dann sieht ein schlechter Wert
 * plötzlich normal aus. Stattdessen je Kennzahl die bessere Hälfte.
 */
export function deriveBaseline(series: DailyReadiness[]): DailyReadiness | null {
  const usable = series.filter((d) => d.hrv > 0 && d.restingHr > 0);
  if (usable.length < 5) return null;

  const best = (pick: (d: DailyReadiness) => number, prefer: "hoch" | "niedrig") => {
    const vals = usable.map(pick).sort((a, b) => a - b);
    const half =
      prefer === "hoch"
        ? vals.slice(Math.floor(vals.length / 2))
        : vals.slice(0, Math.ceil(vals.length / 2));
    return Math.round((half.reduce((s, v) => s + v, 0) / half.length) * 10) / 10;
  };

  return {
    date: "baseline",
    sleepMin: best((d) => d.sleepMin, "hoch"),
    deepMin: best((d) => d.deepMin, "hoch"),
    restingHr: best((d) => d.restingHr, "niedrig"),
    hrv: best((d) => d.hrv, "hoch"),
  };
}
