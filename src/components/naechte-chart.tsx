"use client";

import { useState } from "react";
import { Card, Eyebrow } from "@/components/ui";
import { ReihenChart } from "@/components/reihen-chart";
import type { DailyReadiness } from "@/lib/health-mapper";

const MESSGROESSEN = {
  schlaf: { label: "Sleep", einheit: "h", stellen: 1, wert: (n: DailyReadiness) => n.sleepMin / 60 },
  ruhepuls: { label: "Resting HR", einheit: "bpm", stellen: 0, wert: (n: DailyReadiness) => n.restingHr },
  hrv: { label: "HRV", einheit: "ms", stellen: 0, wert: (n: DailyReadiness) => n.hrv },
} as const;

type Messgroesse = keyof typeof MESSGROESSEN;

/**
 * Die Nächte über die Zeit — bisher gab es nur die Referenzwerte als Zahlen,
 * aber keinen Verlauf. Ob der Ruhepuls seit dem Aufbau langsam steigt oder
 * die HRV im Mini-Cut fällt, sieht man erst über Wochen; dafür liegt seit
 * Oktober 2026 ein Jahr in der eigenen Ablage.
 *
 * Eine Größe auf einmal statt drei Linien übereinander: Stunden, Schläge und
 * Millisekunden teilen sich keine Achse.
 */
export function NaechteChart({ naechte }: { naechte: DailyReadiness[] }) {
  const [groesse, setGroesse] = useState<Messgroesse>("schlaf");
  const m = MESSGROESSEN[groesse];

  return (
    <Card className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Eyebrow>Nächte</Eyebrow>
        <div className="inline-flex rounded-lg border border-hair bg-surface-2 p-1" role="group" aria-label="Metric">
          {(Object.keys(MESSGROESSEN) as Messgroesse[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={k === groesse}
              onClick={() => setGroesse(k)}
              className={`min-h-[36px] rounded-md px-3 text-[12px] font-semibold transition-colors ${
                k === groesse ? "bg-surface-3 text-fg" : "text-fg-dim active:text-fg"
              }`}
            >
              {MESSGROESSEN[k].label}
            </button>
          ))}
        </div>
      </div>
      <ReihenChart
        reihe={naechte.map((n) => ({ datum: n.date, wert: m.wert(n) }))}
        einheit={m.einheit}
        stellen={m.stellen}
        zeitraeume={[30, 90, 365]}
        bezeichnung={m.label}
        leer="No complete night yet."
        einzeln="Only one complete night so far. A curve appears from the second one."
      />
    </Card>
  );
}
