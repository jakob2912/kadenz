import { loadDashboard } from "@/lib/health-service";
import { Card, Eyebrow, Metric, de, minToHm } from "@/components/ui";
import { weeksToGoal } from "@/lib/coach";

export const dynamic = "force-dynamic";

const ZIEL_KG = 97;

export default async function Verlauf() {
  const data = await loadDashboard(30);

  if (!data.verbunden) {
    return (
      <div className="mx-auto max-w-[520px] pt-14">
        <Eyebrow>Verlauf</Eyebrow>
        <p className="mt-3 text-sm text-fg-dim">{data.grund}</p>
      </div>
    );
  }

  const { gewicht, tagesreihe, baseline } = data;
  const wochen = gewicht.aktuell ? weeksToGoal(gewicht.aktuell.kg, ZIEL_KG, 0.5) : null;
  const zieldatum =
    wochen !== null
      ? new Date(Date.now() + wochen * 7 * 864e5).toLocaleDateString("de-AT", {
          month: "long",
          year: "numeric",
        })
      : null;

  return (
    <>
      <header className="pt-10 md:pt-14">
        <Eyebrow>Körpergewicht · 195 cm</Eyebrow>
        <h1 className="mt-1.5 text-[27px] font-bold tracking-[-0.025em] md:text-[33px]">
          {gewicht.aktuell ? `${de(gewicht.aktuell.kg, 1)} kg` : "—"}
        </h1>
        {zieldatum && (
          <p className="mt-1.5 text-sm text-fg-dim">
            Ziel {ZIEL_KG} kg · bei 0,5 kg/Woche in {wochen} Wochen,{" "}
            <b className="font-semibold text-caution">{zieldatum}</b>
          </p>
        )}
      </header>

      <div className="mt-7 grid items-start gap-4 md:grid-cols-2">
        <Card>
          <Eyebrow>30 Tage</Eyebrow>
          <GewichtsChart reihe={gewicht.reihe} />
        </Card>

        <div className="flex flex-col gap-3.5">
          <Card tone={gewicht.trend.usable ? "normal" : "warnung"}>
            <Eyebrow>Trendurteil</Eyebrow>
            {gewicht.trend.usable ? (
              <p className="num mt-2 text-[27px]">
                {gewicht.trend.kgPerWeek > 0 ? "+" : ""}
                {de(gewicht.trend.kgPerWeek, 2)}
                <span className="ml-1 text-xs font-medium text-fg-faint">kg / Woche</span>
              </p>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-fg-dim">{gewicht.trend.detail}</p>
            )}
          </Card>

          {baseline && (
            <Card>
              <Eyebrow>Deine Referenzwerte</Eyebrow>
              <div className="mt-3 flex flex-col gap-2.5">
                <Metric label="Schlaf" value={minToHm(baseline.sleepMin)} />
                <Metric label="Tiefschlaf" value={`${Math.round(baseline.deepMin)} min`} />
                <Metric label="Ruhepuls" value={`${de(baseline.restingHr)} bpm`} />
                <Metric label="HRV" value={`${de(baseline.hrv)} ms`} />
              </div>
              <p className="mt-3.5 text-xs leading-relaxed text-fg-faint">
                Aus der jeweils besseren Hälfte von {tagesreihe.length} Nächten — nicht der
                Mittelwert, sonst würde eine Ausreißerwoche die Referenz mitverschieben.
              </p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

/** Schlichter Linienchart. Messlücken werden nicht überbrückt, sondern gezeigt. */
function GewichtsChart({ reihe }: { reihe: { date: string; kg: number }[] }) {
  if (reihe.length < 2) {
    return <p className="mt-4 text-sm text-fg-dim">Noch zu wenige Messungen.</p>;
  }

  const VW = 340;
  const VH = 170;
  const P = 32;
  const kgs = reihe.map((r) => r.kg);
  const lo = Math.floor(Math.min(...kgs) - 1);
  const hi = Math.ceil(Math.max(...kgs) + 1);

  const t0 = Date.parse(reihe[0].date);
  const t1 = Date.parse(reihe[reihe.length - 1].date);
  const x = (d: string) => P + ((Date.parse(d) - t0) / (t1 - t0 || 1)) * (VW - P - 14);
  const y = (kg: number) => VH - 24 - ((kg - lo) / (hi - lo)) * (VH - 46);

  // Segmente an Messlücken über drei Tage trennen
  const segmente: { date: string; kg: number }[][] = [[]];
  reihe.forEach((p, i) => {
    if (i > 0 && Date.parse(p.date) - Date.parse(reihe[i - 1].date) > 3 * 864e5) {
      segmente.push([]);
    }
    segmente[segmente.length - 1].push(p);
  });

  const letzte = reihe[reihe.length - 1];

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      className="mt-4 block h-[170px] w-full"
      role="img"
      aria-label={`Gewichtsverlauf von ${de(reihe[0].kg, 1)} auf ${de(letzte.kg, 1)} Kilogramm`}
    >
      {[lo, (lo + hi) / 2, hi].map((g) => (
        <g key={g}>
          <line x1={P} y1={y(g)} x2={VW - 14} y2={y(g)} stroke="var(--color-hair-soft)" />
          <text x="0" y={y(g) + 3.5} className="fill-fg-faint text-[10px] font-semibold">
            {de(g, 0)}
          </text>
        </g>
      ))}

      {reihe.map((p) => (
        <circle
          key={p.date}
          cx={x(p.date)}
          cy={y(p.kg)}
          r="1.9"
          className="fill-fg-faint opacity-50"
        />
      ))}

      {segmente
        .filter((s) => s.length > 1)
        .map((seg, i) => (
          <path
            key={i}
            d={`M ${seg.map((p) => `${x(p.date)} ${y(p.kg)}`).join(" L ")}`}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

      <circle
        cx={x(letzte.date)}
        cy={y(letzte.kg)}
        r="4.5"
        fill="var(--color-accent)"
        stroke="var(--color-ground)"
        strokeWidth="3"
      />
    </svg>
  );
}
